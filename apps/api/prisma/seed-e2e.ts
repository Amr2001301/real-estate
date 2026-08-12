/**
 * E2E seed — additive on top of the dev seed.
 *
 * Strategy:
 *   1. Force `SEED_PUBLIC_DEMO=true` so the dev seed produces the 4 demo
 *      projects with units/media (needed to grant broker access against).
 *   2. Run the dev seed `main()` — gives us the staff users + lead sources
 *      + demo catalog. Already idempotent (uses upserts).
 *   3. Add 5 e2e-specific users (broker1, broker2, client, customer,
 *      customer2), 2 broker firms, and the broker → project grants that
 *      Flow A asserts against. All upserted by stable unique keys.
 *
 * Idempotent: running this twice on the same DB is a no-op.
 *
 * Safety: this script writes to `DATABASE_URL`. When invoked via the
 * jest e2e runner, the jest globalSetup forces `DATABASE_URL =
 * TEST_DATABASE_URL` *only* after validating the test URL is a dedicated
 * e2e/test database. When invoked directly via `pnpm prisma:seed:e2e`,
 * the operator is responsible for pointing `DATABASE_URL` at a
 * non-production database. The required passwords are documented in
 * `apps/api/prisma/SEED_USERS.md` and are local/e2e-only.
 */

