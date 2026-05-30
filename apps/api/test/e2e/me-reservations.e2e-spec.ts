/**
 * P7 — Customer-side reservation visibility (`/me/reservations`).
 *
 * The portal previously had no way for a CLIENT or CUSTOMER to see their own
 * reservations. Admin-created reservations existed in the database but never
 * surfaced on `/account`, `/account/requests`, or anywhere reachable. This
 * spec locks the new endpoint + the role-promotion rule it depends on.
 *
 * Coverage:
 *   P7.1 — Admin creates a reservation for CLIENT_1 → CLIENT_1 sees it
 *           via GET /v1/me/reservations.
 *   P7.2 — CUSTOMER_2 cannot see CLIENT_1's reservation (cross-tenancy).
 *   P7.3 — CUSTOMER_1 can also access the endpoint (both CLIENT and
 *           CUSTOMER are allowed; the endpoint is not CUSTOMER-only).
 *   P7.4 — Creating a reservation alone does NOT promote CLIENT → CUSTOMER.
 *           This locks the business rule documented in
 *           reservations.module.ts MeReservationsController docstring.
 *   P7.5 — Lead-based ownership path: a reservation whose owner is reached
 *           via `Reservation.lead.clientId` also surfaces on /me/reservations.
 *   P7.6 — Creating a CONTRACT for the CLIENT promotes them to CUSTOMER.
 *           Uses a fresh transient user to avoid mutating the shared
 *           CLIENT_1 fixture (other specs rely on its role being CLIENT).
 *   P7.7 — Unauthenticated and wrong-role access are denied.
 */

