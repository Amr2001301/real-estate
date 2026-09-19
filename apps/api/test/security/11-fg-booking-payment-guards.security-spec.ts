/**
 * Steps F + G — booking-payment dual-path collision guards (FG-13).
 *
 * F: RecordDepositDto.paymentMethod passthrough — unit-tested in
 *    deposit-recording-workflow.spec.ts.  Nothing extra needed here.
 *
 * G tests use real Postgres and read rows back after every mutation.
 * No test returns early on a missing precondition — throw so the failure
 * is visible, not swallowed as a vacuous pass.
 *
 *   FG-1: confirmBookingPayment() while bookingPaymentStatus=PENDING → 409;
 *          reservation status unchanged; existing customer-proof deposit untouched.
 *   FG-2: unconfirmBookingPayment() with a customer-proof deposit present →
 *          admin deposit deleted; proof deposit AND its Document survive;
 *          bookingPaymentStatus reverts to PENDING (not UNPAID).
 *   FG-3: unconfirmBookingPayment() with only an admin-created deposit (no
 *          customer proof) → deposit deleted; bookingPaymentStatus = UNPAID.
 */

import request from 'supertest';
import { DocumentCategory, DocumentOwnerType, DocumentVisibility, ReservationBookingPaymentStatus } from '@prisma/client';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  type SecurityFixture,
} from './seed/security-fixture';

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;

