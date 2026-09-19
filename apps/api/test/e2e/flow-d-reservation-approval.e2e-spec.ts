/**
 * Phase 7C — Admin reservation approval / lifecycle (system QA strategy §E).
 *
 * Phase 7B deliberately skipped the admin transition endpoints (all 5 are
 * `@Roles(ADMIN)` + `@PermissionsStrict(...)`). This spec covers them now.
 *
 * Each top-level test creates its OWN fresh sales-origin reservation
 * inside `beforeAll` so the spec doesn't depend on any prior state and
 * can run in isolation. Units are picked via `pickAvailableUnit(p2)` so
 * we don't collide with Phase 7B Flow D (which picks newest under p1)
 * or the seed (which uses p4 units for the customer contracts).
 *
 * Audit reference: `src/modules/reservations/reservations.module.ts`
 * (the controller + service live in the same file).
 *
 * State machine touched:
 *   PENDING  → APPROVED       (POST /:id/approve)
 *   PENDING  → REJECTED       (POST /:id/reject; unit freed)
 *   APPROVED → CANCELLED      (POST /:id/cancel; unit freed)
 *   PENDING  → bookingPaid    (POST /:id/booking-payment/confirm; Deposit created)
 *   APPROVED → CONVERTED      (POST /:id/convert; Unit→SOLD, Contract created)
 *
 * Out of scope (deferred to later phases or simply not relevant here):
 *   - EXPIRED (system cron)
 *   - booking-payment/unconfirm (admin-only un-confirm)
 *   - Convert without prior booking payment when bookingAmount > 0
 *     (we test the negative case explicitly as DA6_neg)
 */

