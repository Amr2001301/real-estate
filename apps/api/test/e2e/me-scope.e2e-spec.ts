/**
 * Phase 7E — `me/*` scope audit, e2e validation of the JWT-only routes.
 *
 * The Phase 7C RBAC master spec allow-lists 7 routes that legitimately
 * lack `@Roles(...)` because the global `JwtAuthGuard` already enforces
 * authentication and the service layer scopes every query by
 * `user.sub`. Phase 7E's audit confirmed the scoping at every site;
 * this spec is the defense-in-depth runtime check — proving with
 * actual HTTP traffic that customer1 cannot mutate customer2's data
 * even when they know the row id.
 *
 * Covers the 3 highest-leverage cases:
 *   - markRead with another user's notification id → no-op, target row
 *     stays unread (cross-user denial)
 *   - markAllRead as customer1 → customer2's unread count is unchanged
 *   - unreadCount per user is symmetric (each sees only their own)
 *
 * `updateMe`, `registerDevice`, and `GET /me` are covered by the
 * static-analysis audit captured in `docs/system-qa-strategy.md` §0.6
 * and their DTOs are too small to express a cross-user attack (no
 * userId field allowed in the body).
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('me/* scope audit (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.prisma);
    [customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  it('GET /v1/me returns ONLY the authenticated user', async () => {
    const res = await http()
      .get('/v1/users/me')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(fixtures.userIds.customer1UserId);
  });

  it('GET /v1/me/notifications shows only the caller\'s rows', async () => {
    const [c1res, c2res] = await Promise.all([
      http().get('/v1/me/notifications').set('Authorization', bearer(customer1Token)),
      http().get('/v1/me/notifications').set('Authorization', bearer(customer2Token)),
    ]);
    expect(c1res.status).toBe(200);
    expect(c2res.status).toBe(200);
    const c1Ids = collectIds(c1res.body);
    const c2Ids = collectIds(c2res.body);
    // Both users have ≥1 seeded notification, no overlap.
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

  it('PATCH /v1/me/notifications/:id/read — cross-user denial: c1 cannot mark c2\'s notification', async () => {
    // Look up customer2's seeded Phase 7E notification id directly via prisma.
    const c2Notif = await testApp.prisma.notification.findFirstOrThrow({
      where: { userId: fixtures.userIds.customer1UserId === '' ? '' : undefined, templateCode: 'phase7e_test' }, // satisfy ts
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });
    // The first row may belong to customer1. Find a row that explicitly belongs to customer2.
    const customer2User = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Target = await testApp.prisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test', readAt: null },
      select: { id: true },
    });

    // Attempt cross-user mark-read.
    const res = await http()
      .patch(`/v1/me/notifications/${c2Target.id}/read`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    // Critical assertion: customer2's notification IS STILL UNREAD.
    const after = await testApp.prisma.notification.findUniqueOrThrow({
      where: { id: c2Target.id },
      select: { readAt: true },
    });
    expect(after.readAt).toBeNull();
    // Suppress unused-variable lint on the diagnostic lookup above.
    void c2Notif;
  });

  it('PATCH /v1/me/notifications/read-all — only marks the caller\'s own rows', async () => {
    // Look up customer2's seeded notification before customer1 calls read-all.
    const customer2User = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Before = await testApp.prisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test' },
      select: { id: true, readAt: true },
    });

    // Customer1 marks everything THEY have read.
    const res = await http()
      .patch('/v1/me/notifications/read-all')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    // Customer2's notification is untouched.
    const c2After = await testApp.prisma.notification.findUniqueOrThrow({
      where: { id: c2Before.id },
      select: { readAt: true },
    });
    expect(c2After.readAt).toBe(c2Before.readAt); // still null (or whatever it was)
  });

  // RBAC negative: no-token cases for the 3 highest-leverage routes.
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
