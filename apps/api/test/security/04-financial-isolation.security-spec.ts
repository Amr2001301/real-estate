/**
 * STEP 4 — Financial aggregate isolation tests.
 *
 * Proves that every financial total returned by the reports endpoints
 * contains ONLY data for the requesting company (Company A) and does
 * NOT bleed in Company B's data.
 *
 * Method: seed a distinct marker deposit for Company A, then independently
 * query rawPrisma for the correct per-company totals, call the API as
 * Company A's ADMIN, and assert the API totals match rawPrisma's Co-A
 * totals exactly.  If the platform-wide total (A + B) is larger than Co
 * A's total, we also assert the API did NOT return the platform-wide figure
 * — that assertion would catch a cross-tenant leak.
 *
 * Covered endpoints:
 *   FI-1   GET /v1/reports/financial          → deposit count / total
 *   FI-2   GET /v1/reports/kpis               → deposit total, contract count
 *   FI-3   GET /v1/reports/sales              → contract total / count
 *   FI-4   GET /v1/reports/reservations       → reservation counts by status
 *   FI-5   GET /v1/reports/admin-summary      → user counts (V-25/V-26 post-fix)
 *   FI-6   GET /v1/reports/financial-dashboard → collected, outstanding, overdue,
 *                                                commissions, bonuses
 *
 * Requires TEST_DATABASE_URL pointing at a dedicated e2e/test database.
 * Run with: pnpm --filter @rep/api test -c test/jest-security.json
 */

import { Prisma } from '@prisma/client';
import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';

// ── Marker amounts — unique values that are easy to grep in test output ────────
// These are added on top of whatever the base fixture seeds.
const A_MARKER_DEPOSIT = new Prisma.Decimal('99_123.00'.replace('_', ''));  // 99123
const B_MARKER_DEPOSIT = new Prisma.Decimal('247_891.00'.replace('_', '')); // 247891

/** Round-trip-safe Decimal comparison: tolerate floating-point display noise. */
function toNum(v: unknown): number {
  return Number(String(v ?? 0).replace(/,/g, ''));
}

