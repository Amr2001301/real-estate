/**
 * Password reset flow — real Postgres e2e.
 *
 * Two concerns are tested separately:
 *
 *  EMAIL CAPTURE (R1-R3): verifies the forgotPassword endpoint calls
 *  sendPasswordReset with a raw token and stores only the SHA-256 hash.
 *  These use the StubEmailService (which replaces EmailService in the
 *  NestJS DI container) and work reliably in top-level it() blocks.
 *
 *  RESET ENDPOINT (R4-R11): verifies resetPassword security invariants.
 *  These insert reset tokens directly into the DB (known raw token → known
 *  hash) so the tests are independent of the email delivery path.
 *
 * Together they provide full coverage of the spec without coupling email
 * delivery reliability to the reset-password assertions.
 */

import request from 'supertest';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { EmailService } from '../../src/modules/auth/email.service';
import { DateSerializerInterceptor } from '../../src/common/interceptors/date-serializer.interceptor';
import { requestIdMiddleware } from '../../src/common/logging/request-id.middleware';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';

// ── Stub ─────────────────────────────────────────────────────────────────────

class StubEmailService {
  lastTo: string | undefined;
  lastRawToken: string | undefined;
  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    this.lastTo = to;
    this.lastRawToken = rawToken;
  }
}

// ── App factory ───────────────────────────────────────────────────────────────

interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  rawPrisma: PrismaClient;
  email: StubEmailService;
  close: () => Promise<void>;
}

async function createTestApp(): Promise<TestApp> {
  const emailStub = new StubEmailService();
  const noopStorage = {
    increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(emailStub)
    .overrideProvider(ThrottlerStorage)
    .useValue(noopStorage)
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', '/'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new DateSerializerInterceptor());
  await app.init();
  const prisma = app.get(PrismaService);
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();
  return {
    app, prisma, rawPrisma, email: emailStub,
    close: async () => { await rawPrisma.$disconnect(); await app.close(); },
  };
}

// ── Helper: insert a known reset token directly in the DB ─────────────────────

async function insertResetToken(
  prisma: PrismaClient,
  userId: string,
  rawToken: string,
  opts: { expired?: boolean } = {},
): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = opts.expired
    ? new Date(Date.now() - 1_000)
    : new Date(Date.now() + 20 * 60_000);
  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
}

