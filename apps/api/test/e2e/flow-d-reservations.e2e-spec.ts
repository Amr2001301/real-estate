/**
 * Flow D — Reservation Journey (system QA strategy §E).
 *
 * Asserts both origins of the reservation create flow and the
 * cross-tenancy scoping on reads. **Admin approval / status transitions
 * (approve / reject / cancel / convert) are out of Phase 7B scope** per
 * the audit (all four are `@PermissionsStrict` admin-only and warrant
 * their own dedicated phase to test the unit-lifecycle they drive).
 *
 * Audit reference: `src/modules/reservations/reservations.controller.ts`
 * + `src/modules/broker-portal/broker-portal.controller.ts` +
 * `broker-portal-reservations.service.ts`.
 *
 * Mapping back to the §E test matrix:
 *   D1  — Sales POST /v1/reservations with seeded available unit → 201,
 *         status=PENDING
 *   D2  — After D1 the unit's status is RESERVED in the DB
 *   D3  — Sales GET /v1/reservations sees the reservation they created
 *   D4  — Admin GET /v1/reservations sees the same row
 *   D5  — Broker1 POST /v1/portal/reservations with seeded approved lead
 *         + plan → 201, status=PENDING, brokerId attribution set
 *   D6  — Broker1 GET /v1/portal/reservations sees their reservation
 *   D7  — Broker2 GET /v1/portal/reservations does NOT see broker1's
 *   D8  — RBAC: SALES cannot read /v1/portal/reservations → 403
 *   D9  — RBAC: BROKER cannot POST /v1/reservations → 403
 *   D10 — RBAC: GUEST cannot read /v1/reservations → 401
 */

import request from 'supertest';
import { ReservationStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow D — Reservation journey (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;
  let broker2Token: string;
  let customer1Token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token, broker2Token, customer1Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
    ]);
  });

  afterAll(async () => {
    await testApp.close();
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
          // The plan template has duration options — the create DTO refuses
          // without one. Fixture exposes the first option (12 months @ 0%).
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
      // We don't even need a valid body — the role guard short-circuits first.
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

/** Pull ids out of either a bare array or `{ data: [...] }` page wrapper. */
function collectIds(body: unknown): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : undefined))
    .filter((id): id is string => typeof id === 'string');
}