describe('SEC — Steps F + G: booking-payment guards (FG-08, FG-13)', () => {
  beforeAll(async () => {
    testApp = await createSecurityTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);

    // Grant reservations:booking-payment to adminA
    const perm = await testApp.rawPrisma.permission.findFirst({
      where: { code: 'reservations:booking-payment' },
    });
    if (!perm) throw new Error('reservations:booking-payment permission not seeded');
    await testApp.rawPrisma.userPermission.upsert({
      where: { userId_permissionId: { userId: fx.users.adminA.id, permissionId: perm.id } },
      create: { userId: fx.users.adminA.id, permissionId: perm.id },
      update: {},
    });
  }, 90_000);

  afterAll(async () => {
    await teardownSecurityFixture(testApp.rawPrisma);
  });

  // ── FG-1: confirm guard — blocked when customer proof under review ──────

  describe('FG-1: confirmBookingPayment() while PENDING → 409', () => {
    let fg1ReservationId: string;
    let fg1DepositId: string;
    let fg1ConfirmStatus: number;

    beforeAll(async () => {
      // Seed: a unit + reservation in PENDING booking status with a
      // customer-proof deposit (proofDocumentId set).
      const fg1Unit = await testApp.rawPrisma.unit.create({
        data: {
          buildingId: fx.resources.a.buildingId,
          code: 'FG1-UNIT',
          type: '1BR',
          area: 80,
          price: 500_000,
          companyId: fx.companies.aId,
        },
      });

      const fg1Reservation = await testApp.rawPrisma.reservation.create({
        data: {
          unitId: fg1Unit.id,
          salesId: fx.users.adminA.id,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          bookingAmount: 50_000,
          bookingPaymentStatus: ReservationBookingPaymentStatus.PENDING,
          companyId: fx.companies.aId,
        },
      });
      fg1ReservationId = fg1Reservation.id;

      // Create a Document for the proof
      const proofDoc = await testApp.rawPrisma.document.create({
        data: {
          ownerType: DocumentOwnerType.DEPOSIT,
          ownerId: fg1Reservation.id,
          category: DocumentCategory.RECEIPT,
          title: 'FG1 customer proof',
          fileUrl: 'https://example.com/fg1-proof.pdf',
          visibility: DocumentVisibility.ADMIN_ONLY,
          uploadedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
        },
      });

      // Create the customer-proof deposit (proofDocumentId set)
      const proofDeposit = await testApp.rawPrisma.deposit.create({
        data: {
          type: 'BOOKING_AMOUNT',
          reservationId: fg1ReservationId,
          amount: 50_000,
          paidAt: new Date(),
          recordedById: fx.users.adminA.id,
          reviewStatus: 'PENDING_REVIEW',
          proofDocumentId: proofDoc.id,
          companyId: fx.companies.aId,
        },
      });
      fg1DepositId = proofDeposit.id;

      // Attempt to confirm (the call under test) — status captured for FG-1a
      const confirmRes = await request(testApp.app.getHttpServer())
        .post(`/v1/reservations/${fg1ReservationId}/booking-payment/confirm`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({});
      fg1ConfirmStatus = confirmRes.status;
    }, 30_000);

    it('FG-1a: returns 409 when a customer proof is PENDING_REVIEW', () => {
      expect(fg1ConfirmStatus).toBe(409);
    });

    it('FG-1b: reservation bookingPaymentStatus remains PENDING after rejected confirm', async () => {
      const res = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: fg1ReservationId },
        select: { bookingPaymentStatus: true },
      });
      expect(res.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PENDING);
    });

    it('FG-1c: customer-proof deposit still exists and is unchanged', async () => {
      const dep = await testApp.rawPrisma.deposit.findUniqueOrThrow({ where: { id: fg1DepositId } });
      expect(dep.reviewStatus).toBe('PENDING_REVIEW');
      expect(dep.proofDocumentId).not.toBeNull();
    });
  });

  // ── FG-2: unconfirm with customer-proof deposit — preserves evidence ────

  describe('FG-2: unconfirmBookingPayment() with customer-proof deposit preserves proof', () => {
    let fg2ReservationId: string;
    let fg2ProofDepositId: string;
    let fg2AdminDepositId: string;
    let fg2DocumentId: string;
    let fg2UnconfirmStatus: number;

    beforeAll(async () => {
      // Seed: reservation PAID with two deposits — one admin (proofDocumentId=null)
      // and one customer-proof (proofDocumentId set).
      const fg2Unit = await testApp.rawPrisma.unit.create({
        data: {
          buildingId: fx.resources.a.buildingId,
          code: 'FG2-UNIT',
          type: '2BR',
          area: 110,
          price: 800_000,
          companyId: fx.companies.aId,
        },
      });

      const fg2Reservation = await testApp.rawPrisma.reservation.create({
        data: {
          unitId: fg2Unit.id,
          salesId: fx.users.adminA.id,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          bookingAmount: 80_000,
          bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
          bookingPaidAt: new Date(),
          companyId: fx.companies.aId,
        },
      });
      fg2ReservationId = fg2Reservation.id;

      // Admin deposit (no proofDocumentId — created by the admin confirm path)
      const adminDeposit = await testApp.rawPrisma.deposit.create({
        data: {
          type: 'BOOKING_AMOUNT',
          reservationId: fg2ReservationId,
          amount: 80_000,
          paidAt: new Date(),
          recordedById: fx.users.adminA.id,
          reviewStatus: 'APPROVED',
          verified: true,
          companyId: fx.companies.aId,
        },
      });
      fg2AdminDepositId = adminDeposit.id;

      // Customer-proof document
      const proofDoc = await testApp.rawPrisma.document.create({
        data: {
          ownerType: DocumentOwnerType.DEPOSIT,
          ownerId: fg2ReservationId,
          category: DocumentCategory.RECEIPT,
          title: 'FG2 customer proof',
          fileUrl: 'https://example.com/fg2-proof.pdf',
          visibility: DocumentVisibility.ADMIN_ONLY,
          uploadedById: fx.users.adminA.id,
          companyId: fx.companies.aId,
        },
      });
      fg2DocumentId = proofDoc.id;

      // Customer-proof deposit (proofDocumentId set)
      const proofDeposit = await testApp.rawPrisma.deposit.create({
        data: {
          type: 'BOOKING_AMOUNT',
          reservationId: fg2ReservationId,
          amount: 80_000,
          paidAt: new Date(),
          recordedById: fx.users.adminA.id,
          reviewStatus: 'PENDING_REVIEW',
          proofDocumentId: proofDoc.id,
          companyId: fx.companies.aId,
        },
      });
      fg2ProofDepositId = proofDeposit.id;

      // Unconfirm — the call under test; capture status for FG-2a assertion
      const unconfirmRes = await request(testApp.app.getHttpServer())
        .post(`/v1/reservations/${fg2ReservationId}/booking-payment/unconfirm`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({});
      fg2UnconfirmStatus = unconfirmRes.status;
    }, 30_000);

    it('FG-2a: unconfirm returns 200/201', () => {
      expect([200, 201]).toContain(fg2UnconfirmStatus);
    });

    it('FG-2b: customer-proof deposit still exists in the database', async () => {
      const dep = await testApp.rawPrisma.deposit.findUnique({
        where: { id: fg2ProofDepositId },
      });
      if (!dep) throw new Error(`Proof deposit ${fg2ProofDepositId} was deleted — Hard Rule 2 violated`);
      expect(dep.reviewStatus).toBe('PENDING_REVIEW');
      expect(dep.proofDocumentId).toBe(fg2DocumentId);
    });

    it('FG-2c: the Document linked to the customer proof still exists', async () => {
      const doc = await testApp.rawPrisma.document.findUnique({
        where: { id: fg2DocumentId },
      });
      if (!doc) throw new Error(`Document ${fg2DocumentId} was deleted — orphaned proof scenario`);
      expect(doc.id).toBe(fg2DocumentId);
    });

    it('FG-2d: the admin-created deposit was deleted', async () => {
      const dep = await testApp.rawPrisma.deposit.findUnique({
        where: { id: fg2AdminDepositId },
      });
      expect(dep).toBeNull();
    });

    it('FG-2e: bookingPaymentStatus reverted to PENDING (not UNPAID) because proof remains', async () => {
      const res = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: fg2ReservationId },
        select: { bookingPaymentStatus: true },
      });
      expect(res.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PENDING);
    });
  });

  // ── FG-3: unconfirm with admin-only deposit — normal path ────────────────

  describe('FG-3: unconfirmBookingPayment() with admin-only deposit behaves as before', () => {
    let fg3ReservationId: string;
    let fg3AdminDepositId: string;
    let unconfirmStatus: number;

    beforeAll(async () => {
      const fg3Unit = await testApp.rawPrisma.unit.create({
        data: {
          buildingId: fx.resources.a.buildingId,
          code: 'FG3-UNIT',
          type: '1BR',
          area: 75,
          price: 400_000,
          companyId: fx.companies.aId,
        },
      });

      const fg3Reservation = await testApp.rawPrisma.reservation.create({
        data: {
          unitId: fg3Unit.id,
          salesId: fx.users.adminA.id,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          bookingAmount: 40_000,
          bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
          bookingPaidAt: new Date(),
          companyId: fx.companies.aId,
        },
      });
      fg3ReservationId = fg3Reservation.id;

      // Admin-created deposit only — no proofDocumentId
      const adminDeposit = await testApp.rawPrisma.deposit.create({
        data: {
          type: 'BOOKING_AMOUNT',
          reservationId: fg3ReservationId,
          amount: 40_000,
          paidAt: new Date(),
          recordedById: fx.users.adminA.id,
          reviewStatus: 'APPROVED',
          verified: true,
          companyId: fx.companies.aId,
        },
      });
      fg3AdminDepositId = adminDeposit.id;

      const res = await request(testApp.app.getHttpServer())
        .post(`/v1/reservations/${fg3ReservationId}/booking-payment/unconfirm`)
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A)
        .send({});
      unconfirmStatus = res.status;
    }, 30_000);

    it('FG-3a: unconfirm returns 200/201', () => {
      expect([200, 201]).toContain(unconfirmStatus);
    });

    it('FG-3b: admin deposit is deleted', async () => {
      const dep = await testApp.rawPrisma.deposit.findUnique({
        where: { id: fg3AdminDepositId },
      });
      expect(dep).toBeNull();
    });

    it('FG-3c: bookingPaymentStatus reverted to UNPAID', async () => {
      const res = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: fg3ReservationId },
        select: { bookingPaymentStatus: true },
      });
      expect(res.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.UNPAID);
    });
  });
});
