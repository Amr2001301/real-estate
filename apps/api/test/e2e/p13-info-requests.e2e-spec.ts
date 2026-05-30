/**
 * P13 — Info Requests admin visibility + notifications (e2e).
 *
 * Reproduces the manual-QA bug end-to-end against the real DB: a general
 * inquiry submitted from the public site must be visible to Admin AND must
 * notify ADMIN + SALES_MANAGER — for all three submitter types:
 *
 *   P13.1  GUEST    → POST /public/info-request (no auth) → row saved WITHOUT
 *                     userId, still visible in the admin list.
 *   P13.2  CLIENT   → POST /me/info-requests → row WITH userId, visible in the
 *                     customer's /me/info-requests AND the admin list.
 *   P13.3  CUSTOMER  → same as CLIENT.
 *   P13.4  Isolation — customer2 never sees customer1's inquiry.
 *   P13.5  Admin list — paginated {data, meta}; includes guest + client +
 *                     customer; carries submitter contact (user OR guest lead).
 *   P13.6  Notifications — ADMIN + SALES_MANAGER each receive an
 *                     info_request_created DB row (no Firebase), and the
 *                     payload exposes NO phone/email/message.
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('P13 — Info requests admin visibility + notifications (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let clientToken: string;
  let customer1Token: string;
  let customer2Token: string;

  // Unique guest contact so find-or-create never collides with seeded data.
  const GUEST_PHONE = '+966590001313';
  const GUEST_EMAIL = 'p13-guest@example.com';
  const GUEST_MSG = 'P13 guest inquiry — please call me back about availability';
  const CLIENT_MSG = 'P13 client inquiry from the portal';
  const CUSTOMER_MSG = 'P13 customer inquiry from the portal';

  let guestReqId: string;
  let clientReqId: string;
  let customer1ReqId: string;

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.prisma);

    [adminToken, clientToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    // GUEST — anonymous public submission with contact details + project.
    const guest = await http()
      .post('/v1/public/info-request')
      .send({
        message: GUEST_MSG,
        name: 'P13 Guest',
        phone: GUEST_PHONE,
        email: GUEST_EMAIL,
        projectId: fixtures.projects.p1Id,
      })
      .expect(201);
    guestReqId = guest.body.id;

    // CLIENT — logged-in browser.
    const client = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(clientToken))
      .send({ message: CLIENT_MSG })
      .expect(201);
    clientReqId = client.body.id;

    // CUSTOMER — logged-in owner.
    const customer = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(customer1Token))
      .send({ message: CUSTOMER_MSG })
      .expect(201);
    customer1ReqId = customer.body.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  // ── P13.1 / P13.2 / P13.3 — persistence + userId attribution ─────────────

  it('P13.1: guest inquiry is saved WITHOUT a userId', async () => {
    const row = await testApp.prisma.infoRequest.findUniqueOrThrow({
      where: { id: guestReqId },
      select: { userId: true, leadId: true },
    });
    expect(row.userId).toBeNull();
    expect(row.leadId).not.toBeNull(); // guest contact captured as a lead
  });

  it('P13.2: client inquiry is saved WITH the submitting client userId', async () => {
    const clientUser = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CLIENT_1.email },
      select: { id: true },
    });
    const row = await testApp.prisma.infoRequest.findUniqueOrThrow({
      where: { id: clientReqId },
      select: { userId: true },
    });
    expect(row.userId).toBe(clientUser.id);
  });

  it('P13.3: customer inquiry is saved WITH the customer userId and is visible in /me/info-requests', async () => {
    const res = await http()
      .get('/v1/me/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer1Token))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(customer1ReqId);
  });

  // ── P13.4 — cross-account isolation ──────────────────────────────────────

  it('P13.4: customer2 never sees customer1 inquiries in /me/info-requests', async () => {
    const res = await http()
      .get('/v1/me/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer2Token))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).not.toContain(customer1ReqId);
    expect(ids).not.toContain(clientReqId);
  });

  // ── P13.5 — admin list includes all three, paginated, with contact ───────

  it('P13.5: admin /info-requests is paginated and lists guest + client + customer inquiries', async () => {
    const res = await http()
      .get('/v1/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(adminToken))
      .expect(200);

    // Paginated shape.
    expect(res.body).toHaveProperty('meta.total');
    expect(Array.isArray(res.body.data)).toBe(true);

    const byId = new Map(
      (res.body.data as Array<Record<string, unknown>>).map((r) => [r.id as string, r]),
    );
    expect(byId.has(guestReqId)).toBe(true);
    expect(byId.has(clientReqId)).toBe(true);
    expect(byId.has(customer1ReqId)).toBe(true);

    // Guest row exposes contact via the lead (admin-facing surface).
    const guestRow = byId.get(guestReqId) as { userId: string | null; lead: { phone: string } | null };
    expect(guestRow.userId).toBeNull();
    expect(guestRow.lead?.phone).toBe(GUEST_PHONE);

    // Customer row exposes the linked user.
    const custRow = byId.get(customer1ReqId) as { user: { id: string } | null };
    expect(custRow.user?.id).toBe(fixtures.userIds.customer1UserId);
  });

  it('P13.5b: SALES_MANAGER can also read the admin info-requests list', async () => {
    const managerToken = await loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!');
    await http()
      .get('/v1/info-requests')
      .set('Authorization', bearer(managerToken))
      .expect(200);
  });

  // ── P13.6 — notifications for ADMIN + SALES_MANAGER, no PII ───────────────

  it('P13.6: ADMIN + SALES_MANAGER receive info_request_created notifications without phone/email', async () => {
    const [adminNotifs, managerNotifs] = await Promise.all([
      testApp.prisma.notification.findMany({
        where: {
          userId: fixtures.userIds.adminId,
          templateCode: 'info_request_created',
          payload: { path: ['requestId'], equals: guestReqId },
        },
        select: { payload: true },
      }),
      testApp.prisma.notification.findMany({
        where: {
          userId: fixtures.userIds.managerId,
          templateCode: 'info_request_created',
          payload: { path: ['requestId'], equals: guestReqId },
        },
        select: { id: true },
      }),
    ]);

    expect(adminNotifs.length).toBeGreaterThanOrEqual(1);
    expect(managerNotifs.length).toBeGreaterThanOrEqual(1);

    // Payload carries safe context only — never the inquirer's phone/email or
    // the message body.
    const serialised = JSON.stringify(adminNotifs);
    expect(serialised).not.toContain(GUEST_PHONE);
    expect(serialised).not.toContain(GUEST_EMAIL);
    expect(serialised).not.toContain(GUEST_MSG);
  });

  it('P13.6b: a plain SALES rep is NOT notified (no assignment/routing rule)', async () => {
    const salesNotifs = await testApp.prisma.notification.count({
      where: { userId: fixtures.userIds.salesId, templateCode: 'info_request_created' },
    });
    expect(salesNotifs).toBe(0);
  });
});
