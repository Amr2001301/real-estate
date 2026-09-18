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

    // Grant payment-instruments:bounce to adminA so the DC-5 atomicity test
    // reaches the service layer (past @PermissionsStrict).
    const bouncePerm = await testApp.rawPrisma.permission.findFirst({
      where: { code: 'payment-instruments:bounce' },
    });
    if (bouncePerm) {
      await testApp.rawPrisma.userPermission.upsert({
        where: { userId_permissionId: { userId: fx.users.adminA.id, permissionId: bouncePerm.id } },
        create: { userId: fx.users.adminA.id, permissionId: bouncePerm.id },
        update: {},
      });
    }
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

  // ── DC-5: bounce transaction atomicity ────────────────────────────────────
  // Adds CHECK(1=0) on PaymentCorrection so paymentCorrection.create always
  // fails inside the $transaction. Asserts the entire transaction is rolled back:
  // PI stays DEPOSITED, installment stays PAID with original paidAt,
  // lastCorrectionId stays null, no correction row persisted.

  describe('DC-5: bounce transaction atomicity (real $transaction rollback)', () => {
    let atomicPiId: string;
    let atomicBounceInstId: string;
    const bouncePaidAt = new Date('2026-03-01');

    afterAll(async () => {
      // Safety net: drop constraint if DC-5 was interrupted before its own finally ran.
      await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" DROP CONSTRAINT IF EXISTS "test_atomic_bounce_check"`.catch(() => void 0);
    });

    beforeAll(async () => {
      const pi = await testApp.rawPrisma.paymentInstrument.create({
        data: {
          type: 'CHEQUE',
          status: 'DEPOSITED',
          chequeNumber: 'ATOMIC-BOUNCE-001',
          recordedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
        },
      });
      atomicPiId = pi.id;

      const inst = await testApp.rawPrisma.installment.create({
        data: {
          planId: fx.resources.a.installmentPlanId,
          dueDate: new Date('2026-01-01'),
          amount: 5000,
          status: 'PAID',
          paidAt: bouncePaidAt,
          companyId: fx.companies.aId,
        },
      });
      atomicBounceInstId = inst.id;

      await testApp.rawPrisma.deposit.create({
        data: {
          amount: 5000,
          paidAt: new Date('2026-02-01'),
          reviewStatus: 'APPROVED',
          verified: true,
          recordedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
          paymentInstrumentId: pi.id,
          installmentId: inst.id,
        },
      });
    });

    it('DC-5: forced paymentCorrection.create failure rolls back the entire bounce transaction', async () => {
      try {
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "test_atomic_bounce_check" CHECK (1 = 0)`;

        const res = await request(testApp.app.getHttpServer())
          .post(`/v1/payment-instruments/${atomicPiId}/bounce`)
          .set('X-Tenant-Slug', SEC_SLUG_A)
          .set('Authorization', bearer(adminAToken))
          .send({ bounceReason: 'Atomicity test', bounceDate: '2027-01-08', penaltyAmount: 0 });

        expect(res.status).toBeGreaterThanOrEqual(400);

        // PI must still be DEPOSITED (not BOUNCED)
        const pi = await testApp.rawPrisma.paymentInstrument.findUnique({ where: { id: atomicPiId } });
        expect(pi?.status).toBe('DEPOSITED');

        // Installment must still be PAID with original paidAt, lastCorrectionId null
        const inst = await testApp.rawPrisma.installment.findUnique({ where: { id: atomicBounceInstId } });
        expect(inst?.status).toBe('PAID');
        expect(inst?.paidAt?.getTime()).toBe(bouncePaidAt.getTime());
        expect(inst?.lastCorrectionId).toBeNull();

        // No PaymentCorrection row was persisted
        const corrections = await testApp.rawPrisma.paymentCorrection.findMany({
          where: { sourceInstallmentId: atomicBounceInstId },
        });
        expect(corrections).toHaveLength(0);
      } finally {
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" DROP CONSTRAINT IF EXISTS "test_atomic_bounce_check"`;
      }
    });
  });

  // ── DC-6: reverseDeposit transaction atomicity ────────────────────────────
  // Same CHECK(1=0) approach — asserts deposit stays APPROVED, installment
  // stays PAID with original paidAt, no correction row, lastCorrectionId null.

  describe('DC-6: reverseDeposit transaction atomicity (real $transaction rollback)', () => {
    let atomicRevDepId: string;
    let atomicRevInstId: string;
    const reversePaidAt = new Date('2026-04-01');

    afterAll(async () => {
      // Safety net: drop constraint if DC-6 was interrupted before its own finally ran.
      await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" DROP CONSTRAINT IF EXISTS "test_atomic_reverse_check"`.catch(() => void 0);
    });

    beforeAll(async () => {
      const inst = await testApp.rawPrisma.installment.create({
        data: {
          planId: fx.resources.a.installmentPlanId,
          dueDate: new Date('2026-02-01'),
          amount: 8000,
          status: 'PAID',
          paidAt: reversePaidAt,
          companyId: fx.companies.aId,
        },
      });
      atomicRevInstId = inst.id;

      const dep = await testApp.rawPrisma.deposit.create({
        data: {
          amount: 8000,
          paidAt: new Date('2026-03-01'),
          reviewStatus: 'APPROVED',
          verified: true,
          recordedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
          installmentId: inst.id,
        },
      });
      atomicRevDepId = dep.id;
    });

    it('DC-6: forced paymentCorrection.create failure rolls back the entire reverseDeposit transaction', async () => {
      try {
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "test_atomic_reverse_check" CHECK (1 = 0)`;

        const res = await request(testApp.app.getHttpServer())
          .post(`/v1/deposits/${atomicRevDepId}/reverse`)
          .set('X-Tenant-Slug', SEC_SLUG_A)
          .set('Authorization', bearer(adminAToken))
          .send({ reason: 'Atomicity test — should roll back' });

        expect(res.status).toBeGreaterThanOrEqual(400);

        // Deposit must still be APPROVED
        const dep = await testApp.rawPrisma.deposit.findUnique({ where: { id: atomicRevDepId } });
        expect(dep?.reviewStatus).toBe('APPROVED');

        // Installment must still be PAID with original paidAt, lastCorrectionId null
        const inst = await testApp.rawPrisma.installment.findUnique({ where: { id: atomicRevInstId } });
        expect(inst?.status).toBe('PAID');
        expect(inst?.paidAt?.getTime()).toBe(reversePaidAt.getTime());
        expect(inst?.lastCorrectionId).toBeNull();

        // No PaymentCorrection row was persisted
        const corrections = await testApp.rawPrisma.paymentCorrection.findMany({
          where: { sourceInstallmentId: atomicRevInstId },
        });
        expect(corrections).toHaveLength(0);
      } finally {
        await testApp.rawPrisma.$executeRaw`ALTER TABLE "PaymentCorrection" DROP CONSTRAINT IF EXISTS "test_atomic_reverse_check"`;
      }
    });
  });
});
