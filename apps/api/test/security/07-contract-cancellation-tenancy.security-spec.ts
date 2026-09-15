/**
 * Step D1 — ContractCancellation + Refund tenancy tests
 * (09-reversal-design.md §8.1 tenancy requirements).
 *
 * Verifies:
 *   CC-1  ContractCancellation throws MissingTenantContextError outside ALS
 *         (TENANT_OWNED fail-closed).
 *   CC-2  ContractCancellation row created under Company A carries companyId=A
 *         and is absent from Company B queries (cross-tenant isolation).
 *   CC-3  Refund throws MissingTenantContextError outside ALS (TENANT_OWNED).
 *   CC-4  Refund row created under Company A carries companyId=A and is absent
 *         from Company B queries.
 *   CC-5  Attack matrix — Company B admin cannot read Company A's
 *         ContractCancellation via the middleware-scoped app (returns 0 rows).
 *   CC-6  Attack matrix — Company B admin cannot read Company A's Refund via
 *         the middleware-scoped app (returns 0 rows).
 */

import { ContractStatus, PaymentMethod, UserRole } from '@prisma/client';
import { MissingTenantContextError } from '../../src/common/tenant/tenant-context.errors';
import { runTenantContext } from '../../src/common/tenant/tenant-context';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  type SecurityFixture,
} from './seed/security-fixture';
import { type TestApp, createTestApp } from '../setup-app';

let testApp: TestApp;
let secFixture: SecurityFixture;
let companyAId: string;
let companyBId: string;
let adminAId: string;
let adminBId: string;

// Tracks IDs created in this spec for afterAll cleanup.
let cancellationId: string | undefined;
let refundId: string | undefined;

