/**
 * Step B — PaymentInstrument cross-tenant attack matrix.
 *
 * Security invariant (09-reversal-design.md §6.2, CLAUDE.md tenancy rules):
 *   Company A admin must NEVER be able to create, read, transition, or bounce
 *   an instrument that belongs to Company B. Return 404, not 403 — do not leak
 *   existence across tenants.
 *
 * Tests:
 *   PI-B-1  Company A admin cannot read Company B's instrument (GET → 404)
 *   PI-B-2  Company A admin cannot transition Company B's instrument to DEPOSITED (POST → 404)
 *   PI-B-3  Company A admin cannot transition Company B's instrument to CANCELLED (POST → 404)
 *   PI-B-4  Company A admin cannot clear Company B's instrument (POST → 404)
 *   PI-B-5  Company A admin cannot bounce Company B's instrument (POST → 404)
 *   PI-B-6  Company A admin cannot replace Company B's instrument (POST → 404)
 *   PI-B-7  Instrument created by Company A is NOT visible to Company B admin
 *
 * All PI-B tests expect HTTP 404 (not 403) to avoid leaking existence.
 */

import request from 'supertest';
import {
  PaymentInstrumentStatus,
  PaymentInstrumentType,
} from '@prisma/client';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';

let testApp: TestApp;
let fx: SecurityFixture;

// Tokens
let adminAToken: string;
let adminBToken: string;

// Instrument IDs created during setup
let piAId: string;  // belongs to Company A
let piBId: string;  // belongs to Company B (DEPOSITED, for bounce test)

describe('SEC — PaymentInstrument cross-tenant attack matrix (Step B)', () => {
  beforeAll(async () => {
    testApp = await createSecurityTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
    adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);

    // Seed Company A's instrument (PENDING_CLEARANCE)
    const piA = await testApp.rawPrisma.paymentInstrument.create({
      data: {
        type: PaymentInstrumentType.CHEQUE,
        chequeNumber: 'SEC-B-CH-A-001',
        drawerBankName: 'Test Bank',
        chequeDueDate: new Date('2027-06-01'),
        status: PaymentInstrumentStatus.PENDING_CLEARANCE,
        recordedById: fx.users.adminA.id,
        companyId: fx.companies.aId,
      },
    });
    piAId = piA.id;

    // Seed Company B's instrument (DEPOSITED — so bounce/clear tests are valid transitions)
    const piB = await testApp.rawPrisma.paymentInstrument.create({
      data: {
        type: PaymentInstrumentType.CHEQUE,
        chequeNumber: 'SEC-B-CH-B-001',
        drawerBankName: 'Other Bank',
        chequeDueDate: new Date('2027-07-01'),
        status: PaymentInstrumentStatus.DEPOSITED,
        recordedById: fx.users.adminB.id,
        companyId: fx.companies.bId,
      },
    });
    piBId = piB.id;

    // Grant Company A admin the payment-instrument permissions via direct permission assignment
    const managePerm = await testApp.rawPrisma.permission.findFirst({
      where: { code: 'payment-instruments:manage' },
    });
    const bouncePerm = await testApp.rawPrisma.permission.findFirst({
      where: { code: 'payment-instruments:bounce' },
    });
    if (managePerm) {
      await testApp.rawPrisma.userPermission.upsert({
        where: { userId_permissionId: { userId: fx.users.adminA.id, permissionId: managePerm.id } },
        create: { userId: fx.users.adminA.id, permissionId: managePerm.id },
        update: {},
      });
    }
    if (bouncePerm) {
      await testApp.rawPrisma.userPermission.upsert({
        where: { userId_permissionId: { userId: fx.users.adminA.id, permissionId: bouncePerm.id } },
        create: { userId: fx.users.adminA.id, permissionId: bouncePerm.id },
        update: {},
      });
    }
  }, 90_000);

  afterAll(async () => {
    await testApp.rawPrisma.paymentInstrument
      .deleteMany({ where: { id: { in: [piAId, piBId] } } })
      .catch(() => void 0);
    await teardownSecurityFixture(testApp.rawPrisma);
  });

  // ── PI-B-1: read cross-tenant ─────────────────────────────────────────────

  it('PI-B-1: Company A admin cannot read Company B instrument (GET returns 404)', async () => {
    await request(testApp.app.getHttpServer())
      .get(`/v1/payment-instruments/${piBId}`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-2: transition to DEPOSITED cross-tenant ──────────────────────────

  it('PI-B-2: Company A admin cannot mark Company B instrument DEPOSITED (POST → 404)', async () => {
    // piBId is already DEPOSITED but the controller doesn't know that until it loads the entity
    await request(testApp.app.getHttpServer())
      .post(`/v1/payment-instruments/${piBId}/deposit`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-3: transition to CANCELLED cross-tenant ──────────────────────────

  it('PI-B-3: Company A admin cannot cancel Company B instrument (POST → 404)', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/v1/payment-instruments/${piBId}/cancel`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-4: clear cross-tenant ────────────────────────────────────────────

  it('PI-B-4: Company A admin cannot clear Company B instrument (POST → 404)', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/v1/payment-instruments/${piBId}/clear`)
      .send({})
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-5: bounce cross-tenant ───────────────────────────────────────────

  it('PI-B-5: Company A admin cannot bounce Company B instrument (POST → 404)', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/v1/payment-instruments/${piBId}/bounce`)
      .send({ bounceReason: 'Attack attempt', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-6: replace cross-tenant ──────────────────────────────────────────

  it('PI-B-6: Company A admin cannot replace Company B instrument (POST → 404)', async () => {
    // piBId is DEPOSITED, not BOUNCED — the state machine check runs AFTER the
    // ownership check, so a 404 from the ownership guard is the expected result
    await request(testApp.app.getHttpServer())
      .post(`/v1/payment-instruments/${piBId}/replace`)
      .send({ type: PaymentInstrumentType.CHEQUE, chequeNumber: 'STOLEN-CH' })
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(404);
  });

  // ── PI-B-7: Company A instrument invisible to Company B ───────────────────

  it('PI-B-7: Company A instrument is NOT readable by Company B admin (GET → 404)', async () => {
    await request(testApp.app.getHttpServer())
      .get(`/v1/payment-instruments/${piAId}`)
      .set('Authorization', bearer(adminBToken))
      .set('X-Tenant-Slug', SEC_SLUG_B)
      .expect(404);
  });

  // ── PI-B-8: own company instrument is readable ────────────────────────────

  it('PI-B-8: Company A admin CAN read their own instrument (GET → 200)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get(`/v1/payment-instruments/${piAId}`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .expect(200);

    expect(res.body.id).toBe(piAId);
    expect(res.body.companyId).toBe(fx.companies.aId);
  });
});
