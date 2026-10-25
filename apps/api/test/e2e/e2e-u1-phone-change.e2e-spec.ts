/**
 * U1 — a customer's phone changes only with a code sent to the new number.
 *
 * Before, PATCH /users/me wrote any typed number: a typo handed the account
 * to whoever held the mistyped number, who could sign in to it by OTP.
 *
 * - PATCH /users/me refuses a customer's phone change (PHONE_CHANGE_NEEDS_CODE).
 * - POST /auth/me/phone keeps the new number aside and sends it a code; the
 *   account keeps its number — an OTP sign-in to the new number does not
 *   reach it — until POST /auth/me/phone/confirm with that code.
 * - Sign-in codes and phone-change codes are not interchangeable.
 */
import 'reflect-metadata';
import { createHash } from 'crypto';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { listeningUrl } from '../helpers/listen';
import { bearer } from '../helpers/login';

describe('U1 — phone change confirmed by OTP (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let companyId: string;
  let slug: string;
  let customerId: string;
  let token: string;
  const stamp = Date.now().toString().slice(-7);
  const OLD = `+2010${stamp}1`;
  const NEW = `+2011${stamp}2`;
  const TAKEN = `+2012${stamp}3`;
  const CODE = '246810';
  const createdIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const asCustomer = <T extends request.Test>(r: T) => r.set('Authorization', bearer(token));
  const hash = (c: string) => createHash('sha256').update(c).digest('hex');
  /** The SMS goes to the console in tests: give the latest code a known value. */
  const knownCode = async (phone: string, purpose: string) => {
    const otp = await testApp.rawPrisma.otpCode.findFirstOrThrow({
      where: { phone, companyId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    await testApp.rawPrisma.otpCode.update({ where: { id: otp.id }, data: { codeHash: hash(CODE) } });
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    await testApp.flushCapabilities(companyId);
    const customer = await testApp.rawPrisma.user.create({
      data: { role: UserRole.CUSTOMER, fullName: 'U1 Phone', phone: OLD, phoneVerifiedAt: new Date(), companyId },
    });
    customerId = customer.id;
    createdIds.push(customer.id);
    const other = await testApp.rawPrisma.user.create({
      data: { role: UserRole.CLIENT, fullName: 'U1 Other', phone: TAKEN, companyId },
    });
    createdIds.push(other.id);
    token = await testApp.signAccessToken(customer.id, UserRole.CUSTOMER);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const strangers = await raw.user.findMany({ where: { companyId, phone: NEW, id: { notIn: createdIds } }, select: { id: true } });
    const ids = [...createdIds, ...strangers.map((s) => s.id)];
    await raw.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await raw.otpCode.deleteMany({ where: { phone: { in: [OLD, NEW, TAKEN] } } });
    await raw.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('U1P-1: a customer cannot change the phone by a profile edit', async () => {
    const res = await asCustomer(http().patch('/v1/users/me')).send({ fullName: 'U1 Phone', phone: NEW });
    expect(res.status).toBe(400);
    expect(res.body.code ?? res.body.message?.code).toBe('PHONE_CHANGE_NEEDS_CODE');
    const user = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.phone).toBe(OLD);
    // Resending the current number with other edits still works.
    await asCustomer(http().patch('/v1/users/me')).send({ fullName: 'U1 Phone Renamed', phone: OLD }).expect(200);
  });

  it('U1P-2: requesting a change keeps the old number; a sign-in to the new one does not reach the account', async () => {
    const res = await asCustomer(http().post('/v1/auth/me/phone')).send({ phone: NEW }).expect(201);
    expect(res.body.pendingPhone).toBe(NEW);
    const user = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.phone).toBe(OLD);
    expect(user.pendingPhone).toBe(NEW);

    // Whoever holds the new number signs in by OTP: a different account.
    await testApp.rawPrisma.otpCode.create({
      data: { phone: NEW, codeHash: hash('135790'), expiresAt: new Date(Date.now() + 600_000), companyId },
    });
    const login = await http().post('/v1/auth/tenant/otp/verify').send({ slug, phone: NEW, code: '135790' });
    expect(login.status).toBe(201);
    expect(login.body.user.id).not.toBe(customerId);
    // That account now holds the number: the change cannot complete.
    await testApp.rawPrisma.user.deleteMany({ where: { id: login.body.user.id } });
  });

  it('U1P-3: a sign-in code does not confirm a phone change, and a wrong code is refused', async () => {
    await testApp.rawPrisma.otpCode.updateMany({ where: { phone: NEW, purpose: 'PHONE_CHANGE' }, data: { consumed: true } });
    await testApp.rawPrisma.otpCode.create({
      data: { phone: NEW, codeHash: hash(CODE), expiresAt: new Date(Date.now() + 600_000), companyId },
    });
    await asCustomer(http().post('/v1/auth/me/phone/confirm')).send({ code: CODE }).expect(400);
    expect((await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } })).phone).toBe(OLD);
  });

  it('U1P-4: the code sent to the new number changes it, verified', async () => {
    await testApp.rawPrisma.otpCode.deleteMany({ where: { phone: NEW } });
    // A minute between codes to the same number; let the test skip the wait.
    await asCustomer(http().post('/v1/auth/me/phone')).send({ phone: NEW }).expect(201);
    await knownCode(NEW, 'PHONE_CHANGE');
    await asCustomer(http().post('/v1/auth/me/phone/confirm')).send({ code: '000000' }).expect(400);
    await asCustomer(http().post('/v1/auth/me/phone/confirm')).send({ code: CODE }).expect(201);
    const user = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.phone).toBe(NEW);
    expect(user.pendingPhone).toBeNull();
    expect(user.phoneVerifiedAt).not.toBeNull();
    // A phone-change code is not a sign-in code either.
    const login = await http().post('/v1/auth/tenant/otp/verify').send({ slug, phone: NEW, code: CODE });
    expect(login.status).toBe(400);
  });

  it('U1P-5: a number held by another account is refused', async () => {
    const res = await asCustomer(http().post('/v1/auth/me/phone')).send({ phone: TAKEN });
    expect(res.status).toBe(409);
    expect((await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } })).pendingPhone).toBeNull();
  });

  it('U1P-6: sign-in codes — parallel guesses stay within five, a right code signs in once, a sixth code in the hour is refused', async () => {
    const PHONE = `+2013${stamp}4`;
    const base = await listeningUrl(testApp.app);
    const verify = (code: string) => request(base).post('/v1/auth/tenant/otp/verify').send({ slug, phone: PHONE, code });
    try {
      // Nine wrong guesses at once: five are checked, the rest refused unchecked.
      const otp = await testApp.rawPrisma.otpCode.create({
        data: { phone: PHONE, codeHash: hash(CODE), expiresAt: new Date(Date.now() + 600_000), companyId },
      });
      const guesses = await Promise.all(Array.from({ length: 9 }, () => verify('000000')));
      const statuses = guesses.map((r) => r.status);
      expect(statuses.filter((s) => s === 401)).toHaveLength(5);
      expect(statuses.filter((s) => s === 403)).toHaveLength(4);
      expect((await testApp.rawPrisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } })).attempts).toBe(5);
      await verify(CODE).expect(403); // even the right code, now

      // The right code twice at once: one session.
      await testApp.rawPrisma.otpCode.create({
        data: { phone: PHONE, codeHash: hash('112233'), expiresAt: new Date(Date.now() + 600_000), companyId },
      });
      const both = (await Promise.all([verify('112233'), verify('112233')])).map((r) => r.status).sort();
      expect(both.filter((s) => s === 200 || s === 201)).toHaveLength(1);

      // Five codes already sent this hour: no sixth (older than a minute, so
      // the per-minute wait is not what refuses it).
      await testApp.rawPrisma.otpCode.updateMany({ where: { phone: PHONE }, data: { createdAt: new Date(Date.now() - 120_000) } });
      await testApp.rawPrisma.otpCode.createMany({
        data: Array.from({ length: 3 }, () => ({
          phone: PHONE, codeHash: 'x', expiresAt: new Date(), companyId, createdAt: new Date(Date.now() - 300_000),
        })),
      });
      await http().post('/v1/auth/tenant/otp/request').send({ slug, phone: PHONE }).expect(429);
    } finally {
      await testApp.rawPrisma.otpCode.deleteMany({ where: { phone: PHONE } });
      const signedUp = await testApp.rawPrisma.user.findMany({ where: { companyId, phone: PHONE }, select: { id: true } });
      for (const u of signedUp) {
        await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await testApp.rawPrisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
      }
    }
  });
});
