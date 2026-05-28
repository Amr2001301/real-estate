/**
 * Snapshot of the deterministic identities the e2e seed produces.
 *
 * Specs call `loadE2EFixtures(prisma)` once per file (in `beforeAll`) and
 * assert against the returned IDs/emails. This decouples specs from the
 * specific UUIDs Prisma minted on the current run while keeping every
 * "which row do I mean" question answerable from one source.
 *
 * If the e2e seed ever changes its semantics (e.g. a different broker
 * gets a different grant), this loader is where the change shows up —
 * the specs themselves only ever read fixture properties.
 */

import type { PrismaClient } from '@prisma/client';
import { E2E_BROKER_CODES, E2E_USERS } from '../../prisma/seed-e2e';

export interface E2EFixtures {
  users: typeof E2E_USERS;
  brokerCodes: typeof E2E_BROKER_CODES;
  /**
   * Project IDs ordered by creation, matching how `seed-e2e.ts` decides
   * grants:
   *   p1, p2 → granted to BROKER_1
   *   p3      → granted to BROKER_2
   *   p4      → no broker grants (negative control). May be `undefined`
   *             if the demo only seeds 3 projects in some future version.
   */
  projects: { p1Id: string; p2Id: string; p3Id: string; p4Id?: string };
  /** A unit that lives under p1 — used for catalog/unit assertions. */
  units: { sampleUnitInP1Id: string };
  /** Pre-resolved user IDs for the staff/admin/broker/customer accounts. */
  userIds: {
    adminId: string;
    salesId: string;
    managerId: string;
    broker1UserId: string;
    broker2UserId: string;
    customer1UserId: string;
  };
  /** Phase 7B (Flow D) — broker reservation prerequisites. */
  flowD: {
    /** The APPROVED broker1 lead, assigned to `sales@`. */
    broker1ApprovedLeadId: string;
    /** ACTIVE InstallmentPlanTemplate on p1 (broker1 has access). */
    planTemplateP1Id: string;
    /** First duration option under the plan above — required by the broker
     *  create DTO when the plan has any duration options. */
    planP1DurationOptionId: string;
  };
  /**
   * Phase 7C (Flow E + F) — customer financial + maintenance fixtures.
   * All units are picked from p4 (no broker grants) and the units are
   * flipped to SOLD by the seed so other specs' `pickAvailableUnit`
   * never returns them.
   */
  flowE: {
    /** Customer1's contract (signed). Has a CUSTOMER_VISIBLE PDF + a DOWN_PAYMENT deposit. */
    customer1ContractId: string;
    customer1ContractDocId: string;
    customer1DepositId: string;
    /** Customer2's contract (signed), separate unit. Has its own CUSTOMER_VISIBLE PDF — used for cross-account negatives. */
    customer2ContractId: string;
    customer2ContractDocId: string;
  };
  flowF: {
    /** Customer1's maintenance request (OPEN) with a CUSTOMER_VISIBLE photo. */
    customer1MaintenanceRequestId: string;
    customer1MaintenancePhotoDocId: string;
  };
}

