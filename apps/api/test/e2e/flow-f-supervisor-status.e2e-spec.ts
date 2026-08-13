/**
 * Phase 7D — Maintenance supervisor status machine (system QA strategy §E).
 *
 * Walks the SUPERVISOR_TRANSITIONS subset:
 *
 *   ASSIGNED → IN_PROGRESS → RESOLVED   (forward)
 *   RESOLVED → IN_PROGRESS               (reopen — also allowed)
 *
 * and asserts the customer's detail view reflects each change. Phase 7D
 * extends `seed-e2e.ts` step 6 to assign the seeded customer1
 * maintenance request to `maintenance@example.com` and start it in
 * ASSIGNED so the spec can walk forward without an admin step in
 * between.
 *
 * Audit reference: `src/modules/maintenance/maintenance.module.ts`
 * (`@Roles(MAINTENANCE_SUPERVISOR) @Post('me/maintenance-requests/:id/status')`).
 *
 * Out of scope (admin-only transitions):
 *   OPEN → ASSIGNED, RESOLVED → CLOSED. The supervisor-restricted matrix
 *   forbids both; we assert the closed-state attempt is rejected in
 *   F_SUP_NEG.
 */

import request from 'supertest';
import { MaintenanceStatus } from '@prisma/client';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow F — Maintenance supervisor status machine (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let supervisorToken: string;
  let customer1Token: string;
  let salesToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [supervisorToken, customer1Token, salesToken] = await Promise.all([
      loginAs(testApp.app, 'maintenance@example.com', 'MaintenancePass123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());
  const reqId = () => fixtures.flowF.customer1MaintenanceRequestId;

  // ── F_SUP1 — supervisor sees the request on /me/maintenance-requests ───
  it('F_SUP1: supervisor GET /v1/me/maintenance-requests includes the assigned request', async () => {
    const res = await http()
      .get('/v1/me/maintenance-requests')
      .set('Authorization', bearer(supervisorToken));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    const ids = list.map((r: { id?: string }) => r.id).filter((x: unknown): x is string => typeof x === 'string');
    expect(ids).toContain(reqId());
  });

  // ── F_SUP2 — supervisor walks ASSIGNED → IN_PROGRESS ───────────────────
  it('F_SUP2: supervisor POST .../status IN_PROGRESS → 201, status flipped in DB', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(201);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.IN_PROGRESS);
  });

  // ── F_SUP3 — customer detail reflects the status change ────────────────
  it('F_SUP3: customer GET /v1/me/maintenance-requests/:id sees status=IN_PROGRESS', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${reqId()}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('IN_PROGRESS');
  });

  // ── F_SUP4 — supervisor walks IN_PROGRESS → RESOLVED ───────────────────
  it('F_SUP4: supervisor POST .../status RESOLVED → 201, status flipped', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(201);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.RESOLVED);
  });

  // ── F_SUP5 — customer sees RESOLVED ───────────────────────────────────
  it('F_SUP5: customer detail now shows status=RESOLVED', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${reqId()}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('RESOLVED');
  });

  // ── F_SUP_NEG — supervisor cannot push beyond their subset ─────────────
  it('F_SUP_NEG: supervisor RESOLVED → CLOSED is rejected (admin-only transition)', async () => {
    // SUPERVISOR_TRANSITIONS[RESOLVED] = [IN_PROGRESS] only.
    // CLOSED is admin-only; the supervisor endpoint must refuse 4xx.
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'CLOSED' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.RESOLVED); // unchanged
  });

  // ── F_SUP_RBAC — wrong roles cannot call the supervisor endpoint ───────
  describe('F_SUP_RBAC: wrong roles cannot call the supervisor status endpoint', () => {
    it('SALES POST .../status → 403', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .set('Authorization', bearer(salesToken))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
    });

    it('CUSTOMER POST .../status → 403', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .set('Authorization', bearer(customer1Token))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
    });

    it('no token POST .../status → 401', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(401);
    });
  });
});
