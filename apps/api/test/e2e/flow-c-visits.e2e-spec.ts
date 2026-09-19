/**
 * Flow C — Visit Journey (system QA strategy §E).
 *
 * Asserts the two-step visit lifecycle:
 *   - Customer creates a `VisitRequest` via `/me/visit-requests`;
 *   - Staff creates a `VisitAppointment` directly via `/visits/appointments`
 *     (the "walk-in" path) — the request→schedule conversion is ADMIN-only
 *     and intentionally out of Phase 7B scope per `visits:schedule`
 *     permission;
 *   - Sales walks the appointment through its state machine
 *     (SCHEDULED → CONFIRMED → COMPLETED), with a separate appointment
 *     used to test the CANCEL path so each path is exercised in isolation;
 *   - Terminal statuses block further transitions (audit gives 4xx).
 *
 * Audit reference: `src/modules/visits/visits.controller.ts`,
 * `src/modules/visits/visit-appointments.service.ts`.
 *
 * Mapping back to the §E test matrix:
 *   C1  — Customer creates VisitRequest (NEW status)
 *   C2  — Customer reads /me/visit-requests, sees only own
 *   C3  — Customer2 does NOT see customer1's requests
 *   C4  — Staff (admin) sees the request on /v1/visits/requests
 *   C5  — Sales directly creates a VisitAppointment (status=SCHEDULED)
 *   C6  — Sales confirms → CONFIRMED, VisitActivity logged
 *   C7  — Sales completes → COMPLETED, VisitActivity logged
 *   C8  — Sales cancels a SEPARATE appointment → CANCELLED
 *   C9  — Terminal-status barrier: cannot confirm a COMPLETED appointment
 *   C10 — RBAC negatives (401 no token; 403 broker; 403 customer)
 */