import request from 'supertest';
import {
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Phase 7C — Admin reservation approval / lifecycle (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
    ]);
  });


  const http = () => request(testApp.app.getHttpServer());

  /**
   * Create a fresh sales-origin reservation on a freshly-picked AVAILABLE
   * unit (any project). Returns `{reservationId, unitId}`. Each test calls
   * this in its own `beforeAll` so the path is isolated.
   *
   * We don't pin to a specific project: this spec has 7 tests, each
   * consuming one unit, and individual projects in the demo seed only
   * have 4–5 units. Picking globally + ordering DESC by createdAt then
   * id keeps us out of Flow A's sample-unit picker (which uses ASC) and
   * out of Flow D's `pickAvailableUnit` (which also picks DESC but on
   * specific projects — the global DESC pool drains those after enough
   * runs, but in a fresh seed there's always ≥10 available).
   */
  async function createSalesReservation(): Promise<{ reservationId: string; unitId: string }> {
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { status: UnitStatus.AVAILABLE },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const res = await http()
      .post('/v1/reservations')
      .set('Authorization', bearer(salesToken))
      .send({
        unitId: unit.id,
        clientId: fixtures.userIds.customer1UserId,
        notes: 'phase 7c — admin-approval prep',
        expiresInHours: 72,
      });
    expect(res.status).toBe(201);
    const id: unknown = res.body?.id ?? res.body?.reservation?.id;
    if (typeof id !== 'string') {
      throw new Error(`createSalesReservation: no id returned: ${JSON.stringify(res.body)}`);
    }
    return { reservationId: id, unitId: unit.id };
  }

  // ── DA1 — approve ────────────────────────────────────────────────────────
  describe('DA1: PENDING → APPROVED', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      ({ reservationId, unitId } = await createSalesReservation());
    });

    it('POST /:id/approve as admin → status APPROVED, approvedAt set, unit stays RESERVED', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, approvedAt: true },
      });
      expect(row.status).toBe(ReservationStatus.APPROVED);
      expect(row.approvedAt).not.toBeNull();

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.RESERVED); // unchanged on approve
    });
  });

  // ── DA2 — reject (free the unit) ─────────────────────────────────────────
  describe('DA2: PENDING → REJECTED frees the unit', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      ({ reservationId, unitId } = await createSalesReservation());
    });

    it('POST /:id/reject as admin with reason → REJECTED + unit → AVAILABLE', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({ reason: 'phase 7c — reject path' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, rejectedAt: true },
      });
      expect(row.status).toBe(ReservationStatus.REJECTED);
      expect(row.rejectedAt).not.toBeNull();

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.AVAILABLE);
    });
  });

  // ── DA3 — cancel (from APPROVED) frees the unit ─────────────────────────
  describe('DA3: APPROVED → CANCELLED frees the unit', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      ({ reservationId, unitId } = await createSalesReservation());
      // Step up to APPROVED first so we can hit cancel from there.
      const approve = await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(approve.status).toBe(201);
    });

    it('POST /:id/cancel as admin with reason → CANCELLED + unit → AVAILABLE', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', bearer(adminToken))
        .send({ reason: 'phase 7c — cancel after approve' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, cancelledAt: true },
      });
      expect(row.status).toBe(ReservationStatus.CANCELLED);
      expect(row.cancelledAt).not.toBeNull();

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.AVAILABLE);
    });
  });

  // ── DA4 — booking-payment/confirm creates a deposit ─────────────────────
  describe('DA4: booking-payment/confirm flips bookingPaymentStatus + creates a Deposit', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
      // Approve so the reservation is in a payment-ready state.
      await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      // Set a non-zero bookingAmount (sales-origin reservations default to 0
      // when no plan is selected; we update it admin-side to exercise the
      // payment-then-convert path).
      await http()
        .patch(`/v1/reservations/${reservationId}`)
        .set('Authorization', bearer(adminToken))
        .send({ bookingAmount: 50_000 });
    });

    it('POST /:id/booking-payment/confirm as admin → status=PAID + new Deposit row', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/booking-payment/confirm`)
        .set('Authorization', bearer(adminToken))
        .send({ note: 'phase 7c — booking payment confirmed' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { bookingPaymentStatus: true, bookingPaidAt: true },
      });
      expect(row.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PAID);
      expect(row.bookingPaidAt).not.toBeNull();

      const deposit = await testApp.rawPrisma.deposit.findFirst({
        where: { reservationId },
        select: { id: true, type: true, amount: true, verified: true },
      });
      expect(deposit).not.toBeNull();
      expect(deposit!.type).toBe('BOOKING_AMOUNT');
      expect(deposit!.verified).toBe(true);
    });
  });

  // ── DA5 — convert APPROVED → CONVERTED, unit → SOLD, contract created ───
  describe('DA5: APPROVED → CONVERTED creates Contract, Unit → SOLD', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      ({ reservationId, unitId } = await createSalesReservation());
      // approve → set booking amount > 0 → confirm booking payment so the
      // convert guard (bookingPaymentStatus in {PAID, WAIVED}) passes.
      await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      await http()
        .patch(`/v1/reservations/${reservationId}`)
        .set('Authorization', bearer(adminToken))
        .send({ bookingAmount: 50_000 });
      await http()
        .post(`/v1/reservations/${reservationId}/booking-payment/confirm`)
        .set('Authorization', bearer(adminToken))
        .send({});
    });

    it('POST /:id/convert as admin → CONVERTED + Unit SOLD + Contract row', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/convert`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      });
      expect(row.status).toBe(ReservationStatus.CONVERTED);

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.SOLD);

      const contract = await testApp.rawPrisma.contract.findFirst({
        where: { reservationId },
        select: { id: true, customerId: true },
      });
      expect(contract).not.toBeNull();
      // The client on the reservation is promoted from CLIENT to CUSTOMER
      // during convert per the audit — assert the contract's customerId is
      // the one we passed in as `clientId` on the create.
      expect(contract!.customerId).toBe(fixtures.userIds.customer1UserId);
    });
  });

  // ── DA6_neg — convert without paid booking → 400 ────────────────────────
  describe('DA6 (negative): convert with unpaid booking → 400', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
      await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      // Set a non-zero booking amount but do NOT confirm payment.
      await http()
        .patch(`/v1/reservations/${reservationId}`)
        .set('Authorization', bearer(adminToken))
        .send({ bookingAmount: 50_000 });
    });

    it('POST /:id/convert without prior payment → 400 (status remains APPROVED)', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/convert`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      });
      expect(row.status).toBe(ReservationStatus.APPROVED);
    });
  });

  // ── DA7, DA8 — RBAC negatives ───────────────────────────────────────────
  describe('DA7/DA8: only ADMIN can run transitions', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
    });

    it('DA7: SALES cannot approve → 403', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBe(403);
    });

    it('DA8: BROKER cannot reject → 403', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/reject`)
        .set('Authorization', bearer(broker1Token))
        .send({ reason: 'attempt' });
      expect(res.status).toBe(403);
    });

    it('DA8b: no-token convert → 401', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/convert`)
        .send({});
      expect(res.status).toBe(401);
    });
  });
});