export async function loadE2EFixtures(prisma: PrismaClient): Promise<E2EFixtures> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true },
  });
  if (projects.length < 3) {
    throw new Error(
      `[seed-fixtures] Expected ≥3 projects from seed-e2e (got ${projects.length}). ` +
        'Did the globalSetup run prisma:seed:e2e?',
    );
  }
  const [p1, p2, p3, p4] = projects;
  // TypeScript can't narrow array-index access from a length check above.
  // Re-assert here so the rest of the function sees non-undefined values.
  if (!p1 || !p2 || !p3) {
    throw new Error('[seed-fixtures] unreachable — guarded by length check above');
  }

  // Pick a unit under p1 that's currently AVAILABLE (the public `/units`
  // endpoint hides non-AVAILABLE rows by design) and stay deterministic by
  // adding `id` as a tiebreaker — `seedPublicDemo` createMany's all units
  // with the same `createdAt`, so without a secondary sort Postgres can
  // return them in any order across calls. Flow D's `pickAvailableUnit`
  // orders DESC by the same key so the two never collide.
  const sampleUnit = await prisma.unit.findFirst({
    where: { building: { phase: { projectId: p1.id } }, status: 'AVAILABLE' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!sampleUnit) {
    throw new Error('[seed-fixtures] Expected at least one AVAILABLE unit under p1; got none.');
  }

  const [admin, sales, manager, broker1User, broker2User, customer1] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' }, select: { id: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'sales@example.com' }, select: { id: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'manager@example.com' }, select: { id: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.BROKER_1.email }, select: { id: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.BROKER_2.email }, select: { id: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.CUSTOMER_1.email }, select: { id: true } }),
  ]);

  // Phase 7B Flow D prerequisites — seeded once by seed-e2e.ts. We look them
  // up by the same identifying keys the seed uses (broker firm + assigned
  // sales rep + APPROVED status; project + plan name).
  const broker1Firm = await prisma.broker.findUniqueOrThrow({
    where: { code: E2E_BROKER_CODES.BROKER_1 },
    select: { id: true },
  });
  const broker1ApprovedLead = await prisma.lead.findFirstOrThrow({
    where: {
      brokerId: broker1Firm.id,
      brokerApprovalStatus: 'APPROVED',
      assignedSalesId: sales.id,
    },
    select: { id: true },
  });
  const planTemplateP1 = await prisma.installmentPlanTemplate.findFirstOrThrow({
    where: { projectId: p1.id, name: '[e2e] Default Plan' },
    select: { id: true },
  });
  const planP1Duration = await prisma.installmentPlanDurationOption.findFirstOrThrow({
    where: { planId: planTemplateP1.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });

  // Phase 7C — Flow E + F fixtures. Look up by the same stable markers the
  // seed writes (the title field on Document; customerId on Contract /
  // MaintenanceRequest).
  const customer2 = await prisma.user.findUniqueOrThrow({
    where: { email: E2E_USERS.CUSTOMER_2.email },
    select: { id: true },
  });
  const [c1Contract, c2Contract, c1Maint] = await Promise.all([
    prisma.contract.findFirstOrThrow({
      where: { customerId: customer1.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.contract.findFirstOrThrow({
      where: { customerId: customer2.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.maintenanceRequest.findFirstOrThrow({
      where: {
        customerId: customer1.id,
        description: '[e2e] Customer1 maintenance request — leaky faucet',
      },
      select: { id: true },
    }),
  ]);
  const [c1ContractDoc, c1Deposit, c2ContractDoc, c1MaintPhoto] = await Promise.all([
    prisma.document.findFirstOrThrow({
      where: { ownerType: 'CONTRACT', ownerId: c1Contract.id, title: '[e2e] Customer1 contract PDF' },
      select: { id: true },
    }),
    prisma.deposit.findFirstOrThrow({
      where: { contractId: c1Contract.id, type: 'DOWN_PAYMENT' },
      select: { id: true },
    }),
    prisma.document.findFirstOrThrow({
      where: { ownerType: 'CONTRACT', ownerId: c2Contract.id, title: '[e2e] Customer2 contract PDF' },
      select: { id: true },
    }),
    prisma.document.findFirstOrThrow({
      where: {
        ownerType: 'MAINTENANCE_REQUEST',
        ownerId: c1Maint.id,
        title: '[e2e] Customer1 maintenance photo',
      },
      select: { id: true },
    }),
  ]);

  return {
    users: E2E_USERS,
    brokerCodes: E2E_BROKER_CODES,
    projects: { p1Id: p1.id, p2Id: p2.id, p3Id: p3.id, p4Id: p4?.id },
    units: { sampleUnitInP1Id: sampleUnit.id },
    userIds: {
      adminId: admin.id,
      salesId: sales.id,
      managerId: manager.id,
      broker1UserId: broker1User.id,
      broker2UserId: broker2User.id,
      customer1UserId: customer1.id,
    },
    flowD: {
      broker1ApprovedLeadId: broker1ApprovedLead.id,
      planTemplateP1Id: planTemplateP1.id,
      planP1DurationOptionId: planP1Duration.id,
    },
    flowE: {
      customer1ContractId: c1Contract.id,
      customer1ContractDocId: c1ContractDoc.id,
      customer1DepositId: c1Deposit.id,
      customer2ContractId: c2Contract.id,
      customer2ContractDocId: c2ContractDoc.id,
    },
    flowF: {
      customer1MaintenanceRequestId: c1Maint.id,
      customer1MaintenancePhotoDocId: c1MaintPhoto.id,
    },
  };
}