import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow C — Visit journey (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });


  const http = () => request(testApp.app.getHttpServer());
  const futureDate = (daysFromNow: number) =>
    new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

  // ── C1, C2, C3 — customer-side request + scoping ────────────────────────
  describe('C1–C3: customer creates VisitRequest, sees only own', () => {
    let customer1RequestId: string;

    it('C1: CUSTOMER_1 creates a visit request → 201, requestStatus=NEW', async () => {
      const res = await http()
        .post('/v1/me/visit-requests')
        .set('Authorization', bearer(customer1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          preferredDate: futureDate(5),
          notes: 'phase 7b — customer1 visit request',
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.visitRequest?.id;
      expect(typeof id).toBe('string');
      customer1RequestId = id as string;

      const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
        where: { id: customer1RequestId },
        select: { requestStatus: true, userId: true, projectId: true },
      });
      expect(row.requestStatus).toBe('NEW');
      expect(row.userId).toBe(fixtures.userIds.customer1UserId);
      expect(row.projectId).toBe(fixtures.projects.p1Id);
    });

    it('C2: CUSTOMER_1 GET /v1/me/visit-requests includes their own request', async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(customer1RequestId);
    });

    it('C3: CUSTOMER_2 does NOT see CUSTOMER_1\'s visit request', async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).not.toContain(customer1RequestId);
    });

    it('C4: ADMIN sees the request on /v1/visits/requests', async () => {
      const res = await http()
        .get('/v1/visits/requests')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(customer1RequestId);
    });
  });

  // ── C5, C6, C7 — sales walks SCHEDULED → CONFIRMED → COMPLETED ──────────
  describe('C5–C7: sales walks an appointment through SCHEDULED → CONFIRMED → COMPLETED', () => {
    let apptId: string;

    it('C5: SALES POST /v1/visits/appointments creates a direct appointment (SCHEDULED)', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(salesToken))
        .send({
          projectId: fixtures.projects.p1Id,
          unitId: fixtures.units.sampleUnitInP1Id,
          assignedSalesId: fixtures.userIds.salesId,
          scheduledAt: futureDate(3),
          durationMinutes: 60,
          customerName: 'E2E C5 Walk-in',
          customerPhone: '+966500099500',
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.appointment?.id;
      expect(typeof id).toBe('string');
      apptId = id as string;

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, assignedSalesId: true },
      });
      expect(row.status).toBe('SCHEDULED');
      expect(row.assignedSalesId).toBe(fixtures.userIds.salesId);
    });

    it('C6: SALES confirms → CONFIRMED, VisitActivity(VISIT_CONFIRMED) logged', async () => {
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/confirm`)
        .set('Authorization', bearer(salesToken))
        .send({ salesNotes: 'phase 7b — confirmed by phone' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, confirmedAt: true },
      });
      expect(row.status).toBe('CONFIRMED');
      expect(row.confirmedAt).not.toBeNull();

      const acts = await testApp.rawPrisma.visitActivity.findMany({
        where: { visitId: apptId, type: 'VISIT_CONFIRMED' },
        select: { id: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
    });

    it('C7: SALES completes → COMPLETED, VisitActivity(VISIT_COMPLETED) logged', async () => {
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/complete`)
        .set('Authorization', bearer(salesToken))
        .send({
          salesNotes: 'phase 7b — walk-through done',
          resultNotes: 'interested in 2-bed; will reserve',
        });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, completedAt: true },
      });
      expect(row.status).toBe('COMPLETED');
      expect(row.completedAt).not.toBeNull();

      const acts = await testApp.rawPrisma.visitActivity.findMany({
        where: { visitId: apptId, type: 'VISIT_COMPLETED' },
        select: { id: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
    });

    it('C9: terminal-status barrier — confirming a COMPLETED appointment fails (400/409/422)', async () => {
      // Don't pin the exact status code (varies between Nest exception filters
      // for invalid state transitions); just assert it's a 4xx.
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/confirm`)
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── C8 — separate appointment for the cancel path ────────────────────────
  it('C8: SALES creates a second appointment and cancels it → CANCELLED', async () => {
    const createRes = await http()
      .post('/v1/visits/appointments')
      .set('Authorization', bearer(salesToken))
      .send({
        projectId: fixtures.projects.p1Id,
        assignedSalesId: fixtures.userIds.salesId,
        scheduledAt: futureDate(7),
        customerName: 'E2E C8 To-be-cancelled',
        customerPhone: '+966500099501',
      });
    expect(createRes.status).toBe(201);
    const apptId = createRes.body?.id ?? createRes.body?.appointment?.id;

    const cancelRes = await http()
      .post(`/v1/visits/appointments/${apptId}/cancel`)
      .set('Authorization', bearer(salesToken))
      .send({ cancellationReason: 'phase 7b — cancel-path test' });
    expect(cancelRes.status).toBe(201);

    const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
      where: { id: apptId },
      select: { status: true, cancelledAt: true },
    });
    expect(row.status).toBe('CANCELLED');
    expect(row.cancelledAt).not.toBeNull();
  });

  // ── C10 — RBAC negatives ─────────────────────────────────────────────────
  describe('C10: RBAC negatives on the visit surface', () => {
    it('GET /v1/visits/appointments without token → 401', async () => {
      const res = await http().get('/v1/visits/appointments');
      expect(res.status).toBe(401);
    });

    it('POST /v1/visits/appointments as CUSTOMER → 403', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(customer1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          assignedSalesId: fixtures.userIds.salesId,
          scheduledAt: futureDate(2),
          customerName: 'x',
          customerPhone: '+966500099502',
        });
      expect(res.status).toBe(403);
    });

    it('POST /v1/visits/appointments as BROKER → 403 (brokers use /portal/visits/requests)', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(broker1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          scheduledAt: futureDate(2),
          customerName: 'x',
          customerPhone: '+966500099503',
        });
      expect(res.status).toBe(403);
    });

    it('GET /v1/me/visit-requests as SALES → 403 (customer surface)', async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
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
    .map((row) => (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : undefined))
    .filter((id): id is string => typeof id === 'string');
}
