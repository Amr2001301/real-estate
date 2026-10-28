/**
 * SES1 — sessions (linked devices).
 *
 * - Every sign-in is a session the user sees with its device and when it was
 *   last used; refreshing keeps the same session.
 * - Ending a session cuts that device off at once — its access token stops
 *   working, not only its refresh token. "Sign out everywhere else" keeps the
 *   current one. Signing out ends the session.
 * - Only one's own sessions: another account's session id is not found.
 * - The admin can see where a staff member is signed in and sign them out
 *   everywhere; a rep cannot.
 */
import 'reflect-metadata';
import request from 'supertest';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const PASSWORD = 'Ses1Pass123!';

describe('SES1 — sessions (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let userId: string;
  const stamp = Date.now().toString().slice(-7);
  const email = `ses1-${stamp}@example.com`;

  const http = () => request(testApp.app.getHttpServer());
  const signIn = async (ua: string) => {
    const res = await http().post('/v1/auth/login').set('User-Agent', ua).send({ email, password: PASSWORD }).expect(201);
    return res.body.tokens as { accessToken: string; refreshToken: string };
  };
  const me = (token: string) => http().get('/v1/auth/sessions').set('Authorization', bearer(token));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    const { companyId } = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { companyId: true } });
    userId = (
      await raw.user.create({
        data: { companyId, fullName: 'SES1 Rep', email, phone: `+20128${stamp}`, role: UserRole.SALES, active: true, passwordHash: await argon2.hash(PASSWORD) },
      })
    ).id;
  });

  afterAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { id: userId } });
  });

  it('SES1-1: each sign-in is a session; refresh keeps it; ending one cuts that device off at once', async () => {
    const laptop = await signIn('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0');
    const phone = await signIn('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');

    const list = (await me(laptop.accessToken).expect(200)).body.data as Array<{ id: string; current: boolean; userAgent: string }>;
    expect(list).toHaveLength(2);
    const current = list.find((s) => s.current)!;
    expect(current.userAgent).toContain('Windows');
    const phoneSession = list.find((s) => !s.current)!;
    expect(phoneSession.userAgent).toContain('iPhone');

    // A refresh rotates the token but stays the same session.
    const renewed = (await http().post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(201)).body.tokens;
    expect((await me(laptop.accessToken).expect(200)).body.data).toHaveLength(2);

    // Not someone else's session.
    await http().delete(`/v1/auth/sessions/${phoneSession.id}`).set('Authorization', bearer(salesToken)).expect(404);

    await http().delete(`/v1/auth/sessions/${phoneSession.id}`).set('Authorization', bearer(laptop.accessToken)).expect(200);
    await me(renewed.accessToken).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: renewed.refreshToken }).expect(401);
    expect((await me(laptop.accessToken).expect(200)).body.data).toHaveLength(1);
  });

  it('SES1-2: sign out everywhere else keeps this one; signing out ends the session', async () => {
    const here = await signIn('Mozilla/5.0 (Macintosh) Safari/605.1');
    const there = await signIn('Dart/3.5 (dart:io)');
    const res = (await http().post('/v1/auth/sessions/revoke-others').set('Authorization', bearer(here.accessToken)).expect(201)).body;
    expect(res.ended).toBeGreaterThanOrEqual(1);
    await me(there.accessToken).expect(401);
    const left = (await me(here.accessToken).expect(200)).body.data;
    expect(left).toHaveLength(1);
    expect(left[0].current).toBe(true);

    await http().post('/v1/auth/logout').send({ refreshToken: here.refreshToken }).expect(201);
    await me(here.accessToken).expect(401);
  });

  it('SES1-3: the admin sees a staff member’s devices and signs them out everywhere; a rep cannot', async () => {
    const a = await signIn('Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0');
    const b = await signIn('Mozilla/5.0 (Android 14) Chrome/130.0 Mobile');
    const seen = (await http().get(`/v1/users/${userId}/sessions`).set('Authorization', bearer(adminToken)).expect(200)).body.data;
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toHaveProperty('current');

    await http().get(`/v1/users/${userId}/sessions`).set('Authorization', bearer(salesToken)).expect(403);
    await http().post(`/v1/users/${userId}/sessions/revoke`).set('Authorization', bearer(salesToken)).expect(403);

    const out = (await http().post(`/v1/users/${userId}/sessions/revoke`).set('Authorization', bearer(adminToken)).expect(201)).body;
    expect(out.ended).toBe(2);
    await me(a.accessToken).expect(401);
    await me(b.accessToken).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: b.refreshToken }).expect(401);
    const audit = await testApp.rawPrisma.auditLog.findFirst({ where: { entityId: userId, action: 'user.signed_out_everywhere' } });
    expect(audit).toBeTruthy();
    await http().get('/v1/users/00000000-0000-0000-0000-000000000000/sessions').set('Authorization', bearer(adminToken)).expect(404);
  });
});