import {
  BrokerLeadStatus,
  BrokerStatus,
  BrokerUserStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  MaintenanceStatus,
  PlanTemplateStatus,
  PrismaClient,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

// Must be set BEFORE importing seed.ts — the dev seed checks this once at
// the top of `seedPublicDemo()`.
process.env.SEED_PUBLIC_DEMO = 'true';

// eslint-disable-next-line import/order
import { main as runDevSeed } from './seed';

const prisma = new PrismaClient();

/** Documented in `apps/api/prisma/SEED_USERS.md` — local/e2e use only. */
export const E2E_USERS = {
  BROKER_1: { email: 'broker1@example.com', password: 'BrokerPass1!!', fullName: 'E2E Broker One' },
  BROKER_2: { email: 'broker2@example.com', password: 'BrokerPass2!!', fullName: 'E2E Broker Two' },
  CLIENT_1: { email: 'client@example.com', password: 'ClientPass1!!', fullName: 'E2E Client' },
  CUSTOMER_1: { email: 'customer@example.com', password: 'CustomerPass1!', fullName: 'E2E Customer' },
  CUSTOMER_2: { email: 'customer2@example.com', password: 'CustomerPass2!', fullName: 'E2E Customer Two' },
} as const;

/** Stable, unique broker firm codes — idempotent upsert key. */
export const E2E_BROKER_CODES = {
  BROKER_1: 'E2E-BROKER-1',
  BROKER_2: 'E2E-BROKER-2',
} as const;

async function upsertE2EUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
): Promise<{ id: string }> {
  const passwordHash = await argon2.hash(password);
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, fullName, role, locale: 'en' },
    // Refresh hash + name + role on every run so the credentials in
    // SEED_USERS.md always work, even after a manual edit in the DB.
    update: { passwordHash, fullName, role },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  console.log('🌱 [e2e] Step 1/4 — running dev seed (additive, idempotent)…');
  await runDevSeed();

  console.log('🌱 [e2e] Step 2/4 — upserting 5 e2e users…');
  const [broker1User, broker2User] = await Promise.all([
    upsertE2EUser(E2E_USERS.BROKER_1.email, E2E_USERS.BROKER_1.password, E2E_USERS.BROKER_1.fullName, UserRole.BROKER),
    upsertE2EUser(E2E_USERS.BROKER_2.email, E2E_USERS.BROKER_2.password, E2E_USERS.BROKER_2.fullName, UserRole.BROKER),
  ]);
  // Customers / client — not in Flow A, but seeded now so Phase 7B has data.
  await Promise.all([
    upsertE2EUser(E2E_USERS.CLIENT_1.email, E2E_USERS.CLIENT_1.password, E2E_USERS.CLIENT_1.fullName, UserRole.CLIENT),
    upsertE2EUser(E2E_USERS.CUSTOMER_1.email, E2E_USERS.CUSTOMER_1.password, E2E_USERS.CUSTOMER_1.fullName, UserRole.CUSTOMER),
    upsertE2EUser(E2E_USERS.CUSTOMER_2.email, E2E_USERS.CUSTOMER_2.password, E2E_USERS.CUSTOMER_2.fullName, UserRole.CUSTOMER),
  ]);

  console.log('🌱 [e2e] Step 3/4 — upserting 2 broker firms + linking each broker user…');
  const broker1Firm = await prisma.broker.upsert({
    where: { code: E2E_BROKER_CODES.BROKER_1 },
    create: {
      code: E2E_BROKER_CODES.BROKER_1,
      companyName: 'E2E Brokerage One',
      status: BrokerStatus.ACTIVE,
    },
    update: { status: BrokerStatus.ACTIVE },
    select: { id: true },
  });
  const broker2Firm = await prisma.broker.upsert({
    where: { code: E2E_BROKER_CODES.BROKER_2 },
    create: {
      code: E2E_BROKER_CODES.BROKER_2,
      companyName: 'E2E Brokerage Two',
      status: BrokerStatus.ACTIVE,
    },
    update: { status: BrokerStatus.ACTIVE },
    select: { id: true },
  });

  // BrokerUser is unique on userId — upsert by that.
  await prisma.brokerUser.upsert({
    where: { userId: broker1User.id },
    create: {
      userId: broker1User.id,
      brokerId: broker1Firm.id,
      status: BrokerUserStatus.ACTIVE,
      canViewCommissions: true,
      isPrimaryContact: true,
      joinedAt: new Date(),
    },
    update: {
      brokerId: broker1Firm.id,
      status: BrokerUserStatus.ACTIVE,
      canViewCommissions: true,
    },
  });
  await prisma.brokerUser.upsert({
    where: { userId: broker2User.id },
    create: {
      userId: broker2User.id,
      brokerId: broker2Firm.id,
      status: BrokerUserStatus.ACTIVE,
      canViewCommissions: true,
      isPrimaryContact: true,
      joinedAt: new Date(),
    },
    update: {
      brokerId: broker2Firm.id,
      status: BrokerUserStatus.ACTIVE,
      canViewCommissions: true,
    },
  });

  console.log('🌱 [e2e] Step 4/4 — granting broker → project access…');
  // The dev seed (with SEED_PUBLIC_DEMO=true) creates 4 demo projects via
  // ensureProject(). We pick by creation order so we stay robust against
  // rename refactors in the demo content.
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true, name: true },
  });
  if (projects.length < 3) {
    throw new Error(
      `[e2e seed] expected ≥3 projects after the dev seed (got ${projects.length}). ` +
        'Did SEED_PUBLIC_DEMO=true take effect? The e2e seed forces it; if you see this, ' +
        'the dev seed may have been edited in a way that broke seedPublicDemo().',
    );
  }
  const [p1, p2, p3, p4] = projects;
  // TypeScript can't narrow array-index access from a length check above.
  // Re-assert here so the rest of the function sees non-undefined values.
  if (!p1 || !p2 || !p3) {
    throw new Error('[e2e seed] unreachable — guarded by length check above');
  }

  // broker1 → p1, p2
  for (const projectId of [p1.id, p2.id]) {
    await prisma.brokerProjectAccess.upsert({
      where: { brokerId_projectId: { brokerId: broker1Firm.id, projectId } },
      create: { brokerId: broker1Firm.id, projectId, active: true },
      update: { active: true },
    });
  }
  // broker2 → p3
  await prisma.brokerProjectAccess.upsert({
    where: { brokerId_projectId: { brokerId: broker2Firm.id, projectId: p3.id } },
    create: { brokerId: broker2Firm.id, projectId: p3.id, active: true },
    update: { active: true },
  });
  // p4 has no broker grants — negative control for Flow A test A6.

  // ── Phase 7B prerequisites ──────────────────────────────────────────────
  // Flow D — broker reservation create requires:
  //   1. an APPROVED broker lead with an assigned sales rep (broker creates
  //      the reservation FROM that lead), and
  //   2. at least one ACTIVE InstallmentPlanTemplate on the project the
  //      broker has access to (the create flow refuses without a plan).
  // Both are seeded once here so Flow D's spec can focus on the reservation
  // semantics rather than rebuilding the dependency tree.
  console.log('🌱 [e2e] Step 5/5 — Phase 7B prerequisites (Flow D broker lead + plan)…');

  const salesUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'sales@example.com' },
    select: { id: true },
  });
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
    select: { id: true },
  });

  // Find-or-create an APPROVED broker1 lead. Idempotency key = (brokerId, phone).
  // We also need a User (CLIENT role) to hang the lead off — use a stable phone.
  const broker1LeadPhone = '+966500000777';
  const broker1ClientUser =
    (await prisma.user.findUnique({ where: { phone: broker1LeadPhone } })) ??
    (await prisma.user.create({
      data: {
        role: UserRole.CLIENT,
        fullName: 'E2E Broker1 Client',
        phone: broker1LeadPhone,
        locale: 'en',
      },
    }));

  const existingBroker1Lead = await prisma.lead.findFirst({
    where: { brokerId: broker1Firm.id, clientId: broker1ClientUser.id },
    select: { id: true },
  });
  if (!existingBroker1Lead) {
    await prisma.lead.create({
      data: {
        clientId: broker1ClientUser.id,
        fullName: broker1ClientUser.fullName,
        phone: broker1LeadPhone,
        brokerId: broker1Firm.id,
        brokerApprovalStatus: BrokerLeadStatus.APPROVED,
        brokerSubmittedAt: new Date(),
        brokerApprovedAt: new Date(),
        assignedSalesId: salesUser.id,
        projectInterestId: p1.id,
      },
    });
  }

  // Find-or-create an ACTIVE InstallmentPlanTemplate on p1 (project granted
  // to broker1). The model has no unique constraint we can upsert on; we
  // probe by (projectId, name) and create only if missing.
  const PLAN_NAME = '[e2e] Default Plan';
  const existingPlan = await prisma.installmentPlanTemplate.findFirst({
    where: { projectId: p1.id, name: PLAN_NAME },
    select: { id: true },
  });
  if (!existingPlan) {
    await prisma.installmentPlanTemplate.create({
      data: {
        projectId: p1.id,
        name: PLAN_NAME,
        // Numbers are deterministic and have nothing to do with real pricing.
        totalPrice: 1_000_000,
        netPrice: 1_000_000,
        reservationAmount: 50_000,
        downPaymentValue: 200_000,
        downPaymentAmount: 200_000,
        installmentsCount: 24,
        status: PlanTemplateStatus.ACTIVE,
        createdById: adminUser.id,
        durationOptions: {
          create: [
            { durationMonths: 12, increasePercentage: 0, order: 1 },
            { durationMonths: 24, increasePercentage: 5, order: 2 },
          ],
        },
      },
    });
  }

  // ── Phase 7C prerequisites ──────────────────────────────────────────────
  // Flow E (customer financial + signed documents) needs:
  //   1. A Contract owned by customer1 + a CUSTOMER_VISIBLE Document tied
  //      to it (so the signed-download flow has something to read).
  //   2. A Deposit linked to that contract (so /me/deposits returns rows).
  //   3. A second Contract owned by customer2 + its own CUSTOMER_VISIBLE
  //      Document (cross-account negative — customer1 must not be able to
  //      download customer2's doc, and vice versa).
  // Flow F (maintenance with photos) needs:
  //   4. A MaintenanceRequest owned by customer1 + at least one
  //      CUSTOMER_VISIBLE photo Document (so the signed-download flow has
  //      something to read for a maintenance owner type).
  //
  // We pick units from p4 (no broker grants) so these seeded fixtures don't
  // collide with Flow D's `pickAvailableUnit` (which targets p1/p2). The
  // chosen units are then flipped to SOLD to prevent any other spec from
  // ever picking them as AVAILABLE.
  console.log('🌱 [e2e] Step 6/6 — Phase 7C prerequisites (Flow E + F fixtures)…');

  const [customer1User, customer2User] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: E2E_USERS.CUSTOMER_1.email },
      select: { id: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: E2E_USERS.CUSTOMER_2.email },
      select: { id: true },
    }),
  ]);

  if (!p4) {
    throw new Error(
      '[e2e seed] Phase 7C requires ≥4 projects (uses p4 for contracts so it ' +
        'never collides with Flow D unit picks). seedPublicDemo creates 4 by default.',
    );
  }

  // Pick 2 units under p4 deterministically (createdAt asc, then id asc).
  // We need stable IDs across reseed runs so the idempotency keys below match.
  const unitsUnderP4 = await prisma.unit.findMany({
    where: { building: { phase: { projectId: p4.id } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 2,
    select: { id: true },
  });
  if (unitsUnderP4.length < 2) {
    throw new Error(
      `[e2e seed] Phase 7C expects ≥2 units under p4 (got ${unitsUnderP4.length}).`,
    );
  }
  const [c1Unit, c2Unit] = unitsUnderP4;
  if (!c1Unit || !c2Unit) {
    throw new Error('[e2e seed] unreachable — guarded by length check above');
  }

  // Helper: find-or-create a Contract owned by `customerId` on a given unit.
  // Contract has no natural unique constraint, so we probe by (customerId, unitId).
  async function ensureCustomerContract(opts: {
    customerId: string;
    unitId: string;
    totalAmount: number;
    downPayment: number;
  }): Promise<{ id: string }> {
    const existing = await prisma.contract.findFirst({
      where: { customerId: opts.customerId, unitId: opts.unitId },
      select: { id: true },
    });
    if (existing) return existing;
    const c = await prisma.contract.create({
      data: {
        customerId: opts.customerId,
        unitId: opts.unitId,
        totalAmount: opts.totalAmount,
        downPayment: opts.downPayment,
        signedAt: new Date(),
      },
      select: { id: true },
    });
    // Flip unit to SOLD so no other spec ever picks it as AVAILABLE.
    await prisma.unit.update({
      where: { id: opts.unitId },
      data: { status: UnitStatus.SOLD },
    });
    return c;
  }

  // Helper: find-or-create a CUSTOMER_VISIBLE Document attached to an owner.
  // Documents have no natural unique constraint, so we probe by
  // (ownerType, ownerId, title) — title is our stable marker.
  async function ensureCustomerVisibleDocument(opts: {
    ownerType: DocumentOwnerType;
    ownerId: string;
    title: string;
    category: DocumentCategory;
    fileUrl: string; // a deterministic, NON-network "key"-like path
    fileName: string;
    mimeType: string;
    uploadedById: string;
  }): Promise<{ id: string }> {
    const existing = await prisma.document.findFirst({
      where: { ownerType: opts.ownerType, ownerId: opts.ownerId, title: opts.title },
      select: { id: true },
    });
    if (existing) return existing;
    return prisma.document.create({
      data: {
        ownerType: opts.ownerType,
        ownerId: opts.ownerId,
        title: opts.title,
        category: opts.category,
        fileUrl: opts.fileUrl,
        fileName: opts.fileName,
        mimeType: opts.mimeType,
        sizeBytes: 1024,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
        uploadedById: opts.uploadedById,
      },
      select: { id: true },
    });
  }

  // 1. Customer1 contract + CUSTOMER_VISIBLE PDF
  const c1Contract = await ensureCustomerContract({
    customerId: customer1User.id,
    unitId: c1Unit.id,
    totalAmount: 1_000_000,
    downPayment: 200_000,
  });
  const c1ContractDoc = await ensureCustomerVisibleDocument({
    ownerType: DocumentOwnerType.CONTRACT,
    ownerId: c1Contract.id,
    title: '[e2e] Customer1 contract PDF',
    category: DocumentCategory.CONTRACT,
    fileUrl: 'contracts/e2e/customer1-contract.pdf',
    fileName: 'customer1-contract.pdf',
    mimeType: 'application/pdf',
    uploadedById: adminUser.id,
  });

  // 2. Customer1 deposit (DOWN_PAYMENT, linked to the contract above)
  const existingC1Deposit = await prisma.deposit.findFirst({
    where: { contractId: c1Contract.id, type: DepositType.DOWN_PAYMENT },
    select: { id: true },
  });
  const c1Deposit = existingC1Deposit ??
    (await prisma.deposit.create({
      data: {
        contractId: c1Contract.id,
        type: DepositType.DOWN_PAYMENT,
        amount: 200_000,
        paidAt: new Date(),
        recordedById: adminUser.id,
        verified: true,
      },
      select: { id: true },
    }));

  // 3. Customer2 contract + CUSTOMER_VISIBLE PDF (cross-account negative)
  const c2Contract = await ensureCustomerContract({
    customerId: customer2User.id,
    unitId: c2Unit.id,
    totalAmount: 1_200_000,
    downPayment: 240_000,
  });
  const c2ContractDoc = await ensureCustomerVisibleDocument({
    ownerType: DocumentOwnerType.CONTRACT,
    ownerId: c2Contract.id,
    title: '[e2e] Customer2 contract PDF',
    category: DocumentCategory.CONTRACT,
    fileUrl: 'contracts/e2e/customer2-contract.pdf',
    fileName: 'customer2-contract.pdf',
    mimeType: 'application/pdf',
    uploadedById: adminUser.id,
  });

  // 4. Customer1 maintenance request + CUSTOMER_VISIBLE photo
  // MaintenanceRequest has no natural unique key — probe by (customerId, description).
  // It requires a categoryId; the dev seed creates several categories, so we
  // just pick the first by creation order.
  const anyCategory = await prisma.maintenanceCategory.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const C1_MAINT_DESC = '[e2e] Customer1 maintenance request — leaky faucet';
  const existingC1Maint = await prisma.maintenanceRequest.findFirst({
    where: { customerId: customer1User.id, description: C1_MAINT_DESC },
    select: { id: true },
  });
  const c1Maint = existingC1Maint ??
    (await prisma.maintenanceRequest.create({
      data: {
        customerId: customer1User.id,
        unitId: c1Unit.id, // same unit as their contract
        categoryId: anyCategory.id,
        description: C1_MAINT_DESC,
        status: MaintenanceStatus.OPEN,
      },
      select: { id: true },
    }));

  // Phase 7D — assign the seeded request to the maintenance supervisor so
  // the SUPERVISOR_TRANSITIONS subset (ASSIGNED→IN_PROGRESS→RESOLVED) can
  // be exercised end-to-end without having to admin-assign mid-spec.
  // Idempotent: only flips when the row isn't already in the expected
  // shape, so re-running the seed doesn't keep rewriting timestamps.
  const supervisorUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'maintenance@example.com' },
    select: { id: true },
  });
  const currentMaint = await prisma.maintenanceRequest.findUniqueOrThrow({
    where: { id: c1Maint.id },
    select: { status: true, assignedAdminId: true },
  });
  if (
    currentMaint.assignedAdminId !== supervisorUser.id ||
    currentMaint.status === MaintenanceStatus.OPEN
  ) {
    await prisma.maintenanceRequest.update({
      where: { id: c1Maint.id },
      data: {
        assignedAdminId: supervisorUser.id,
        status: MaintenanceStatus.ASSIGNED,
      },
    });
  }
  const c1MaintDoc = await ensureCustomerVisibleDocument({
    ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
    ownerId: c1Maint.id,
    title: '[e2e] Customer1 maintenance photo',
    category: DocumentCategory.IMAGE,
    fileUrl: 'maintenance/e2e/customer1-photo-1.jpg',
    fileName: 'customer1-photo-1.jpg',
    mimeType: 'image/jpeg',
    uploadedById: customer1User.id,
  });

  // Phase 7E — one unread notification per customer, so the cross-user
  // denial e2e spec has a concrete `id` to try to mark-read across
  // accounts. Idempotent: probe by (userId, templateCode).
  const NOTIF_TEMPLATE = 'phase7e_test';
  for (const userId of [customer1User.id, customer2User.id]) {
    const existing = await prisma.notification.findFirst({
      where: { userId, templateCode: NOTIF_TEMPLATE },
      select: { id: true },
    });
    if (!existing) {
      await prisma.notification.create({
        data: {
          userId,
          templateCode: NOTIF_TEMPLATE,
          payload: { reason: 'phase 7e me/* scope audit' },
          channel: 'IN_APP',
        },
      });
    }
  }

  console.log('✅ [e2e] Seed complete.');
  console.log('   Brokers:');
  console.log(`     ${E2E_BROKER_CODES.BROKER_1} → projects [${p1.id}, ${p2.id}]`);
  console.log(`     ${E2E_BROKER_CODES.BROKER_2} → project  [${p3.id}]`);
  console.log(`     (no grant)             → project  [${p4.id}]`);
  console.log(`   Broker1 APPROVED lead → client ${broker1ClientUser.id}, sales ${salesUser.id}`);
  console.log(`   InstallmentPlanTemplate "${PLAN_NAME}" on project ${p1.id}`);
  console.log(`   Customer1 contract ${c1Contract.id} + doc ${c1ContractDoc.id} + deposit ${c1Deposit.id}`);
  console.log(`   Customer2 contract ${c2Contract.id} + doc ${c2ContractDoc.id}`);
  console.log(`   Customer1 maintenance ${c1Maint.id} + photo ${c1MaintDoc.id}`);
  console.log('   See apps/api/prisma/SEED_USERS.md for the full user table.');
}

export { main };

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
