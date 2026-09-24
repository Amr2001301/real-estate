/**
 * Merged e2e group 2: Flow-D + Flow-D-Approval + me-reservations (P7/P8/P9)
 *
 * Each top-level describe is self-contained — it manages its own testApp /
 * fixtures / token variables so the three original specs are fully
 * independent despite sharing one Jest vm context.
 */

import request from 'supertest';
import * as argon2 from 'argon2';
import {
  LeadStage,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

/** Pull ids out of either a bare array or `{ data: [...] }` page wrapper. */
function collectIds(body: unknown): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) =>
      row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
        ? (row as { id: string }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
}

// ═════════════════════════════════════════════════════════════════════════════
// Flow D — Reservations (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow D — Reservation journey (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;
  let broker2Token: string;
  let customer1Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token, broker2Token, customer1Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
    ]);
  });

  const http = () => request(testApp.app.getHttpServer());

  /**
   * Find a unit on `projectId` that is currently AVAILABLE. We pick from
   * the END of the project's unit list (newest first, id-desc tiebreaker)
   * so we don't collide with Flow A's `sampleUnitInP1Id` (which picks
   * from the START). `seedPublicDemo` createMany's all units with the
   * same `createdAt`, so an `id` tiebreaker is required to keep the
   * choice deterministic across calls.
   */
  async function pickAvailableUnit(projectId: string): Promise<{ id: string }> {
    const u = await testApp.rawPrisma.unit.findFirst({
      where: { status: UnitStatus.AVAILABLE, building: { phase: { projectId } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!u) {
      throw new Error(
        `[flow-d] No AVAILABLE unit found on project ${projectId}. ` +
          'Did a previous spec consume every unit? Try a full reset: unset SKIP_DB_RESET.',
      );
    }
    return u;
  }

  // ── D1, D2, D3, D4 — sales create + unit transition + read scoping ──────
  describe('D1–D4: sales creates a reservation; unit transitions to RESERVED; reads scope correctly', () => {
    let salesReservationId: string;
    let salesReservationUnitId: string;

    it('D1: SALES POST /v1/reservations with clientId + unitId → 201, status=PENDING', async () => {
      const unit = await pickAvailableUnit(fixtures.projects.p1Id);
      salesReservationUnitId = unit.id;

      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(salesToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          notes: 'phase 7b — sales reservation',
          expiresInHours: 72,
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.reservation?.id;
      expect(typeof id).toBe('string');
      salesReservationId = id as string;

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: salesReservationId },
        select: { status: true, unitId: true, brokerId: true, salesId: true },
      });
      expect(row.status).toBe(ReservationStatus.PENDING);
      expect(row.unitId).toBe(unit.id);
      expect(row.brokerId).toBeNull(); // sales-origin → no broker
      expect(row.salesId).toBe(fixtures.userIds.salesId);
    });

    it('D2: the unit transitions AVAILABLE → RESERVED after the create', async () => {
      const u = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: salesReservationUnitId },
        select: { status: true, reservationExpiresAt: true },
      });
      expect(u.status).toBe(UnitStatus.RESERVED);
      expect(u.reservationExpiresAt).not.toBeNull();
    });

    it('D3: SALES GET /v1/reservations returns the just-created reservation', async () => {
      const res = await http()
        .get('/v1/reservations')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(salesReservationId);
    });

    it('D4: ADMIN GET /v1/reservations also returns the same row', async () => {
      const res = await http()
        .get('/v1/reservations')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(salesReservationId);
    });
  });

  // ── D5, D6, D7 — broker create + portal scoping + cross-tenancy ────────
  describe('D5–D7: broker1 creates a portal reservation; broker2 cannot see it', () => {
    let brokerReservationId: string;

    it('D5: broker1 POST /v1/portal/reservations with approved lead + plan → 201 PENDING', async () => {
      const unit = await pickAvailableUnit(fixtures.projects.p1Id);

      const res = await http()
        .post('/v1/portal/reservations')
        .set('Authorization', bearer(broker1Token))
        .send({
          leadId: fixtures.flowD.broker1ApprovedLeadId,
          unitId: unit.id,
          installmentPlanTemplateId: fixtures.flowD.planTemplateP1Id,
          selectedDurationOptionId: fixtures.flowD.planP1DurationOptionId,
          notes: 'phase 7b — broker reservation',
          expiresInHours: 72,
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.reservation?.id;
      expect(typeof id).toBe('string');
      brokerReservationId = id as string;

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: brokerReservationId },
        select: { status: true, brokerId: true },
      });
      expect(row.status).toBe(ReservationStatus.PENDING);
      expect(row.brokerId).not.toBeNull(); // attributed to broker1's firm
    });

    it('D6: broker1 GET /v1/portal/reservations returns their reservation', async () => {
      const res = await http()
        .get('/v1/portal/reservations')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(brokerReservationId);
    });

    it('D7: broker2 GET /v1/portal/reservations does NOT see broker1\'s reservation', async () => {
      const res = await http()
        .get('/v1/portal/reservations')
        .set('Authorization', bearer(broker2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).not.toContain(brokerReservationId);
    });
  });

  // ── D8, D9, D10 — RBAC negatives ────────────────────────────────────────
  describe('D8–D10: RBAC negatives on the reservation surface', () => {
    it('D8: GET /v1/portal/reservations as SALES → 403', async () => {
      const res = await http()
        .get('/v1/portal/reservations')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });

    it('D9: POST /v1/reservations as BROKER → 403 (brokers use /portal/reservations)', async () => {
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(broker1Token))
        .send({});
      expect(res.status).toBe(403);
    });

    it('D10: GET /v1/reservations without token → 401', async () => {
      const res = await http().get('/v1/reservations');
      expect(res.status).toBe(401);
    });

    it('D10(b): GET /v1/reservations as CUSTOMER → 403', async () => {
      const res = await http()
        .get('/v1/reservations')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow D Approval — Admin reservation approval / lifecycle (e2e)
// ═════════════════════════════════════════════════════════════════════════════

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
      expect(unit.status).toBe(UnitStatus.RESERVED);
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
      await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
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

// ═════════════════════════════════════════════════════════════════════════════
// P7 — /me/reservations + P8 + P9 (customer-facing reservation visibility)
// ═════════════════════════════════════════════════════════════════════════════

describe('P7 — /me/reservations (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let client1Token: string;
  let customer1Token: string;
  let customer2Token: string;
  let salesToken: string;

  let client1UserId: string;
  let salesUserId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, client1Token, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    const company = await testApp.rawPrisma.company.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    testCompanyId = company.id;

    const client1 = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CLIENT_1.email },
      select: { id: true },
    });
    client1UserId = client1.id;
    salesUserId = fixtures.userIds.salesId;
  });

  const http = () => request(testApp.app.getHttpServer());

  const consumedUnitIds = new Set<string>();

  async function pickFreshUnit(): Promise<{ id: string }> {
    // P1 is intentionally included: e2e-catalog-auth (alphabetically first in
    // e2e-1) reserves sampleUnitInP1Id before this file runs, so that unit is
    // already non-AVAILABLE. Excluding all of P1 starves P9 after the D/DA
    // describes consume the non-P1 pool (they pick DESC, we pick ASC).
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        id: { notIn: Array.from(consumedUnitIds) },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    consumedUnitIds.add(unit.id);
    return unit;
  }

  async function createDirectReservation(opts: {
    clientId: string;
    leadId?: string;
  }): Promise<{ id: string }> {
    const unit = await pickFreshUnit();
    const reservation = await testApp.rawPrisma.reservation.create({
      data: {
        companyId: testCompanyId,
        unitId: unit.id,
        salesId: salesUserId,
        clientId: opts.clientId,
        leadId: opts.leadId,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + 72 * 3_600_000),
        reservationNumber: `P7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bookingAmount: 0,
      },
      select: { id: true },
    });
    await testApp.rawPrisma.unit.update({
      where: { id: unit.id },
      data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
    });
    return reservation;
  }

  function mintAccessToken(userId: string, role: UserRole): Promise<string> {
    return testApp.signAccessToken(userId, role);
  }

  describe('P7 — customer-facing reservation visibility', () => {
    let p7ReservationId: string;

    beforeAll(async () => {
      const reservation = await createDirectReservation({ clientId: client1UserId });
      p7ReservationId = reservation.id;
    });

    it('P7.1: ADMIN creates a reservation for CLIENT_1; CLIENT_1 sees it on /me/reservations', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(p7ReservationId);
    });

    it('P7.2: CUSTOMER_2 cannot see CLIENT_1\'s reservation (cross-tenancy)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(p7ReservationId);
    });

    it('P7.3: CUSTOMER_1 can also call /me/reservations (CLIENT + CUSTOMER both allowed)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
    });

    it('P7.4b: GET /me/reservations/:id returns the row only to its owner; 404 for other users', async () => {
      const ownerRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(client1Token));
      expect(ownerRes.status).toBe(200);

      const otherRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(customer2Token));
      expect(otherRes.status).toBe(404);
    });

    it('P7.5: a reservation whose owner is reached via lead.clientId also surfaces on /me/reservations', async () => {
      const suffix = `${Date.now()}`;
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: client1UserId,
          fullName: 'P7.5 Lead Client',
          phone: `+96650099${suffix.slice(-4)}`,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const { id: leadReservationId } = await createDirectReservation({
        clientId: client1UserId,
        leadId: lead.id,
      });

      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(leadReservationId);

      const other = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(other.body)).not.toContain(leadReservationId);
    });

    it('P7.7a: unauthenticated GET /me/reservations → 401', async () => {
      const res = await http().get('/v1/me/reservations');
      expect(res.status).toBe(401);
    });

    it('P7.7b: SALES GET /me/reservations → 403 (staff use /v1/reservations)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });
  });

  // ── P8 — Synthetic User claim + phone/email fallback ─────────────────────

  let p8Seq = 0;
  async function uniqueSuffix(): Promise<string> {
    const userCount = await testApp.rawPrisma.user.count();
    p8Seq += 1;
    return String(userCount * 100 + p8Seq).padStart(6, '0');
  }

  async function createRealUser(opts: {
    fullName: string;
    email: string;
    phone: string | null;
    password: string;
  }): Promise<{ id: string }> {
    const passwordHash = await argon2.hash(opts.password);
    return testApp.rawPrisma.user.create({
      data: {
        companyId: testCompanyId,
        role: UserRole.CLIENT,
        fullName: opts.fullName,
        email: opts.email.toLowerCase(),
        phone: opts.phone,
        passwordHash,
        locale: 'ar',
      },
      select: { id: true },
    });
  }

  describe('P8 — Synthetic User claim at registration', () => {
    it('P8.1: registering with phone/email matching a synthetic CLIENT claims that row (existing Lead/Reservation surface)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500999${suffix}`;
      const email = `p8-claim-${suffix}@example.com`;

      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P8 Walk-in Lead',
          phone,
          email,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P8 Walk-in Lead',
          phone,
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P8C-${suffix}`,
          bookingAmount: 0,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      const registerRes = await http()
        .post('/v1/auth/customer/register')
        .send({
          fullName: 'P8 Real Customer',
          phone,
          email,
          password: 'StrongPass1!',
          acceptTerms: true,
        });
      expect(registerRes.status).toBe(201);

      const claimed = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: synthetic.id },
        select: { id: true, role: true, email: true, phone: true, passwordHash: true },
      });
      expect(claimed.passwordHash).toBeTruthy();
      expect(claimed.role).toBe(UserRole.CLIENT);
      expect(claimed.email).toBe(email);
      expect(claimed.phone).toBe(phone);

      const claimedToken = await mintAccessToken(claimed.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(claimedToken));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });

    it('P8.2: registering against a REAL (passwordHash set) row still 409s — claim only applies to synthetic rows', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500888${suffix}`;
      const email = `p8-real-${suffix}@example.com`;

      const first = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P8 First Register', phone, email, password: 'StrongPass1!', acceptTerms: true });
      expect(first.status).toBe(201);

      const second = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P8 Impostor', phone, email, password: 'OtherPass2!', acceptTerms: true });
      expect(second.status).toBe(409);
    });
  });

  describe('P8 — booking amount mode (FIXED vs PERCENTAGE)', () => {
    it('P8.4: FIXED mode persists the exact admin-entered amount and bookingAmountMode=FIXED', async () => {
      const unit = await pickFreshUnit();
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          expiresInHours: 72,
          bookingAmountMode: 'FIXED',
          bookingAmount: 42_500,
        });
      expect(res.status).toBe(201);
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: res.body.id as string },
        select: {
          bookingAmount: true,
          bookingAmountMode: true,
          bookingAmountPercent: true,
          bookingAmountUnitPriceSnapshot: true,
        },
      });
      expect(row.bookingAmountMode).toBe('FIXED');
      expect(Number(row.bookingAmount)).toBe(42_500);
      expect(row.bookingAmountPercent).toBeNull();
      expect(row.bookingAmountUnitPriceSnapshot).toBeNull();
    });

    it('P8.5: PERCENTAGE mode computes bookingAmount = unit.price * percent / 100 and snapshots the inputs', async () => {
      const unit = await pickFreshUnit();
      const unitRow = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unit.id },
        select: { price: true },
      });
      const unitPrice = Number(unitRow.price);
      expect(unitPrice).toBeGreaterThan(0);

      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          expiresInHours: 72,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 5,
        });
      expect(res.status).toBe(201);
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: res.body.id as string },
        select: {
          bookingAmount: true,
          bookingAmountMode: true,
          bookingAmountPercent: true,
          bookingAmountUnitPriceSnapshot: true,
        },
      });
      expect(row.bookingAmountMode).toBe('PERCENTAGE');
      expect(Number(row.bookingAmountPercent)).toBe(5);
      expect(Number(row.bookingAmountUnitPriceSnapshot)).toBe(unitPrice);
      const expected = Math.round(unitPrice * 0.05 * 100) / 100;
      expect(Number(row.bookingAmount)).toBe(expected);
    });

    it('P8.6: PERCENTAGE with invalid percent → 400; PERCENTAGE > 100 → 400 (DTO clamp)', async () => {
      const unit = await pickFreshUnit();
      const zero = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 0,
        });
      expect(zero.status).toBe(400);
      const tooHigh = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 150,
        });
      expect(tooHigh.status).toBe(400);
    });

    it('P8.7: FIXED with non-positive amount → 400', async () => {
      const unit = await pickFreshUnit();
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'FIXED',
          bookingAmount: 0,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('P8 — phone/email fallback for legacy lead linkage', () => {
    it('P8.3: a logged-in user sees a reservation linked via lead.phone == user.phone even when lead.clientId points elsewhere', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500777${suffix}`;
      const email = `p8-fallback-${suffix}@example.com`;

      const real = await createRealUser({
        fullName: 'P8 Real Customer 2',
        phone,
        email,
        password: 'StrongPass1!',
      });

      const orphanSynthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P8 Drifted Synthetic',
          phone: `${phone}-orphan`,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: orphanSynthetic.id,
          fullName: 'P8 Drifted Synthetic',
          phone,
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P8F-${suffix}`,
          bookingAmount: 50_000,
          bookingPaymentStatus: 'PAID',
          bookingPaidAt: new Date(),
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      const realToken = await mintAccessToken(real.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(realToken));
      expect(meRes.status).toBe(200);
      const ids = collectIds(meRes.body);
      expect(ids).toContain(reservation.id);

      const c2 = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2.body)).not.toContain(reservation.id);

      const realAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: real.id },
        select: { role: true },
      });
      expect(realAfter.role).toBe(UserRole.CLIENT);
    });
  });

  // ── P9 — normalized phone matching + login-time synthetic claim ─────────

  describe('P9 — normalized phone matching in ownership filter', () => {
    it('P9.1: a reservation whose lead.phone format differs from user.phone (no `+`) still surfaces after normalization', async () => {
      const suffix = await uniqueSuffix();
      const userPhone = `+966500${suffix}`;
      const leadPhoneNoPlus = `966500${suffix}`;
      const email = `p9-fmt-${suffix}@example.com`;

      const real = await createRealUser({
        fullName: 'P9 Format Drift',
        phone: userPhone,
        email,
        password: 'StrongPass1!',
      });

      const orphan = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Orphan',
          phone: `+966500other${suffix.slice(-2)}`.replace(/\D/g, ''),
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: orphan.id,
          fullName: 'P9 Format Drift',
          phone: leadPhoneNoPlus,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9F-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      const tok = await mintAccessToken(real.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);

      const c2 = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2.body)).not.toContain(reservation.id);

      const realAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: real.id },
        select: { role: true },
      });
      expect(realAfter.role).toBe(UserRole.CLIENT);
    });

    it('P9.2: a reservation whose lead.clientId is a synthetic peer matched only by user.email surfaces too', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-peer-${suffix}@example.com`;

      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Identity Peer',
          email,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P9 Identity Peer',
          phone: '+999999999999',
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9P-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      const reg = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P9 Real Identity', phone, email, password: 'StrongPass1!', acceptTerms: true });
      expect(reg.status).toBe(201);

      const claimed = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
      const tok = await mintAccessToken(claimed.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });
  });

  describe('P9 — login-time synthetic claim merges FK references', () => {
    it('P9.3: logging in opportunistically merges synthetic CLIENT peers matching by normalized phone (Lead/Reservation repoint, synthetic deleted)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-claim-${suffix}@example.com`;

      const real = await createRealUser({
        fullName: 'P9 Real Claimer',
        phone,
        email,
        password: 'StrongPass1!',
      });

      const syntheticPhoneVariant = phone.replace('+', '');
      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Drifted Synthetic',
          phone: syntheticPhoneVariant,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P9 Drifted Synthetic',
          phone: syntheticPhoneVariant,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9C-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      const tok = await loginAs(testApp.app, email, 'StrongPass1!', 'customer');
      expect(tok).toBeTruthy();

      const syntheticAfter = await testApp.rawPrisma.user.findUnique({
        where: { id: synthetic.id },
        select: { id: true },
      });
      expect(syntheticAfter).toBeNull();
      const leadAfter = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { clientId: true },
      });
      expect(leadAfter.clientId).toBe(real.id);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });

    it('P9.4: PATCH /v1/users/me adding a phone triggers the same merge (covers email-only registered + phone-only synthetic)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-patch-${suffix}@example.com`;

      const real = await createRealUser({
        fullName: 'P9 Patcher',
        phone: null,
        email,
        password: 'StrongPass1!',
      });

      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Patcher',
          phone,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P9 Patcher',
          phone,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9PT-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      const tok = await mintAccessToken(real.id, UserRole.CLIENT);
      const before = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(before.body)).not.toContain(reservation.id);

      const patch = await http()
        .patch('/v1/users/me')
        .set('Authorization', bearer(tok))
        .send({ phone });
      expect(patch.status).toBe(200);

      const syntheticAfter = await testApp.rawPrisma.user.findUnique({
        where: { id: synthetic.id },
        select: { id: true },
      });
      expect(syntheticAfter).toBeNull();
      const leadAfter = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { clientId: true },
      });
      expect(leadAfter.clientId).toBe(real.id);

      const after = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(after.body)).toContain(reservation.id);
    });

    it('P9.5: claim refuses to merge a row with passwordHash set (real account), even on contact match', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const emailA = `p9-realA-${suffix}@example.com`;
      const emailB = `p9-realB-${suffix}@example.com`;

      const realA = await createRealUser({
        fullName: 'P9 Real A',
        phone,
        email: emailA,
        password: 'StrongPass1!',
      });
      const phoneB = `+966500${suffix}9`;
      const realB = await createRealUser({
        fullName: 'P9 Real B',
        phone: phoneB,
        email: emailB,
        password: 'StrongPass1!',
      });
      const realBRow = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: realB.id },
        select: { passwordHash: true },
      });
      expect(realBRow.passwordHash).toBeTruthy();

      const tokA = await loginAs(testApp.app, emailA, 'StrongPass1!', 'customer');
      expect(tokA).toBeTruthy();

      const bAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: realB.id },
        select: { passwordHash: true, email: true },
      });
      expect(bAfter.passwordHash).toBeTruthy();
      expect(bAfter.email).toBe(emailB.toLowerCase());
      expect(realA.id).not.toBe(realB.id);
    });
  });
});