const http = (a: TestApp) => request(a.app.getHttpServer());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Password reset flow (e2e, real Postgres)', () => {
  let testApp: TestApp;
  let userId: string;

  const USER_EMAIL = `pwr-test-${Date.now()}@example.com`;
  const INITIAL_PW = 'InitialPass123!';
  const NEW_PW = 'NewSecurePass456!';

  beforeAll(async () => {
    testApp = await createTestApp();

    const reg = await http(testApp)
      .post('/v1/auth/customer/register')
      .send({
        fullName: 'Password Reset Test User',
        phone: `+9665${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: USER_EMAIL,
        password: INITIAL_PW,
        acceptTerms: true,
      });
    expect(reg.status).toBe(201);

    const u = await testApp.rawPrisma.user.findUnique({ where: { email: USER_EMAIL } });
    userId = u!.id;
  }, 30_000);

  afterAll(async () => {
    await testApp.close();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // EMAIL CAPTURE TESTS  (top-level it() — stub reliably captured here)
  // ────────────────────────────────────────────────────────────────────────────

  it('R1: POST /forgot-password returns 201 + stub captures the raw token', async () => {
    testApp.email.lastRawToken = undefined;
    const res = await http(testApp)
      .post('/v1/auth/forgot-password')
      .send({ email: USER_EMAIL });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(testApp.email.lastRawToken).toBeTruthy();
  });

  it('R2: POST /forgot-password returns 201 for unknown email (no enumeration)', async () => {
    testApp.email.lastRawToken = undefined;
    const res = await http(testApp)
      .post('/v1/auth/forgot-password')
      .send({ email: 'nobody-xyz-7890@example.com' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(testApp.email.lastRawToken).toBeUndefined();
  });

  it('R3: only the SHA-256 hash of the raw token is stored in DB', async () => {
    testApp.email.lastRawToken = undefined;
    await http(testApp)
      .post('/v1/auth/forgot-password')
      .send({ email: USER_EMAIL });

    const rawToken = testApp.email.lastRawToken!;
    expect(rawToken).toBeTruthy();

    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.passwordResetToken.findFirst({
      where: { tokenHash: expectedHash },
    });
    expect(record).not.toBeNull();
    expect(record!.consumedAt).toBeNull();
    // Raw token must NOT be stored — only the hash.
    expect(record!.tokenHash).not.toBe(rawToken);
    expect(record!.tokenHash).toBe(expectedHash);
  });

  it('R3b: previous active tokens invalidated when a new reset is requested', async () => {
    // Request A
    testApp.email.lastRawToken = undefined;
    await http(testApp).post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    const rawA = testApp.email.lastRawToken!;
    expect(rawA).toBeTruthy();
    const hashA = createHash('sha256').update(rawA).digest('hex');

    // Request B — should mark token A consumed
    testApp.email.lastRawToken = undefined;
    await http(testApp).post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    expect(testApp.email.lastRawToken).toBeTruthy();

    // Token A is now consumed
    const recordA = await testApp.rawPrisma.passwordResetToken.findUnique({ where: { tokenHash: hashA } });
    expect(recordA?.consumedAt).not.toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // RESET ENDPOINT TESTS  (direct DB token insertion — deterministic)
  // ────────────────────────────────────────────────────────────────────────────

  it('R4: POST /reset-password rejects a token that does not exist', async () => {
    const res = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: 'completely-invalid-token', newPassword: NEW_PW });
    expect(res.status).toBe(400);
  });

  it('R5: POST /reset-password rejects an expired token', async () => {
    const rawToken = `expired-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken, { expired: true });

    const res = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(res.status).toBe(400);
  });

  it('R6: POST /reset-password succeeds with a valid token', async () => {
    const rawToken = `valid-reset-r6-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);

    const res = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('R7: new password works for login after reset', async () => {
    const res = await http(testApp)
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: NEW_PW });
    expect(res.status).toBe(201);
    expect(res.body.tokens.accessToken).toBeTruthy();
  });

  it('R8: old password no longer works after reset', async () => {
    const res = await http(testApp)
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: INITIAL_PW });
    expect(res.status).toBe(401);
  });

  it('R9: all pre-reset refresh tokens are revoked', async () => {
    // Log in with NEW_PW to get a refresh token, then reset again. The
    // refresh token issued before the second reset must be revoked.
    const login = await http(testApp)
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: NEW_PW });
    expect(login.status).toBe(201);
    const preResetRefresh = login.body.tokens.refreshToken as string;

    const rawToken = `valid-reset-r9-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);
    const reset = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: INITIAL_PW }); // reset back
    expect(reset.status).toBe(201);

    // Pre-reset refresh token must now be invalid
    const refresh = await http(testApp)
      .post('/v1/auth/refresh')
      .send({ refreshToken: preResetRefresh });
    expect(refresh.status).toBe(401);
  });

  it('R9a: DB password hash matches argon2 hash of current password', async () => {
    const user = await testApp.rawPrisma.user.findUnique({
      where: { email: USER_EMAIL },
      select: { passwordHash: true },
    });
    // Password is INITIAL_PW again after R9 reset-back
    const ok = await argon2.verify(user!.passwordHash!, INITIAL_PW);
    expect(ok).toBe(true);
  });

  it('R10: used reset token cannot be replayed (single-use)', async () => {
    const rawToken = `replay-test-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);

    const first = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(first.status).toBe(201);

    const second = await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: INITIAL_PW });
    expect(second.status).toBe(400);
  });

  it('R11: consumed reset token in DB has consumedAt set', async () => {
    const rawToken = `consumed-check-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);

    // Consume it
    await http(testApp)
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: INITIAL_PW });

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    expect(record?.consumedAt).not.toBeNull();
    expect(record?.consumedAt).toBeInstanceOf(Date);
  });
});
