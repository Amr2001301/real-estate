/**
 * D1 Regression tests — real Postgres, security-fixture tenant
 *
 * Proves that all four `{ not: PAID }` → `{ in: [PENDING, OVERDUE] }` fixes
 * are load-bearing.  Each test fails against the old query and passes with the
 * current code.
 *
 * Sites under test:
 *   D1-REG-1  reports.service.ts:1237      GET /v1/reports/financial-dashboard
 *   D1-REG-2  me-home.module.ts:238        GET /v1/me/home-summary
 *   D1-REG-3  installments.module.ts:1215  GET /v1/me/installments
 *   D1-REG-4  deposits.service.ts:212      POST /v1/deposits
 *
 * Seed (added to the security-fixture installment plan for Company A):
 *   CANCELLED  800  dueDate=2020-01-01  ← earliest; old { not: PAID } returns this
 *   OVERDUE    500  dueDate=2020-06-01  ← correct next-due with the fix
 *   PAID      2000  dueDate=2020-09-01
 *   PENDING   1000  dueDate=2030-01-01
 *
 * With fix ({ in: [PENDING, OVERDUE] }):
 *   totalOutstanding = 1500  (OVERDUE+PENDING)
 *   nextDue.amount   = 500   (OVERDUE, second-earliest dueDate)
 *   POST /deposits CANCELLED → 409
 *
 * Without fix ({ not: PAID }):
 *   totalOutstanding = 2300  (CANCELLED+OVERDUE+PENDING — off by 800)
 *   nextDue.amount   = 800   (CANCELLED — earliest dueDate)
 *   POST /deposits CANCELLED → 201  (wrong — re-activates a cancelled installment)
 */

import { InstallmentStatus } from '@prisma/client';
import request from 'supertest';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  type SecurityFixture,
} from './seed/security-fixture';
import { type TestApp, createTestApp } from '../setup-app';
import { loginAs, bearer } from '../helpers/login';

let testApp: TestApp;
let secFixture: SecurityFixture;
let adminToken: string;
let customerToken: string;
let cancelledInstallmentId: string;

describe('D1-REG — CANCELLED installment regression (real Postgres)', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    secFixture = await seedSecurityFixture(testApp.rawPrisma);

    const companyAId = secFixture.companies.aId;
    const adminAId = secFixture.users.adminA.id;
    const planId = secFixture.resources.a.installmentPlanId;

    // Grant permissions needed for D1-REG-1 and D1-REG-4
    const perms = await testApp.rawPrisma.permission.findMany({
      where: { code: { in: ['reports:financial:read', 'deposits:register'] } },
    });
    for (const p of perms) {
      await testApp.rawPrisma.userPermission
        .create({ data: { userId: adminAId, permissionId: p.id } })
        .catch(() => void 0); // skip if already exists
    }

    // Seed the 4 regression installments on Company A's plan.
    // CANCELLED has the earliest dueDate so the old { not: PAID } query would
    // return it as "next due" and count it in outstanding totals.
    const [cancelled] = await Promise.all([
      testApp.rawPrisma.installment.create({
        data: {
          planId,
          companyId: companyAId,
          status: InstallmentStatus.CANCELLED,
          amount: 800,
          dueDate: new Date('2020-01-01T00:00:00Z'),
        },
      }),
      testApp.rawPrisma.installment.create({
        data: {
          planId,
          companyId: companyAId,
          status: InstallmentStatus.OVERDUE,
          amount: 500,
          dueDate: new Date('2020-06-01T00:00:00Z'),
        },
      }),
      testApp.rawPrisma.installment.create({
        data: {
          planId,
          companyId: companyAId,
          status: InstallmentStatus.PAID,
          amount: 2000,
          dueDate: new Date('2020-09-01T00:00:00Z'),
          paidAt: new Date('2020-09-01T00:00:00Z'),
        },
      }),
      testApp.rawPrisma.installment.create({
        data: {
          planId,
          companyId: companyAId,
          status: InstallmentStatus.PENDING,
          amount: 1000,
          dueDate: new Date('2030-01-01T00:00:00Z'),
        },
      }),
    ]);
    cancelledInstallmentId = cancelled.id;

    adminToken = await loginAs(
      testApp.app,
      secFixture.users.adminA.email,
      secFixture.users.adminA.password,
    );
    customerToken = await loginAs(
      testApp.app,
      secFixture.users.customerA.email,
      secFixture.users.customerA.password,
      'customer',
    );
  }, 60_000);

  afterAll(async () => {
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // ── D1-REG-1: reports.service.ts:1237 ────────────────────────────────────
  //
  // old:  { not: PAID } aggregates CANCELLED(800)+OVERDUE(500)+PENDING(1000) = 2300
  // fix:  { in: [PENDING,OVERDUE] } aggregates OVERDUE(500)+PENDING(1000)    = 1500

  it('D1-REG-1: financial-dashboard totalOutstanding = 1500 — CANCELLED 800 excluded', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/financial-dashboard')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(Number(res.body.summary.totalOutstanding)).toBe(1500);
  });

  // ── D1-REG-2: me-home.module.ts:238 ──────────────────────────────────────
  //
  // old:  { not: PAID } findFirst → CANCELLED (dueDate=2020-01-01, earliest) → 800
  // fix:  { in: [PENDING,OVERDUE] } findFirst → OVERDUE (dueDate=2020-06-01) → 500

  it('D1-REG-2: home-summary nextDue.amount = 500 — CANCELLED (dueDate earliest) excluded', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/me/home-summary')
      .set('Authorization', bearer(customerToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.installments.nextDue).not.toBeNull();
    expect(Number(res.body.installments.nextDue.amount)).toBe(500);
  });

  // ── D1-REG-3: installments.module.ts:1215 ────────────────────────────────
  //
  // Same logic as D1-REG-2 but via the me/installments summary endpoint.

  it('D1-REG-3: me/installments summary.nextDue.amount = 500 — CANCELLED excluded', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/me/installments')
      .set('Authorization', bearer(customerToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.summary.nextDue).not.toBeNull();
    expect(Number(res.body.summary.nextDue.amount)).toBe(500);
  });

  // ── D1-REG-4: deposits.service.ts:212 ────────────────────────────────────
  //
  // old:  updateMany WHERE status != PAID  → CANCELLED matches → count=1 → 201 (wrong)
  // fix:  updateMany WHERE status IN [PENDING,OVERDUE] → count=0 → ConflictException → 409

  it('D1-REG-4: POST /deposits against CANCELLED installment returns 409', async () => {
    await request(testApp.app.getHttpServer())
      .post('/v1/deposits')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({
        contractId: secFixture.resources.a.contractId,
        installmentId: cancelledInstallmentId,
        amount: 800,
      })
      .expect(409);
  });
});
