/**
 * Merged e2e group 1: Health + me-scope + Flow-A + Flow-B + Flow-C
 *
 * All five specs share a single NestJS singleton (createE2ETestApp), so the
 * vm-context boot cost is paid once. Tokens are set up in a file-level
 * beforeAll; individual describe blocks reference them directly.
 */

import request from 'supertest';
import { LeadStage } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

// ── Shared module-level state ─────────────────────────────────────────────────

let testApp: TestApp;
let fixtures: E2EFixtures;
let adminToken: string;
let salesToken: string;
let broker1Token: string;
let broker2Token: string;
let customer1Token: string;
let customer2Token: string;

beforeAll(async () => {
  testApp = await createE2ETestApp();
  fixtures = await loadE2EFixtures(testApp.rawPrisma);
  [adminToken, salesToken, broker1Token, broker2Token, customer1Token, customer2Token] =
    await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
});

const http = () => request(testApp.app.getHttpServer());
const phoneFor = (slug: string) =>
  `+96650099${slug.replace(/\D/g, '').padStart(4, '0').slice(-4)}`;
const futureDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

// ═════════════════════════════════════════════════════════════════════════════
// Health (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Health (e2e)', () => {
  it('GET /health/live returns 200 { status: ok } without checking deps', async () => {
    const res = await http().get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 { status: ok } when DB is reachable', async () => {
    const res = await http().get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('GET /health/ready response body contains no secrets or URLs', async () => {
    const res = await http().get('/health/ready');
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toMatch(/postgres:\/\/|mysql:\/\/|redis:\/\/|password|secret|localhost:\d/i);
  });

  it('GET /health/ready returns x-request-id response header', async () => {
    const res = await http().get('/health/ready');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
  });

  it('echoes a valid incoming x-request-id back in the response', async () => {
    const myId = 'my-trace-id-abc';
    const res = await http().get('/health/live').set('x-request-id', myId);
    expect(res.headers['x-request-id']).toBe(myId);
  });

  it('replaces an unsafe incoming x-request-id with a generated UUID', async () => {
    const unsafe = '<script>bad</script>';
    const res = await http().get('/health/live').set('x-request-id', unsafe);
    expect(res.headers['x-request-id']).not.toBe(unsafe);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GET /health returns ok with a live DB connection', async () => {
    const res = await http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true });
    expect(Number.isFinite(Date.parse(res.body.time))).toBe(true);
  });

  it('GET /v1/projects (protected) without a token returns 401', async () => {
    const res = await http().get('/v1/projects');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// me/* scope audit (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('me/* scope audit (e2e)', () => {
  it('GET /v1/me returns ONLY the authenticated user', async () => {
    const res = await http().get('/v1/users/me').set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(fixtures.userIds.customer1UserId);
  });

  it("GET /v1/me/notifications shows only the caller's rows", async () => {
    const [c1res, c2res] = await Promise.all([
      http().get('/v1/me/notifications').set('Authorization', bearer(customer1Token)),
      http().get('/v1/me/notifications').set('Authorization', bearer(customer2Token)),
    ]);
    expect(c1res.status).toBe(200);
    expect(c2res.status).toBe(200);
    const c1Ids = collectIds(c1res.body);
    const c2Ids = collectIds(c2res.body);
    expect(c1Ids.length).toBeGreaterThan(0);
    expect(c2Ids.length).toBeGreaterThan(0);
    for (const id of c1Ids) expect(c2Ids).not.toContain(id);
  });

  it('GET /v1/me/notifications/unread-count is per-user', async () => {
    const [c1res, c2res] = await Promise.all([
      http().get('/v1/me/notifications/unread-count').set('Authorization', bearer(customer1Token)),
      http().get('/v1/me/notifications/unread-count').set('Authorization', bearer(customer2Token)),
    ]);
    expect(c1res.status).toBe(200);
    expect(c2res.status).toBe(200);
    expect(typeof c1res.body?.count).toBe('number');
    expect(typeof c2res.body?.count).toBe('number');
    expect(c1res.body.count).toBeGreaterThanOrEqual(1);
    expect(c2res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /v1/me/notifications/:id/read — cross-user denial: c1 cannot mark c2's notification", async () => {
    const customer2User = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Target = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test', readAt: null },
      select: { id: true },
    });

    const res = await http()
      .patch(`/v1/me/notifications/${c2Target.id}/read`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    const after = await testApp.rawPrisma.notification.findUniqueOrThrow({
      where: { id: c2Target.id },
      select: { readAt: true },
    });
    expect(after.readAt).toBeNull();
  });

  it("PATCH /v1/me/notifications/read-all — only marks the caller's own rows", async () => {
    const customer2User = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Before = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test' },
      select: { id: true, readAt: true },
    });

    const res = await http()
      .patch('/v1/me/notifications/read-all')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    const c2After = await testApp.rawPrisma.notification.findUniqueOrThrow({
      where: { id: c2Before.id },
      select: { readAt: true },
    });
    expect(c2After.readAt).toBe(c2Before.readAt);
  });

  describe('me/* RBAC negatives', () => {
    it('GET /v1/users/me without token → 401', async () => {
      const res = await http().get('/v1/users/me');
      expect(res.status).toBe(401);
    });
    it('GET /v1/me/notifications/unread-count without token → 401', async () => {
      const res = await http().get('/v1/me/notifications/unread-count');
      expect(res.status).toBe(401);
    });
    it('PATCH /v1/me/notifications/read-all without token → 401', async () => {
      const res = await http().patch('/v1/me/notifications/read-all');
      expect(res.status).toBe(401);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow A — Catalog sync (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow A — Catalog sync (e2e)', () => {
  describe('A1/A2 — admin can read the seeded project + unit', () => {
    it('A1: GET /v1/projects/:p1Id returns p1 to admin', async () => {
      const res = await http()
        .get(`/v1/projects/${fixtures.projects.p1Id}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.projects.p1Id);
    });

    it('A2: GET /v1/units/:unitId returns the seeded sample unit to admin', async () => {
      const res = await http()
        .get(`/v1/units/${fixtures.units.sampleUnitInP1Id}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.units.sampleUnitInP1Id);
    });

    it('A2(sanity): the unit exists in the DB at the same ID', async () => {
      const row = await testApp.rawPrisma.unit.findUnique({
        where: { id: fixtures.units.sampleUnitInP1Id },
        select: { id: true },
      });
      expect(row?.id).toBe(fixtures.units.sampleUnitInP1Id);
    });
  });

  describe('A3 — public catalog exposes the public project + unit', () => {
    it('GET /v1/public/projects (no auth) returns p1 in the result set', async () => {
      const res = await http().get('/v1/public/projects');
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.projects.p1Id);
    });

    it('GET /v1/public/projects/:p1Id (no auth) returns 200', async () => {
      const res = await http().get(`/v1/public/projects/${fixtures.projects.p1Id}`);
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.projects.p1Id);
    });

    it('GET /v1/public/units (no auth) includes the sample unit', async () => {
      const res = await http().get('/v1/public/units');
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  describe('A4 — Sales sees the private catalog', () => {
    it('GET /v1/projects as sales lists all seeded projects', async () => {
      const res = await http().get('/v1/projects').set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toEqual(
        expect.arrayContaining([
          fixtures.projects.p1Id,
          fixtures.projects.p2Id,
          fixtures.projects.p3Id,
        ]),
      );
    });

    it('GET /v1/units as sales includes the sample unit', async () => {
      const res = await http().get('/v1/units').set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  describe('A5 — Broker1 portal returns only the broker1-granted projects', () => {
    it('GET /v1/portal/projects as broker1 returns exactly {p1, p2}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body, true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p1Id, fixtures.projects.p2Id]));
    });
  });

  describe('A6 — Broker2 cannot see broker1-only projects', () => {
    it('GET /v1/portal/projects as broker2 returns exactly {p3}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body, true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p3Id]));
      expect(ids).not.toContain(fixtures.projects.p1Id);
      expect(ids).not.toContain(fixtures.projects.p2Id);
    });
  });

  describe('A7 — unauthorized access to protected endpoints fails closed', () => {
    it('GET /v1/projects with NO token → 401', async () => {
      expect((await http().get('/v1/projects')).status).toBe(401);
    });
    it('GET /v1/portal/projects with NO token → 401', async () => {
      expect((await http().get('/v1/portal/projects')).status).toBe(401);
    });
    it('GET /v1/projects as CUSTOMER (wrong role) → 403', async () => {
      expect(
        (await http().get('/v1/projects').set('Authorization', bearer(customer1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/portal/projects as SALES (wrong role) → 403', async () => {
      expect(
        (await http().get('/v1/portal/projects').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });

  describe('A8 — guest can reach public endpoints only', () => {
    it('GET /v1/public/projects without auth → 200', async () => {
      expect((await http().get('/v1/public/projects')).status).toBe(200);
    });
    it('GET /v1/public/units without auth → 200', async () => {
      expect((await http().get('/v1/public/units')).status).toBe(200);
    });
    it('GET /v1/projects without auth → 401', async () => {
      expect((await http().get('/v1/projects')).status).toBe(401);
    });
    it('GET /v1/public/projects/:NONEXISTENT → 404', async () => {
      expect(
        (await http().get('/v1/public/projects/00000000-0000-0000-0000-000000000000')).status,
      ).toBe(404);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow B — Lead journey (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow B — Lead journey (e2e)', () => {
  it('B1: POST /v1/public/info-request (no auth) creates a Lead linked to the new client', async () => {
    const phone = phoneFor('B1');
    const res = await http().post('/v1/public/info-request').send({
      message: 'I would like more info about your projects.',
      name: 'E2E B1 Visitor',
      phone,
      projectId: fixtures.projects.p1Id,
    });
    expect(res.status).toBe(201);

    const client = await testApp.rawPrisma.user.findUnique({
      where: { phone },
      select: { id: true, role: true, fullName: true },
    });
    expect(client).not.toBeNull();
    expect(client!.role).toBe('CLIENT');

    const lead = await testApp.rawPrisma.lead.findFirst({
      where: { clientId: client!.id },
      select: { id: true, stage: true, sourceId: true, projectInterestId: true },
    });
    expect(lead).not.toBeNull();
    expect(lead!.stage).toBe(LeadStage.NEW);
    expect(lead!.projectInterestId).toBe(fixtures.projects.p1Id);
  });

  it('B2: POST /v1/public/visit-request (no auth) creates a Lead AND a VisitRequest', async () => {
    const phone = phoneFor('B2');
    const res = await http().post('/v1/public/visit-request').send({
      name: 'E2E B2 Visitor',
      phone,
      projectId: fixtures.projects.p1Id,
      preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'phase 7b — visit request from public form',
    });
    expect(res.status).toBe(201);

    const client = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { phone },
      select: { id: true },
    });
    const lead = await testApp.rawPrisma.lead.findFirstOrThrow({
      where: { clientId: client.id },
      select: { id: true },
    });
    const vr = await testApp.rawPrisma.visitRequest.findFirst({
      where: { leadId: lead.id },
      select: { id: true, requestStatus: true, projectId: true },
    });
    expect(vr).not.toBeNull();
    expect(vr!.requestStatus).toBe('NEW');
    expect(vr!.projectId).toBe(fixtures.projects.p1Id);
  });

  it('B3: POST /v1/me/info-requests as CUSTOMER attributes the request to the auth user', async () => {
    const res = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(customer1Token))
      .send({
        message: 'phase 7b — authenticated customer info request',
        projectId: fixtures.projects.p1Id,
      });
    expect(res.status).toBe(201);

    const ir = await testApp.rawPrisma.infoRequest.findFirst({
      where: { userId: fixtures.userIds.customer1UserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, projectId: true, message: true },
    });
    expect(ir).not.toBeNull();
    expect(ir!.userId).toBe(fixtures.userIds.customer1UserId);
    expect(ir!.projectId).toBe(fixtures.projects.p1Id);
  });

  describe('B4–B7: sales lifecycle (create → advance stage → activity → note)', () => {
    let leadId: string;

    it('B4: SALES can POST /v1/leads with assignedSalesId=self', async () => {
      const phone = phoneFor('B4');
      const res = await http()
        .post('/v1/leads')
        .set('Authorization', bearer(salesToken))
        .send({
          fullName: 'E2E B4 Client',
          phone,
          projectInterestId: fixtures.projects.p1Id,
          assignedSalesId: fixtures.userIds.salesId,
        });
      expect(res.status).toBe(201);
      expect(typeof res.body?.id).toBe('string');
      leadId = res.body.id;

      const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { stage: true, assignedSalesId: true },
      });
      expect(row.assignedSalesId).toBe(fixtures.userIds.salesId);
      expect(row.stage).toBe(LeadStage.NEW);
    });

    it('B5: SALES can PATCH /v1/leads/:id/stage to INTERESTED', async () => {
      const res = await http()
        .patch(`/v1/leads/${leadId}/stage`)
        .set('Authorization', bearer(salesToken))
        .send({ stage: 'INTERESTED', reason: 'phase 7b — first follow-up call ok' });
      expect(res.status).toBe(200);

      const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { stage: true },
      });
      expect(row.stage).toBe(LeadStage.INTERESTED);
    });

    it('B6: stage change writes a LeadActivity row (type=status_change, from→to in payload)', async () => {
      const acts = await testApp.rawPrisma.leadActivity.findMany({
        where: { leadId, type: 'status_change' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, payload: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
      expect(acts[0]!.payload).toMatchObject({
        from: LeadStage.NEW,
        to: LeadStage.INTERESTED,
      });
    });

    it('B7: SALES can POST /v1/leads/:id/notes and the note appears on /v1/leads/:id', async () => {
      const noteRes = await http()
        .post(`/v1/leads/${leadId}/notes`)
        .set('Authorization', bearer(salesToken))
        .send({ body: 'phase 7b — qualified, scheduling visit' });
      expect(noteRes.status).toBe(201);

      const getRes = await http()
        .get(`/v1/leads/${leadId}`)
        .set('Authorization', bearer(salesToken));
      expect(getRes.status).toBe(200);
      const notes = getRes.body?.notes ?? [];
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.some((n: { body?: string }) => n.body?.includes('qualified'))).toBe(true);
    });
  });

  it('B8: ADMIN reads /v1/leads and sees the SALES-created leads', async () => {
    const res = await http().get('/v1/leads').set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('B9: broker1 creates a portal lead and sees it on /v1/portal/leads', async () => {
    const phone = phoneFor('B9');
    const createRes = await http()
      .post('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token))
      .send({
        fullName: 'E2E B9 Broker1 Lead',
        phone,
        projectInterestId: fixtures.projects.p1Id,
      });
    expect(createRes.status).toBe(201);
    const newLeadId: unknown = createRes.body?.id ?? createRes.body?.lead?.id;
    expect(typeof newLeadId).toBe('string');

    const listRes = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token));
    expect(listRes.status).toBe(200);
    expect(collectIds(listRes.body)).toContain(newLeadId as string);
  });

  it("B10: broker2 does NOT see broker1's portal leads", async () => {
    const listRes = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker2Token));
    expect(listRes.status).toBe(200);
    const ids = collectIds(listRes.body);
    const broker1Firm = await testApp.rawPrisma.broker.findUniqueOrThrow({
      where: { code: fixtures.brokerCodes.BROKER_1 },
      select: { id: true },
    });
    const broker1OwnedIds = (
      await testApp.rawPrisma.lead.findMany({
        where: { brokerId: broker1Firm.id },
        select: { id: true },
      })
    ).map((l) => l.id);
    expect(broker1OwnedIds.length).toBeGreaterThan(0);
    for (const id of broker1OwnedIds) expect(ids).not.toContain(id);
  });

  describe('B11: RBAC negatives on the lead surface', () => {
    it('GET /v1/leads without token → 401', async () => {
      expect((await http().get('/v1/leads')).status).toBe(401);
    });
    it('GET /v1/leads as CUSTOMER → 403', async () => {
      expect(
        (await http().get('/v1/leads').set('Authorization', bearer(customer1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/leads as BROKER → 403 (broker uses /portal/leads, not /leads)', async () => {
      expect(
        (await http().get('/v1/leads').set('Authorization', bearer(broker1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/portal/leads as SALES → 403', async () => {
      expect(
        (await http().get('/v1/portal/leads').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow C — Visit journey (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow C — Visit journey (e2e)', () => {
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
      expect(collectIds(res.body)).toContain(customer1RequestId);
    });

    it("C3: CUSTOMER_2 does NOT see CUSTOMER_1's visit request", async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(customer1RequestId);
    });

    it('C4: ADMIN sees the request on /v1/visits/requests', async () => {
      const res = await http()
        .get('/v1/visits/requests')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(customer1RequestId);
    });
  });

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
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/confirm`)
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

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

  describe('C10: RBAC negatives on the visit surface', () => {
    it('GET /v1/visits/appointments without token → 401', async () => {
      expect((await http().get('/v1/visits/appointments')).status).toBe(401);
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
    it('POST /v1/visits/appointments as BROKER → 403', async () => {
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
      expect(
        (await http().get('/v1/me/visit-requests').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectIds(body: unknown, preferProjectId = false): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (preferProjectId && row && typeof row === 'object' && 'project' in row) {
        const p = (row as { project?: { id?: unknown } }).project;
        if (p && typeof p === 'object' && typeof p.id === 'string') return p.id;
      }
      if (
        row &&
        typeof row === 'object' &&
        'id' in row &&
        typeof (row as { id?: unknown }).id === 'string'
      ) {
        return (row as { id: string }).id;
      }
      return undefined;
    })
    .filter((id): id is string => typeof id === 'string');
}