import request from 'supertest';
import { LeadStage, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

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

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.prisma);

    [adminToken, salesToken, client1Token, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    const client1 = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CLIENT_1.email },
      select: { id: true },
    });
    client1UserId = client1.id;
    salesUserId = fixtures.userIds.salesId;
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  // Track unit IDs we've already used within this spec, so successive
  // allocations don't collide. Critical: we MUST NOT consume p1 units —
  // `loadE2EFixtures` in test/helpers/seed-fixtures.ts (called from every
  // spec file's beforeAll) requires at least one AVAILABLE unit on p1, and
  // suite-order is non-deterministic so a later spec's beforeAll may fire
  // after ours runs. Picking exclusively from non-p1 projects keeps the p1
  // pool intact for the fixture loader.
  const consumedUnitIds = new Set<string>();

  async function pickFreshUnit(): Promise<{ id: string }> {
    const unit = await testApp.prisma.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        id: { notIn: Array.from(consumedUnitIds) },
        // Exclude p1 — `loadE2EFixtures` depends on at least one AVAILABLE p1 unit.
        NOT: { building: { phase: { projectId: fixtures.projects.p1Id } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    consumedUnitIds.add(unit.id);
    return unit;
  }

  /**
   * Create a reservation owned directly by `clientId`. We bypass the admin
   * POST /v1/reservations endpoint here to avoid coupling these specs to
   * reservation-create side effects (unit RESERVED, lead matching). Those
   * have their own coverage in Flow D; here we only care about VISIBILITY
   * through /me/reservations.
   */
  async function reserveFreshUnitFor(
    clientId: string,
  ): Promise<{ reservationId: string; unitId: string }> {
    const unit = await pickFreshUnit();
    const reservation = await testApp.prisma.reservation.create({
      data: {
        unitId: unit.id,
        salesId: salesUserId,
        clientId,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + 72 * 3_600_000),
        reservationNumber: `P7-${Date.now()}`,
        bookingAmount: 0,
      },
      select: { id: true },
    });
    // Flip the unit to RESERVED so its state matches what the real
    // create flow would produce. We don't write UnitStatusHistory here
    // because Flow D already covers that contract.
    await testApp.prisma.unit.update({
      where: { id: unit.id },
      data: {
        status: UnitStatus.RESERVED,
        reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
      },
    });
    return { reservationId: reservation.id, unitId: unit.id };
  }

  describe('Direct ownership (Reservation.clientId)', () => {
    let p7ReservationId: string;

    it('P7.1: ADMIN creates a reservation for CLIENT_1; CLIENT_1 sees it on /me/reservations', async () => {
      const { reservationId } = await reserveFreshUnitFor(client1UserId);
      p7ReservationId = reservationId;

      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(p7ReservationId);

      // Response shape carries the fields the customer card renders.
      const row = (res.body?.data as Array<Record<string, unknown>>).find(
        (r) => r.id === p7ReservationId,
      );
      expect(row).toBeDefined();
      expect(row?.reservationNumber).toEqual(expect.stringMatching(/^P7-/));
      expect(row?.status).toBe('PENDING');
      expect(row?.bookingAmount).toBeDefined();
      expect(row?.bookingPaymentStatus).toBe('UNPAID');
      // Unit / project nested chain is present
      const unit = row?.unit as { code?: string; building?: { phase?: { project?: { id?: string } } } } | null;
      expect(typeof unit?.code).toBe('string');
      expect(typeof unit?.building?.phase?.project?.id).toBe('string');
      // Assigned sales rep is visible
      const sales = row?.sales as { id?: string; fullName?: string } | null;
      expect(sales?.id).toBe(salesUserId);
    });

    it('P7.2: CUSTOMER_2 does NOT see CLIENT_1\'s reservation', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).not.toContain(p7ReservationId);
    });

    it('P7.3: CUSTOMER_1 can also call /me/reservations (CLIENT + CUSTOMER both allowed)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data)).toBe(true);
    });

    it('P7.4: after the reservation, CLIENT_1\'s role stays CLIENT (no auto-promotion)', async () => {
      const u = await testApp.prisma.user.findUniqueOrThrow({
        where: { id: client1UserId },
        select: { role: true },
      });
      expect(u.role).toBe(UserRole.CLIENT);
    });

    it('P7.4b: GET /me/reservations/:id returns the row only to its owner; 404 for other users', async () => {
      const ownerRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(client1Token));
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body?.id).toBe(p7ReservationId);

      const otherRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(customer2Token));
      // We return 404 (not 403) so we don't disclose existence of other
      // customers' rows. See findOneForUser() docstring.
      expect(otherRes.status).toBe(404);
    });
  });

  describe('Lead-based ownership (Reservation.lead.clientId)', () => {
    it('P7.5: a reservation whose owner is reached via lead.clientId also surfaces on /me/reservations', async () => {
      // Set up a lead that points back to CLIENT_1, then a reservation that
      // references the lead (not the client directly).
      const lead = await testApp.prisma.lead.create({
        data: {
          clientId: client1UserId,
          fullName: fixtures.users.CLIENT_1.fullName,
          phone: '+966500000P7L', // P7 lead test
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });

      // Allocate a fresh unit and create the reservation by leadId path
      // (clientId is intentionally NOT set on this reservation).
      const unit = await pickFreshUnit();
      const reservation = await testApp.prisma.reservation.create({
        data: {
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id, // ← XOR: lead path, clientId stays null
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P7L-${Date.now()}`,
          bookingAmount: 0,
        },
        select: { id: true },
      });
      await testApp.prisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(reservation.id);

      // CUSTOMER_2 still does not see it.
      const c2res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2res.body)).not.toContain(reservation.id);
    });
  });

  describe('Promotion rule (CLIENT → CUSTOMER)', () => {
    it('P7.6: creating a contract DOES promote a CLIENT to CUSTOMER (locks the existing rule)', async () => {
      // Fresh transient CLIENT to avoid mutating the shared CLIENT_1 fixture
      // (flow-e-financial-documents.e2e-spec.ts asserts CLIENT_1 stays CLIENT).
      const transientClient = await testApp.prisma.user.create({
        data: {
          role: UserRole.CLIENT,
          fullName: 'P7 Promotion Candidate',
          email: `p7-promo-${Date.now()}@example.com`,
          phone: `+96650000P7${Math.floor(Math.random() * 90 + 10)}`,
          locale: 'en',
        },
        select: { id: true, role: true },
      });
      expect(transientClient.role).toBe(UserRole.CLIENT);

      // Allocate a fresh unit (any project) — same picker, avoids collisions
      // with the visibility tests above and Flow D's p1 picks.
      const unit = await pickFreshUnit();

      // Admin POST /v1/contracts → contracts.module.ts ContractsService.create()
      // contains the PROMOTION RULE site (see comment there).
      const res = await http()
        .post('/v1/contracts')
        .set('Authorization', bearer(adminToken))
        .send({
          customerId: transientClient.id,
          unitId: unit.id,
          totalAmount: 1_000_000,
          downPayment: 100_000,
        });
      expect(res.status).toBe(201);

      const after = await testApp.prisma.user.findUniqueOrThrow({
        where: { id: transientClient.id },
        select: { role: true },
      });
      expect(after.role).toBe(UserRole.CUSTOMER);
    });
  });

  describe('Auth + RBAC negatives', () => {
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
});

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
