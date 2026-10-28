/**
 * TFA1 — two-step sign-in with an authenticator app.
 *
 * - A staff member turns it on (scan, confirm with a code) and gets ten
 *   recovery codes. From then on the password alone gives no session: a
 *   challenge, traded with a code from the app (good once) or a recovery code
 *   (good once). The challenge is never an access token. Five wrong codes lock
 *   the step for 15 minutes.
 * - Off again needs the password and a code.
 * - The admin can require it (admins, or all staff): a member without it sets
 *   it up while signing in, and cannot turn it off. Reps cannot set the rule.
 * - A lost phone: the admin resets it for the account.
 */
import 'reflect-metadata';
import request from 'supertest';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { base32Decode, hotp, totpStep } from '../../src/common/security/totp';

const PASSWORD = 'Tfa1Pass123!';

describe('TFA1 — two-step sign-in (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  const stamp = Date.now().toString().slice(-7);
  const users: Record<'a' | 'b', { id: string; email: string }> = {} as never;

  const http = () => request(testApp.app.getHttpServer());
  const login = (email: string) => http().post('/v1/auth/login').send({ email, password: PASSWORD }).expect(201);
  /** A code for a step the account has not used yet (the next one). */
  const code = async (userId: string, secret: string) => {
    await testApp.rawPrisma.user.update({ where: { id: userId }, data: { totpLastStep: null } });
    return hotp(base32Decode(secret), totpStep());
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { companyId: true } })).companyId!;
    const passwordHash = await argon2.hash(PASSWORD);
    for (const [k, n] of [['a', 1], ['b', 2]] as const) {
      const email = `tfa1-${k}-${stamp}@example.com`;
      const u = await raw.user.create({ data: { companyId, fullName: `TFA1 ${k}`, email, phone: `+2012${n}${stamp}`, role: UserRole.SALES, active: true, passwordHash } });
      users[k] = { id: u.id, email };
    }
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.setting.deleteMany({ where: { companyId, key: 'security.require2fa' } });
    await raw.user.deleteMany({ where: { id: { in: Object.values(users).map((u) => u.id) } } });
  });

  it('TFA1-1: turn it on; the password then gives a challenge; a code or a recovery code, once each', async () => {
    const { id, email } = users.a;
    const token = (await login(email)).body.tokens.accessToken as string;
    const as = <T extends request.Test>(r: T) => r.set('Authorization', bearer(token));
    expect((await as(http().get('/v1/auth/2fa')).expect(200)).body).toMatchObject({ available: true, enabled: false, required: false });

    const { secret, otpauthUrl } = (await as(http().post('/v1/auth/2fa/setup')).expect(201)).body;
    expect(otpauthUrl).toContain(`secret=${secret}`);
    // Not stored as typed.
    const stored = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id }, select: { totpSecret: true } });
    expect(stored.totpSecret).not.toContain(secret);
    await as(http().post('/v1/auth/2fa/enable').send({ code: '000000' })).expect(400);
    const { recoveryCodes } = (await as(http().post('/v1/auth/2fa/enable').send({ code: await code(id, secret) })).expect(201)).body;
    expect(recoveryCodes).toHaveLength(10);
    expect((await as(http().get('/v1/auth/2fa')).expect(200)).body).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
    // The audit log keeps no recovery codes.
    const logged = JSON.stringify(
      (await testApp.rawPrisma.auditLog.findMany({ where: { actorId: id, entityType: 'v1/auth' }, select: { after: true } })).map((l) => l.after),
    );
    expect(logged).toContain('"recoveryCodes":"***REDACTED***"');
    expect(logged).not.toContain(recoveryCodes[0]);
    expect(logged).not.toContain(secret);

    // The password alone: a challenge, no tokens; the challenge is not a session.
    const step1 = (await login(email)).body;
    expect(step1).toEqual({ twoFactorRequired: true, challenge: expect.any(String) });
    await http().get('/v1/auth/2fa').set('Authorization', bearer(step1.challenge)).expect(401);
    await http().post('/v1/auth/2fa/verify').send({ challenge: step1.challenge, code: '123456' }).expect(401);
    const good = await code(id, secret);
    const signedIn = (await http().post('/v1/auth/2fa/verify').send({ challenge: step1.challenge, code: good }).expect(201)).body;
    expect(signedIn.tokens.accessToken).toBeTruthy();
    // The same code again is refused.
    await http().post('/v1/auth/2fa/verify').send({ challenge: (await login(email)).body.challenge, code: good }).expect(401);

    // A recovery code, once.
    const viaRecovery = (await http().post('/v1/auth/2fa/verify').send({ challenge: (await login(email)).body.challenge, code: recoveryCodes[0] }).expect(201)).body;
    expect(viaRecovery).toMatchObject({ usedRecoveryCode: true });
    await http().post('/v1/auth/2fa/verify').send({ challenge: (await login(email)).body.challenge, code: recoveryCodes[0] }).expect(401);
    // A setup challenge is not a verify challenge.
    await http().post('/v1/auth/2fa/setup-challenge').send({ challenge: step1.challenge }).expect(401);

    // Five wrong codes lock the step, even for a right one.
    await testApp.rawPrisma.user.update({ where: { id }, data: { totpFailures: 0 } });
    const ch = (await login(email)).body.challenge;
    for (let i = 0; i < 5; i++) await http().post('/v1/auth/2fa/verify').send({ challenge: ch, code: '000001' }).expect(401);
    await http().post('/v1/auth/2fa/verify').send({ challenge: ch, code: await code(id, secret) }).expect(429);
    await testApp.rawPrisma.user.update({ where: { id }, data: { totpLockedUntil: null } });

    // Off: password and a code.
    const t2 = signedIn.tokens.accessToken as string;
    await http().post('/v1/auth/2fa/disable').set('Authorization', bearer(t2)).send({ password: 'wrong-password', code: await code(id, secret) }).expect(400);
    await http().post('/v1/auth/2fa/disable').set('Authorization', bearer(t2)).send({ password: PASSWORD, code: await code(id, secret) }).expect(201);
    expect((await login(email)).body.tokens.accessToken).toBeTruthy();
  });

  it('TFA1-2: the admin requires it — set up while signing in, cannot be turned off; reps cannot set the rule; the admin resets a lost phone', async () => {
    const { id, email } = users.b;
    await http().put('/v1/auth/2fa/policy').set('Authorization', bearer(salesToken)).send({ mode: 'STAFF' }).expect(403);
    await http().put('/v1/auth/2fa/policy').set('Authorization', bearer(adminToken)).send({ mode: 'ANYONE' }).expect(400);
    await http().put('/v1/auth/2fa/policy').set('Authorization', bearer(adminToken)).send({ mode: 'STAFF' }).expect(200);
    expect((await http().get('/v1/auth/2fa/policy').set('Authorization', bearer(adminToken)).expect(200)).body).toEqual({ mode: 'STAFF' });

    const step1 = (await login(email)).body;
    expect(step1).toEqual({ twoFactorSetupRequired: true, challenge: expect.any(String) });
    await http().post('/v1/auth/2fa/verify').send({ challenge: step1.challenge, code: '123456' }).expect(401);
    const { secret } = (await http().post('/v1/auth/2fa/setup-challenge').send({ challenge: step1.challenge }).expect(201)).body;
    await http().post('/v1/auth/2fa/enable-challenge').send({ challenge: step1.challenge, code: '000000' }).expect(400);
    const done = (await http().post('/v1/auth/2fa/enable-challenge').send({ challenge: step1.challenge, code: await code(id, secret) }).expect(201)).body;
    expect(done.tokens.accessToken).toBeTruthy();
    expect(done.recoveryCodes).toHaveLength(10);
    const token = done.tokens.accessToken as string;
    expect((await http().get('/v1/auth/2fa').set('Authorization', bearer(token)).expect(200)).body).toMatchObject({ enabled: true, required: true });
    await http().post('/v1/auth/2fa/disable').set('Authorization', bearer(token)).send({ password: PASSWORD, code: await code(id, secret) }).expect(403);

    // The users list shows who has it on.
    const shown = (await http().get(`/v1/users/${id}`).set('Authorization', bearer(adminToken)).expect(200)).body;
    expect(shown.totpEnabledAt).toBeTruthy();
    expect(shown).not.toHaveProperty('totpSecret');

    // A lost phone: the admin resets it; with the rule on, it is set up again at sign-in.
    await http().post(`/v1/users/${id}/2fa/reset`).set('Authorization', bearer(salesToken)).expect(403);
    await http().post(`/v1/users/${id}/2fa/reset`).set('Authorization', bearer(adminToken)).expect(201);
    expect((await login(email)).body).toMatchObject({ twoFactorSetupRequired: true });
    expect(await testApp.rawPrisma.auditLog.findFirst({ where: { entityId: id, action: 'user.two_factor_reset' } })).toBeTruthy();

    // Rule off: the password is enough again.
    await http().put('/v1/auth/2fa/policy').set('Authorization', bearer(adminToken)).send({ mode: 'OFF' }).expect(200);
    expect((await login(email)).body.tokens.accessToken).toBeTruthy();
  });
});