describe('SEC — ContractCancellation + Refund Tenancy (Step D1)', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    secFixture = await seedSecurityFixture(testApp.rawPrisma);
    companyAId = secFixture.companies.aId;
    companyBId = secFixture.companies.bId;
    adminAId = secFixture.users.adminA.id;
    adminBId = secFixture.users.adminB.id;
  }, 60_000);

  afterAll(async () => {
    // Clean up in FK dependency order.
    if (refundId) {
      await testApp.rawPrisma.refund.deleteMany({ where: { id: refundId } }).catch(() => void 0);
    }
    if (cancellationId) {
      await testApp.rawPrisma.contractCancellation.deleteMany({ where: { id: cancellationId } }).catch(() => void 0);
    }
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // ── CC-1: ContractCancellation fail-closed outside ALS ────────────────────

  it('CC-1: contractCancellation.findMany() outside ALS context throws MissingTenantContextError', async () => {
    await expect(testApp.prisma.contractCancellation.findMany()).rejects.toThrow(
      MissingTenantContextError,
    );
  });

  it('CC-1b: contractCancellation.count() outside ALS context throws', async () => {
    await expect(testApp.prisma.contractCancellation.count()).rejects.toThrow(
      MissingTenantContextError,
    );
  });

  // ── CC-2: ContractCancellation cross-tenant isolation ─────────────────────

  it('CC-2: ContractCancellation created under Company A has companyId=A and is absent from Company B queries', async () => {
    const contractId = secFixture.resources.a.contractId;

    // Mark the seeded contract as CANCELLED so the FK constraint is satisfiable.
    // rawPrisma bypasses middleware — this is fixture setup, not the SUT.
    await testApp.rawPrisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.CANCELLED, cancelledAt: new Date() },
    });

    const cancellation = await testApp.rawPrisma.contractCancellation.create({
      data: {
        contractId,
        cancelledById: adminAId,
        companyId: companyAId,
        reason: 'SEC-TEST: cross-tenant isolation check',
        cancellationDate: new Date(),
        totalCollectedSnapshot: 0,
        retainedAmount: 0,
        refundAmount: 0,
        policySnapshot: {},
      },
    });
    cancellationId = cancellation.id;

    expect(cancellation.companyId).toBe(companyAId);

    // Simulate the middleware filter: Company B's context should not see it.
    const fromB = await testApp.rawPrisma.contractCancellation.findMany({
      where: { companyId: companyBId },
    });
    expect(fromB.map((c) => c.id)).not.toContain(cancellation.id);

    // Company A context sees it.
    const fromA = await testApp.rawPrisma.contractCancellation.findMany({
      where: { companyId: companyAId },
    });
    expect(fromA.map((c) => c.id)).toContain(cancellation.id);
  });

  // ── CC-3: Refund fail-closed outside ALS ──────────────────────────────────

  it('CC-3: refund.findMany() outside ALS context throws MissingTenantContextError', async () => {
    await expect(testApp.prisma.refund.findMany()).rejects.toThrow(
      MissingTenantContextError,
    );
  });

  it('CC-3b: refund.count() outside ALS context throws', async () => {
    await expect(testApp.prisma.refund.count()).rejects.toThrow(
      MissingTenantContextError,
    );
  });

  // ── CC-4: Refund cross-tenant isolation ───────────────────────────────────

  it('CC-4: Refund created under Company A has companyId=A and is absent from Company B queries', async () => {
    if (!cancellationId) {
      throw new Error('CC-2 must run first to create the ContractCancellation');
    }

    const refund = await testApp.rawPrisma.refund.create({
      data: {
        contractCancellationId: cancellationId,
        amount: 5000,
        companyId: companyAId,
        recordedById: adminAId,
        paidAt: new Date(),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        notes: 'SEC-TEST: cross-tenant refund isolation check',
      },
    });
    refundId = refund.id;

    expect(refund.companyId).toBe(companyAId);

    const fromB = await testApp.rawPrisma.refund.findMany({
      where: { companyId: companyBId },
    });
    expect(fromB.map((r) => r.id)).not.toContain(refund.id);

    const fromA = await testApp.rawPrisma.refund.findMany({
      where: { companyId: companyAId },
    });
    expect(fromA.map((r) => r.id)).toContain(refund.id);
  });

  // ── CC-5: Attack matrix — middleware blocks cross-tenant CC read ──────────
  //
  // Company B admin runs a query via the middleware-wired prisma (ALS context
  // injected with companyId=B). The auto-injected WHERE companyId=B means the
  // cancellation row (companyId=A) is never returned.
  //
  // NOTE: the callback MUST be `async () => await` to ensure Prisma executes
  // the query (and runs $allOperations middleware) INSIDE the ALS context.
  // A bare `() => prisma.findMany()` returns a lazy PrismaPromise that executes
  // outside the `als.run()` scope and misses the tenant context injection.

  it('CC-5: middleware-scoped query for ContractCancellation from Company B context returns 0 rows', async () => {
    if (!cancellationId) return; // CC-2 must have succeeded

    const rows = await runTenantContext({ companyId: companyBId, bypass: false, isPublic: false },
      async () => await testApp.prisma.contractCancellation.findMany(),
    );
    expect(rows.map((c) => c.id)).not.toContain(cancellationId);
  });

  it('CC-5b: middleware-scoped findUnique for Company A ContractCancellation with Company B context returns null', async () => {
    if (!cancellationId) return;

    const row = await runTenantContext({ companyId: companyBId, bypass: false, isPublic: false },
      async () => await testApp.prisma.contractCancellation.findUnique({ where: { id: cancellationId! } }),
    );
    // The middleware injects AND companyId=B — so companyId=A row is not found.
    expect(row).toBeNull();
  });

  // ── CC-6: Attack matrix — middleware blocks cross-tenant Refund read ───────

  it('CC-6: middleware-scoped query for Refund from Company B context returns 0 rows', async () => {
    if (!refundId) return; // CC-4 must have succeeded

    const rows = await runTenantContext({ companyId: companyBId, bypass: false, isPublic: false },
      async () => await testApp.prisma.refund.findMany(),
    );
    expect(rows.map((r) => r.id)).not.toContain(refundId);
  });

  it('CC-6b: middleware-scoped findUnique for Company A Refund with Company B context returns null', async () => {
    if (!refundId) return;

    const row = await runTenantContext({ companyId: companyBId, bypass: false, isPublic: false },
      async () => await testApp.prisma.refund.findUnique({ where: { id: refundId! } }),
    );
    expect(row).toBeNull();
  });

  // ── CC-7: Correct-tenant context reads its own rows ───────────────────────

  it('CC-7: middleware-scoped query for ContractCancellation from Company A context returns the row', async () => {
    if (!cancellationId) return;

    const rows = await runTenantContext({ companyId: companyAId, bypass: false, isPublic: false },
      async () => await testApp.prisma.contractCancellation.findMany(),
    );
    expect(rows.map((c) => c.id)).toContain(cancellationId);
  });

  it('CC-7b: middleware-scoped query for Refund from Company A context returns the row', async () => {
    if (!refundId) return;

    const rows = await runTenantContext({ companyId: companyAId, bypass: false, isPublic: false },
      async () => await testApp.prisma.refund.findMany(),
    );
    expect(rows.map((r) => r.id)).toContain(refundId);
  });
});
