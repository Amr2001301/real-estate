/**
 * Step C — PaymentCorrection cross-tenant attack matrix.
 *
 * Security invariants (09-reversal-design.md §6.2, CLAUDE.md tenancy rules):
 *   1. Company A admin cannot reverse a deposit that belongs to Company B → 404
 *   2. deposits:reverse permission is enforced (non-ADMIN or missing perm → 403)
 *   3. Company B admin cannot read Company A's deposit detail → 404
 *   4. PaymentCorrection is classified TENANT_OWNED in MODEL_TENANCY
 *
 * All cross-tenant tests expect HTTP 404 — do not leak existence across tenants.
 *
 * Tests:
 *   DC-1  Company A admin cannot reverse Company B deposit (404)
 *   DC-2  SALES_MANAGER without deposits:reverse cannot call the reverse endpoint (403)
 *   DC-3  Company B admin reading Company A deposit returns 404
 *   DC-4  PaymentCorrection is TENANT_OWNED in MODEL_TENANCY
 */

import request from 'supertest';
import { DepositReviewStatus } from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';
import { MODEL_TENANCY } from '../../src/common/prisma/model-tenancy';

let testApp: TestApp;
let fx: SecurityFixture;

let adminAToken: string;
let adminBToken: string;
let smAToken: string;

// Company B deposit ID seeded in beforeAll
let depBId: string;

describe('SEC — Deposit Correction cross-tenant attack matrix (Step C)', () => {
  beforeAll(async () => {
    testApp = await createTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
    adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);
    smAToken = await loginAs(testApp.app, fx.users.smA.email, fx.users.smA.password);

    // Seed a simple APPROVED deposit owned by Company B.
    // The reversal endpoint's first action is findFirst({ id, companyId: A }) → null → 404.
    // No installment or contract required — the tenant guard fires before those checks.
    const depB = await testApp.rawPrisma.deposit.create({
      data: {
        type: 'INSTALLMENT',
        amount: 10000,
        paidAt: new Date('2026-06-01'),
        reviewStatus: DepositReviewStatus.APPROVED,
        verified: true,
        recordedById: fx.users.adminB.id,
        companyId: fx.companies.bId,
      },
    });
    depBId = depB.id;
  }, 60_000);

  afterAll(async () => {
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  });

  // DC-1: cross-tenant reversal → 404
  it('DC-1: Company A admin cannot reverse Company B deposit (cross-tenant → 404)', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/v1/deposits/${depBId}/reverse`)
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .set('Authorization', bearer(adminAToken))
      .send({ reason: 'Cross-tenant attack attempt' })
      .expect(404);
  });

  // DC-2: missing permission → 403
  it('DC-2: SALES_MANAGER without deposits:reverse cannot call the reverse endpoint (403)', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/v1/deposits/${fx.resources.a.depositId}/reverse`)
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .set('Authorization', bearer(smAToken))
      .send({ reason: 'SM attempting reverse without permission' })
      .expect(403);
  });

  // DC-3: Company B admin cannot read Company A deposit
  it('DC-3: Company B admin reading Company A deposit returns 404', async () => {
    await request(testApp.app.getHttpServer())
      .get(`/v1/deposits/${fx.resources.a.depositId}`)
      .set('X-Tenant-Slug', SEC_SLUG_B)
      .set('Authorization', bearer(adminBToken))
      .expect(404);
  });

  // DC-4: classification check (in-process — no HTTP)
  it('DC-4: PaymentCorrection is TENANT_OWNED in MODEL_TENANCY', () => {
    expect(MODEL_TENANCY['PaymentCorrection']).toBe('TENANT_OWNED');
  });
});
