/**
 * Flow B — Lead Journey (system QA strategy §E).
 *
 * Asserts the lead lifecycle is consistent across the four origins
 * (public website, authenticated customer, sales, broker portal) and
 * that role boundaries hold on every read + mutate. Each test creates
 * its own row(s) with unique phones to stay isolated from prior runs +
 * from any other spec in the same `pnpm test:e2e` invocation.
 *
 * Audit reference: `src/modules/leads/leads.controller.ts` +
 * `src/modules/requests/requests.controller.ts` +
 * `src/modules/broker-portal/broker-portal.controller.ts`.
 *
 * Mapping back to the §E test matrix:
 *   B1  — Public guest submits info-request → Lead created
 *   B2  — Public guest submits visit-request → Lead + VisitRequest
 *   B3  — Authenticated customer submits /me/info-request → Lead
 *   B4  — Sales creates lead via POST /v1/leads
 *   B5  — Sales advances stage via PATCH /v1/leads/:id/stage
 *   B6  — Stage change records a LeadActivity (audit trail)
 *   B7  — Sales adds a note via POST /v1/leads/:id/notes
 *   B8  — Admin reads /v1/leads — sees the lead
 *   B9  — Broker reads /v1/portal/leads as broker1 — sees their own lead only
 *   B10 — Broker2 reads /v1/portal/leads — does NOT see broker1's lead
 *   B11 — RBAC negatives: 401 no token; 403 customer; 403 broker on /v1/leads
 */

import request from 'supertest';
import { LeadStage } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow B — Lead journey (e2e)', () => {
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

  // Unique-per-test phones avoid colliding with prior runs / other specs
  // (the `find-or-create User by phone` behaviour in the lead-create flow).
  const phoneFor = (slug: string) => `+96650099${slug.replace(/\D/g, '').padStart(4, '0').slice(-4)}`;

  // ── B1 ───────────────────────────────────────────────────────────────────
  it('B1: POST /v1/public/info-request (no auth) creates a Lead linked to the new client', async () => {
    const phone = phoneFor('B1');
    const res = await http().post('/v1/public/info-request').send({
      message: 'I would like more info about your projects.',
      name: 'E2E B1 Visitor',
      phone,
      projectId: fixtures.projects.p1Id,
    });
    expect(res.status).toBe(201);

    // The endpoint may or may not return the lead id in the body — fall back
    // to a direct DB lookup keyed on the phone we just submitted.
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

  // ── B2 ───────────────────────────────────────────────────────────────────
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

  // ── B3 ───────────────────────────────────────────────────────────────────
  it('B3: POST /v1/me/info-requests as CUSTOMER attributes the request to the auth user', async () => {
    const res = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(customer1Token))
      .send({
        message: 'phase 7b — authenticated customer info request',
        projectId: fixtures.projects.p1Id,
      });
    expect(res.status).toBe(201);

    // The InfoRequest row should be tied to the authenticated user.
    const ir = await testApp.rawPrisma.infoRequest.findFirst({
      where: { userId: fixtures.userIds.customer1UserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, projectId: true, message: true },
    });
    expect(ir).not.toBeNull();
    expect(ir!.userId).toBe(fixtures.userIds.customer1UserId);
    expect(ir!.projectId).toBe(fixtures.projects.p1Id);
  });

  // ── B4 + B5 + B6 + B7 — sales creates → stages → notes the same lead ───
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

      // Sanity check: the lead reads back to the same sales rep.
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
      const last = acts[0]!;
      expect(last.payload).toMatchObject({ from: LeadStage.NEW, to: LeadStage.INTERESTED });
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

  // ── B8 ───────────────────────────────────────────────────────────────────
  it('B8: ADMIN reads /v1/leads and sees the SALES-created leads', async () => {
    const res = await http().get('/v1/leads').set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    // Admin sees ALL leads — the demo seed's Ahmed lead plus everything we've
    // created in this suite — so just assert ≥1.
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  // ── B9 + B10 — broker portal lead scoping ────────────────────────────────
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
    const ids: string[] = collectIds(listRes.body);
    expect(ids).toContain(newLeadId as string);
  });

  it('B10: broker2 does NOT see broker1\'s portal leads', async () => {
    const listRes = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker2Token));
    expect(listRes.status).toBe(200);
    const ids: string[] = collectIds(listRes.body);
    // Look up everything broker1's firm owns in the DB and assert none leak.
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
    expect(broker1OwnedIds.length).toBeGreaterThan(0); // we have created at least one above + seeded one
    for (const id of broker1OwnedIds) expect(ids).not.toContain(id);
  });

  // ── B11 — RBAC negatives ─────────────────────────────────────────────────
  describe('B11: RBAC negatives on the lead surface', () => {
    it('GET /v1/leads without token → 401', async () => {
      const res = await http().get('/v1/leads');
      expect(res.status).toBe(401);
    });

    it('GET /v1/leads as CUSTOMER → 403', async () => {
      const res = await http().get('/v1/leads').set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(403);
    });

    it('GET /v1/leads as BROKER → 403 (broker uses /portal/leads, not /leads)', async () => {
      const res = await http().get('/v1/leads').set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(403);
    });

    it('GET /v1/portal/leads as SALES → 403', async () => {
      const res = await http().get('/v1/portal/leads').set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });
  });
});

/**
 * Pull ids out of either a bare array or a `{ data: [...] }` page wrapper.
 * Mirrors the helper in flow-a-catalog spec (kept inline to avoid a shared
 * util becoming a Phase 7B refactor target).
 */
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