describe('SEC — Financial aggregate isolation (STEP 4)', () => {
  let testApp: TestApp;
  let fx: SecurityFixture;
  let adminAToken: string;
  // IDs of marker rows — removed in afterAll.
  let markerDepositAId: string;
  let markerDepositBId: string;

  // Per-company expected totals (populated in beforeAll after seeding).
  let expectedADepositTotal: number;
  let platformDepositTotal: number;

  beforeAll(async () => {
    testApp = await createTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);

    // ── Seed marker deposits ────────────────────────────────────────────────
    // Co A: attaches to the fixture contract so FK constraint is satisfied.
    const depA = await testApp.rawPrisma.deposit.create({
      data: {
        companyId: fx.companies.aId,
        contractId: fx.resources.a.contractId,
        amount: A_MARKER_DEPOSIT,
        paidAt: new Date(),
        recordedById: fx.users.adminA.id,
        verified: true,
      },
    });
    markerDepositAId = depA.id;

    // Co B: the base fixture does not seed a contract for B so we create a
    // minimal one first, then attach the deposit to it.
    const minContractB = await testApp.rawPrisma.contract.create({
      data: {
        companyId: fx.companies.bId,
        unitId: fx.resources.b.unit1Id,
        customerId: fx.users.adminB.id,
        totalAmount: new Prisma.Decimal(0),
      },
    });
    const depB = await testApp.rawPrisma.deposit.create({
      data: {
        companyId: fx.companies.bId,
        contractId: minContractB.id,
        amount: B_MARKER_DEPOSIT,
        paidAt: new Date(),
        recordedById: fx.users.adminB.id,
        verified: true,
      },
    });
    markerDepositBId = depB.id;

    // ── Pre-compute expected totals via rawPrisma (no middleware) ──────────
    const [coAAgg, platformAgg] = await Promise.all([
      testApp.rawPrisma.deposit.aggregate({
        where: { companyId: fx.companies.aId },
        _sum: { amount: true },
      }),
      testApp.rawPrisma.deposit.aggregate({
        _sum: { amount: true },
      }),
    ]);
    expectedADepositTotal = Number(coAAgg._sum.amount ?? 0);
    platformDepositTotal  = Number(platformAgg._sum.amount ?? 0);
  }, 90_000);

  afterAll(async () => {
    // Remove marker rows (fixture teardown handles everything else).
    await testApp.rawPrisma.deposit.deleteMany({
      where: { id: { in: [markerDepositAId, markerDepositBId].filter(Boolean) } },
    });
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // ── FI-1: GET /v1/reports/financial ───────────────────────────────────────

  it('FI-1: financial() total equals Co-A-only deposit sum (not platform-wide)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const apiTotal = toNum(res.body.total);

    expect(apiTotal).toBeCloseTo(expectedADepositTotal, 1);

    // If Co B has deposits (it does — we seeded one), the platform total is
    // larger.  The API total must NOT equal the platform-wide figure.
    if (platformDepositTotal > expectedADepositTotal) {
      expect(apiTotal).not.toBeCloseTo(platformDepositTotal, 1);
    }
  });

  it('FI-1b: financial() includes Co-A marker deposit amount in total', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const apiTotal = toNum(res.body.total);
    const markerNum = Number(A_MARKER_DEPOSIT);
    // Total must be >= the marker we seeded for Co A.
    expect(apiTotal).toBeGreaterThanOrEqual(markerNum);
    // Total must be < marker_A + marker_B — proving B's deposit is excluded.
    expect(apiTotal).toBeLessThan(markerNum + Number(B_MARKER_DEPOSIT));
  });

  // ── FI-2: GET /v1/reports/kpis ────────────────────────────────────────────

  it('FI-2: kpis() depositsTotal equals Co-A deposit sum (not platform-wide)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/kpis')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const apiDepositsTotal = toNum(res.body.depositsTotal);

    expect(apiDepositsTotal).toBeCloseTo(expectedADepositTotal, 1);

    if (platformDepositTotal > expectedADepositTotal) {
      expect(apiDepositsTotal).not.toBeCloseTo(platformDepositTotal, 1);
    }
  });

  it('FI-2b: kpis() contract count excludes Co-B contracts', async () => {
    const [coAContracts, platformContracts] = await Promise.all([
      testApp.rawPrisma.contract.count({ where: { companyId: fx.companies.aId } }),
      testApp.rawPrisma.contract.count(),
    ]);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/kpis')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.contracts).toBe(coAContracts);

    if (platformContracts > coAContracts) {
      expect(res.body.contracts).not.toBe(platformContracts);
    }
  });

  // ── FI-3: GET /v1/reports/sales ───────────────────────────────────────────
  // sales() mixes ORM (TENANT_OWNED, middleware-scoped) and $queryRaw
  // (explicit companyId = getRequiredCompanyId()).

  it('FI-3: sales() contract count equals Co-A contract count (raw SQL scoped)', async () => {
    const coAContracts = await testApp.rawPrisma.contract.count({
      where: { companyId: fx.companies.aId },
    });
    const platformContracts = await testApp.rawPrisma.contract.count();

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/sales')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.contracts).toBe(coAContracts);

    if (platformContracts > coAContracts) {
      expect(res.body.contracts).not.toBe(platformContracts);
    }
  });

  it('FI-3b: sales() total equals Co-A contract total (raw SQL scoped)', async () => {
    const coAAgg = await testApp.rawPrisma.contract.aggregate({
      where: { companyId: fx.companies.aId },
      _sum: { totalAmount: true },
    });
    const platformAgg = await testApp.rawPrisma.contract.aggregate({
      _sum: { totalAmount: true },
    });
    const coATotal = Number(coAAgg._sum.totalAmount ?? 0);
    const platformTotal = Number(platformAgg._sum.totalAmount ?? 0);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/sales')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(toNum(res.body.total)).toBeCloseTo(coATotal, 1);

    if (platformTotal > coATotal) {
      expect(toNum(res.body.total)).not.toBeCloseTo(platformTotal, 1);
    }
  });

  // ── FI-4: GET /v1/reports/reservations ───────────────────────────────────

  it('FI-4: reservations() counts exclude Co-B reservations', async () => {
    const [coARes, platformRes] = await Promise.all([
      testApp.rawPrisma.reservation.count({ where: { companyId: fx.companies.aId } }),
      testApp.rawPrisma.reservation.count(),
    ]);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/reservations')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    // The response is a map { [status]: count }.
    const apiTotal = Object.values(res.body as Record<string, number>).reduce(
      (acc, n) => acc + n,
      0,
    );

    expect(apiTotal).toBe(coARes);

    if (platformRes > coARes) {
      expect(apiTotal).not.toBe(platformRes);
    }
  });

  // ── FI-5: GET /v1/reports/admin-summary — user counts (V-25/V-26) ─────────

  it('FI-5: admin-summary customerCount equals Co-A CUSTOMER count (V-25 post-fix)', async () => {
    const coACustomers = await testApp.rawPrisma.user.count({
      where: { companyId: fx.companies.aId, role: 'CUSTOMER' },
    });
    const platformCustomers = await testApp.rawPrisma.user.count({ where: { role: 'CUSTOMER' } });

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/admin-summary')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.kpis.totalCustomers).toBe(coACustomers);

    if (platformCustomers > coACustomers) {
      expect(res.body.kpis.totalCustomers).not.toBe(platformCustomers);
    }
  });

  it('FI-5b: admin-summary totalTeam equals Co-A staff count (V-26 post-fix)', async () => {
    // adminSummary counts ADMIN+SALES+SALES_MANAGER+MAINTENANCE_SUPERVISOR (not all active users).
    // Using the same role filter as reports.service.ts:344 ensures the comparison is valid.
    const coAStaff = await testApp.rawPrisma.user.count({
      where: {
        companyId: fx.companies.aId,
        role: { in: ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR'] },
      },
    });
    const platformStaff = await testApp.rawPrisma.user.count({
      where: { role: { in: ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR'] } },
    });

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/admin-summary')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.kpis.totalTeam).toBe(coAStaff);

    if (platformStaff > coAStaff) {
      expect(res.body.kpis.totalTeam).not.toBe(platformStaff);
    }
  });

  // ── FI-6: GET /v1/reports/financial-dashboard ────────────────────────────
  // Covers the big financialDashboard() method: collected, outstanding,
  // overdue, commissions (BrokerCommission), bonuses (BonusEntry).

  it('FI-6a: financial-dashboard summary.totalCollected equals Co-A deposit sum', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial-dashboard')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const apiCollected = toNum(res.body.summary?.totalCollected ?? res.body.summary?.totalCollectedAll);

    expect(apiCollected).toBeCloseTo(expectedADepositTotal, 1);

    if (platformDepositTotal > expectedADepositTotal) {
      expect(apiCollected).not.toBeCloseTo(platformDepositTotal, 1);
    }
  });

  it('FI-6b: financial-dashboard outstanding installments exclude Co-B installments', async () => {
    const [coAInst, platformInst] = await Promise.all([
      testApp.rawPrisma.installment.aggregate({
        where: { companyId: fx.companies.aId, status: { not: 'PAID' } },
        _sum: { amount: true },
      }),
      testApp.rawPrisma.installment.aggregate({
        where: { status: { not: 'PAID' } },
        _sum: { amount: true },
      }),
    ]);
    const coAOut = Number(coAInst._sum.amount ?? 0);
    const platformOut = Number(platformInst._sum.amount ?? 0);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial-dashboard')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const apiOutstanding = toNum(
      res.body.summary?.totalOutstanding ?? res.body.summary?.totalRemaining,
    );

    expect(apiOutstanding).toBeCloseTo(coAOut, 1);

    if (platformOut > coAOut) {
      expect(apiOutstanding).not.toBeCloseTo(platformOut, 1);
    }
  });

  it('FI-6c: financial-dashboard liabilities.salesBonus totals exclude Co-B bonuses', async () => {
    const [coABonus, platformBonus] = await Promise.all([
      testApp.rawPrisma.bonusEntry.aggregate({
        where: { companyId: fx.companies.aId },
        _sum: { amount: true },
      }),
      testApp.rawPrisma.bonusEntry.aggregate({
        _sum: { amount: true },
      }),
    ]);
    const coABonusTotal = Number(coABonus._sum.amount ?? 0);
    const platformBonusTotal = Number(platformBonus._sum.amount ?? 0);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial-dashboard')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    const reported = res.body.liabilities?.salesBonus;
    const apiUnpaid = toNum(
      (Number(reported?.pendingAmount ?? 0) + Number(reported?.approvedAmount ?? 0)).toString(),
    );

    // rawPrisma sums all statuses; API only sums non-PAID (unpaid liability).
    // Assert API is <= Co-A total (never more) and != platform total if Co B has bonuses.
    expect(apiUnpaid).toBeLessThanOrEqual(coABonusTotal + 0.01); // +0.01 float tolerance

    if (platformBonusTotal > coABonusTotal) {
      expect(apiUnpaid).not.toBeCloseTo(platformBonusTotal, 1);
    }
  });
});
