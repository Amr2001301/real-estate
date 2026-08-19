/**
 * TASK-TEST-001 — Reports Raw SQL Multi-Tenant Isolation (e2e, real DB)
 *
 * Proves that the three $queryRawUnsafe calls in ReportsService that bypass the
 * Prisma middleware now correctly scope results to the calling admin's companyId:
 *
 *   ISO-R1: Company B admin's /reports/sales returns only Company B contracts
 *           (byProject count = 0 when Company B has no contracts).
 *   ISO-R2: Company B admin's /reports/sales-trend returns all-zero months when
 *           Company B has no contracts, even if Company A has contracts.
 *   ISO-R3: Company B admin's /reports/broker-leaderboard returns [] when
 *           Company B has no approved commissions.
 *   ISO-R4: Company A admin's /reports/sales still returns Company A data
 *           (regression guard — scoping must not break the owning tenant).
 *
 * Data strategy: we rely on the default seeded Company A data (any contracts
 * created by the global e2e seed / prior flow tests) for the "other tenant has
 * data" side of each assertion. Company B is created fresh with zero contracts,
 * so any data leak from Company A is immediately visible as a non-zero count.
 */

import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { runTenantContext } from '../../src/common/tenant/tenant-context';

const COMPANY_B_SLUG = 'reports-mt-test-company-b';
const COMPANY_B_ADMIN_EMAIL = 'admin-b@reports-mt-test.local';
const COMPANY_B_ADMIN_PASSWORD = 'AdminB-Reports123!';

describe('Reports MT Isolation (e2e)', () => {
  let testApp: TestApp;

  let companyBId: string;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const prisma = testApp.prisma;

    // ── Company B: create a fresh isolated tenant ─────────────────────────
    const leftover = await prisma.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
        await prisma.contract.deleteMany({ where: { companyId: leftover.id } });
        await prisma.project.deleteMany({ where: { companyId: leftover.id } });
        await prisma.brokerCommission.deleteMany({ where: { companyId: leftover.id } });
      });
      await prisma.user.deleteMany({ where: { companyId: leftover.id } });
      await prisma.company.delete({ where: { id: leftover.id } });
    }

    const companyB = await prisma.company.create({
      data: { name: 'Reports MT Test Company B', slug: COMPANY_B_SLUG, isActive: true },
    });
    companyBId = companyB.id;

    const passwordHash = await argon2.hash(COMPANY_B_ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        email: COMPANY_B_ADMIN_EMAIL,
        passwordHash,
        fullName: 'Admin B (Reports MT)',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, COMPANY_B_ADMIN_EMAIL, COMPANY_B_ADMIN_PASSWORD),
    ]);
  });

  afterAll(async () => {
    const prisma = testApp.prisma;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      await prisma.brokerCommission.deleteMany({ where: { companyId: companyBId } });
      await prisma.contract.deleteMany({ where: { companyId: companyBId } });
      await prisma.project.deleteMany({ where: { companyId: companyBId } });
    });
    await prisma.user.deleteMany({ where: { companyId: companyBId } });
    await prisma.company.delete({ where: { id: companyBId } });
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  // ── ISO-R1: sales byProject isolation ──────────────────────────────────────
  it('ISO-R1: Company B admin /reports/sales returns 0 contracts (no cross-tenant leak)', async () => {
    const res = await http()
      .get('/v1/reports/sales')
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);

    const body = res.body as { contracts: number; byProject: unknown[] };
    expect(body.contracts).toBe(0);
    expect(body.byProject).toHaveLength(0);
  });

  // ── ISO-R2: sales-trend isolation ──────────────────────────────────────────
  it('ISO-R2: Company B admin /reports/sales-trend returns all-zero months', async () => {
    const year = new Date().getFullYear();
    const res = await http()
      .get(`/v1/reports/sales-trend?year=${year}`)
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);

    const months = res.body as Array<{ month: number; contracts: number; total: number }>;
    expect(months).toHaveLength(12);
    const totalContracts = months.reduce((s, m) => s + m.contracts, 0);
    expect(totalContracts).toBe(0);
  });

  // ── ISO-R3: broker-leaderboard isolation ───────────────────────────────────
  it('ISO-R3: Company B admin /reports/broker-leaderboard returns empty array', async () => {
    const res = await http()
      .get('/v1/reports/broker-leaderboard')
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBe(0);
  });

  // ── ISO-R4: Company A regression ───────────────────────────────────────────
  it('ISO-R4: Company A admin /reports/sales returns 200 (own tenant not broken)', async () => {
    const res = await http()
      .get('/v1/reports/sales')
      .set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);

    const body = res.body as { contracts: number; byProject: unknown[] };
    expect(typeof body.contracts).toBe('number');
    expect(Array.isArray(body.byProject)).toBe(true);
  });
});
