/**
 * Deposit installment race condition — real PostgreSQL concurrency proof.
 *
 * Reproduces and guards against the TOCTOU race in DepositsService.record().
 *
 * VULNERABILITY (before fix):
 *   Two concurrent admin requests both read installment.status === PENDING
 *   OUTSIDE the $transaction, both enter the transaction, both tx.deposit.create,
 *   both tx.installment.update — producing TWO Deposit rows for the same
 *   installment (silent data corruption).
 *
 * FIX:
 *   Move the status ownership check inside the $transaction as the FIRST
 *   operation:
 *     tx.installment.updateMany({ where: { id, status: { not: PAID } } })
 *   If count === 0 → throw ConflictException(409). PostgreSQL's row-level
 *   locking serializes the competing UPDATEs so exactly one transaction wins.
 *
 * Assertions per iteration (verified against fixed code):
 *   1. HTTP responses sorted: [201, 409] — exactly one winner, one loser.
 *   2. installment.status === PAID in the database.
 *   3. Exactly ONE Deposit row linked to the installmentId.
 *
 * 8 iterations to surface any timing-dependent flakiness.
 */

import request from 'supertest';
import { InstallmentStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const ITERATIONS = 8;
const INSTALLMENT_AMOUNT = 50_000;

describe('Deposit installment race condition — real Postgres concurrency proof (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let contractId: string;
  let planId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    // SEED_ADMIN_PASSWORD may be overridden in .env for local dev (Admin12345!).
    // CI uses the default ChangeMe123! set in seed.ts.
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    adminToken = await loginAs(testApp.app, 'admin@example.com', adminPassword);

    const company = await testApp.rawPrisma.company.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    testCompanyId = company.id;

    // Pick a building under p1 — the unit only needs a valid FK.
    const building = await testApp.rawPrisma.building.findFirstOrThrow({
      where: { phase: { projectId: fixtures.projects.p1Id } },
      select: { id: true },
    });

    // SOLD so catalog queries never surface it; status is irrelevant to record().
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: building.id,
        companyId: testCompanyId,
        code: `DEP-RACE-UNIT-${Date.now()}`,
        type: '2BR',
        area: 100,
        price: 1_000_000,
        status: UnitStatus.SOLD,
      },
      select: { id: true },
    });

    const contract = await testApp.rawPrisma.contract.create({
      data: {
        companyId: testCompanyId,
        customerId: fixtures.userIds.customer1UserId,
        unitId: unit.id,
        totalAmount: 1_000_000,
        downPayment: 200_000,
      },
      select: { id: true },
    });
    contractId = contract.id;

    // InstallmentPlan.contractId is @unique — one plan per contract.
    const plan = await testApp.rawPrisma.installmentPlan.create({
      data: {
        companyId: testCompanyId,
        contractId,
        totalMonths: 12,
        monthlyAmount: INSTALLMENT_AMOUNT,
        startsAt: new Date('2026-01-01'),
      },
      select: { id: true },
    });
    planId = plan.id;
  }, 60_000);


  const http = () => request(testApp.app.getHttpServer());

  /** Create a fresh PENDING installment so each iteration starts clean. */
  async function createFreshInstallment(index: number): Promise<string> {
    const month = String((index % 12) + 1).padStart(2, '0');
    const installment = await testApp.rawPrisma.installment.create({
      data: {
        companyId: testCompanyId,
        planId,
        type: 'INSTALLMENT',
        dueDate: new Date(`2026-${month}-01`),
        amount: INSTALLMENT_AMOUNT,
        status: InstallmentStatus.PENDING,
      },
      select: { id: true },
    });
    return installment.id;
  }

  for (let i = 0; i < ITERATIONS; i++) {
    const iteration = i + 1;

    it(`[${iteration}/${ITERATIONS}] concurrent deposits: one 201 + one 409, one deposit row`, async () => {
      const installmentId = await createFreshInstallment(i);

      const body = {
        contractId,
        installmentId,
        amount: INSTALLMENT_AMOUNT,
        paidAt: '2026-01-15T10:00:00Z',
      };

      // Both requests start their I/O chains before either is awaited.
      const [r1, r2] = await Promise.allSettled([
        http().post('/v1/deposits').set('Authorization', bearer(adminToken)).send(body),
        http().post('/v1/deposits').set('Authorization', bearer(adminToken)).send(body),
      ]);

      const s1 = r1.status === 'fulfilled' ? r1.value.status : 500;
      const s2 = r2.status === 'fulfilled' ? r2.value.status : 500;
      const sortedStatuses = [s1, s2].sort();

      // ── Assertion 1: exactly one success, exactly one conflict ─────────────
      expect(sortedStatuses).toEqual([201, 409]);

      const [installment, deposits] = await Promise.all([
        testApp.rawPrisma.installment.findUniqueOrThrow({
          where: { id: installmentId },
          select: { status: true },
        }),
        testApp.rawPrisma.deposit.findMany({
          where: { installmentId },
          select: { id: true },
        }),
      ]);

      // ── Assertion 2: installment is PAID ──────────────────────────────────
      expect(installment.status).toBe(InstallmentStatus.PAID);

      // ── Assertion 3: exactly one deposit row for this installment ─────────
      // Two concurrent tx.deposit.create calls without a unique constraint
      // would both succeed → length 2. The fix ensures only the winning
      // transaction creates a row; the loser's tx is fully rolled back.
      expect(deposits).toHaveLength(1);
    }, 30_000);
  }
});
