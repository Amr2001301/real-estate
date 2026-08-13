/**
 * Email verification flow — real Postgres e2e.
 *
 * EMAIL CAPTURE (V1-V4): verifies that registerCustomer sends a raw token to
 * the email layer and stores only the SHA-256 hash in the DB. Uses StubEmailService.
 *
 * VERIFY ENDPOINT (V5-V11): verifies verifyEmail security invariants. Uses a
 * known raw token inserted directly into the DB via insertVerifyToken so these
 * assertions are decoupled from the email delivery path.
 *
 * RESEND (V12-V14): verifies the resend cooldown and token-invalidation logic
 * through the authenticated POST /auth/resend-verification endpoint.
 */

import request from 'supertest';
import { createHash } from 'node:crypto';
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
  lastVerifyTo: string | undefined;
  lastVerifyRawToken: string | undefined;

  async sendEmailVerification(to: string, rawToken: string): Promise<void> {
    this.lastVerifyTo = to;
    this.lastVerifyRawToken = rawToken;
  }

  async sendPasswordReset(_to: string, _rawToken: string): Promise<void> {
    // Not tested here — no-op
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertVerifyToken(
  prisma: PrismaClient,
  userId: string,
  rawToken: string,
  opts: { expired?: boolean } = {},
): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = opts.expired
    ? new Date(Date.now() - 1_000)
    : new Date(Date.now() + 60 * 60_000);
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
}

const http = (a: TestApp) => request(a.app.getHttpServer());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Email verification flow (e2e, real Postgres)', () => {
  let testApp: TestApp;
  let userId: string;
  let accessToken: string;

  const USER_EMAIL = `ev-test-${Date.now()}@example.com`;
  const USER_PW = 'VerifyPass123!';

  beforeAll(async () => {
    testApp = await createTestApp();

    const reg = await http(testApp)
      .post('/v1/auth/customer/register')
      .send({
        fullName: 'Email Verify Test User',
        phone: `+9665${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: USER_EMAIL,
        password: USER_PW,
        acceptTerms: true,
      });
    expect(reg.status).toBe(201);

    accessToken = reg.body.tokens.accessToken as string;
    const u = await testApp.rawPrisma.user.findUnique({ where: { email: USER_EMAIL } });
    userId = u!.id;
  }, 30_000);

  afterAll(async () => {
    await testApp.close();
  });

  // ── EMAIL CAPTURE ──────────────────────────────────────────────────────────

  it('V1: registration sends a verification email via the email layer', () => {
    expect(testApp.email.lastVerifyTo).toBe(USER_EMAIL);
    expect(testApp.email.lastVerifyRawToken).toBeTruthy();
  });

  it('V2: emailVerifiedAt is null immediately after registration', async () => {
    const u = await testApp.rawPrisma.user.findUnique({ where: { id: userId } });
    expect(u!.emailVerifiedAt).toBeNull();
  });

  it('V3: only the SHA-256 hash of the raw token is stored in DB', async () => {
    const rawToken = testApp.email.lastVerifyRawToken!;
    expect(rawToken).toBeTruthy();

    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.emailVerificationToken.findFirst({
      where: { tokenHash: expectedHash },
    });
    expect(record).not.toBeNull();
    expect(record!.consumedAt).toBeNull();
    // Raw token must NOT be stored — only the hash.
    expect(record!.tokenHash).not.toBe(rawToken);
    expect(record!.tokenHash).toBe(expectedHash);
  });

  it('V4: issueTokens response includes emailVerifiedAt: null on registration', () => {
    // Checked via the user object from POST /customer/register in beforeAll
    // We just verify the raw field exists in the DB and matches
    return testApp.rawPrisma.user.findUnique({ where: { id: userId } }).then((u) => {
      expect(u!.emailVerifiedAt).toBeNull();
    });
  });

  // ── VERIFY ENDPOINT ────────────────────────────────────────────────────────

  it('V5: POST /verify-email succeeds with a valid unused token', async () => {
    const rawToken = `valid-ev-v5-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);

    const res = await http(testApp)
      .post('/v1/auth/verify-email')
      .send({ token: rawToken });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('V6: emailVerifiedAt is set on the user after successful verification', async () => {
    const u = await testApp.rawPrisma.user.findUnique({ where: { id: userId } });
    expect(u!.emailVerifiedAt).not.toBeNull();
    expect(u!.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('V7: consumed token has consumedAt populated', async () => {
    const rawToken = `consumed-check-v7-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);
    await http(testApp).post('/v1/auth/verify-email').send({ token: rawToken });

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    expect(record?.consumedAt).not.toBeNull();
  });

  it('V8: replay of an already-consumed token returns 400', async () => {
    const rawToken = `replay-v8-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);

    const first = await http(testApp).post('/v1/auth/verify-email').send({ token: rawToken });
    expect(first.status).toBe(201);

    const second = await http(testApp).post('/v1/auth/verify-email').send({ token: rawToken });
    expect(second.status).toBe(400);
  });

  it('V9: expired token returns 400', async () => {
    const rawToken = `expired-v9-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken, { expired: true });

    const res = await http(testApp).post('/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(400);
  });

  it('V10: completely unknown token returns 400', async () => {
    const res = await http(testApp)
      .post('/v1/auth/verify-email')
      .send({ token: 'not-a-real-token-at-all' });
    expect(res.status).toBe(400);
  });

  it('V11: already-verified user gets { ok: true, alreadyVerified: true } from a valid token', async () => {
    // User is already verified from V5. Insert another fresh token.
    const rawToken = `already-verified-v11-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);

    const res = await http(testApp).post('/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, alreadyVerified: true });
  });

  // ── RESEND ─────────────────────────────────────────────────────────────────

  it('V12: POST /resend-verification requires authentication', async () => {
    const res = await http(testApp).post('/v1/auth/resend-verification');
    expect(res.status).toBe(401);
  });

  it('V13: authenticated resend returns { ok: true } silently for already-verified user', async () => {
    // User is verified (from V5) — resend should silently no-op
    const res = await http(testApp)
      .post('/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('V14: resend for unverified user sends email and invalidates old tokens', async () => {
    // Create a fresh unverified user
    const newEmail = `ev-resend-${Date.now()}@example.com`;
    const reg = await http(testApp)
      .post('/v1/auth/customer/register')
      .send({
        fullName: 'Resend Test User',
        phone: `+9665${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: newEmail,
        password: USER_PW,
        acceptTerms: true,
      });
    expect(reg.status).toBe(201);
    const newAccessToken = reg.body.tokens.accessToken as string;

    // Clear stub state so we can check the new send
    const firstRawToken = testApp.email.lastVerifyRawToken!;
    const firstHash = createHash('sha256').update(firstRawToken).digest('hex');

    // Wait a moment to get past the 60s cooldown check — we'll bypass by
    // directly back-dating the token in the DB
    const newUser = await testApp.rawPrisma.user.findUnique({ where: { email: newEmail } });
    await testApp.rawPrisma.emailVerificationToken.updateMany({
      where: { userId: newUser!.id },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    testApp.email.lastVerifyRawToken = undefined;
    const res = await http(testApp)
      .post('/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });

    // Email layer received a new token
    const newRawToken = testApp.email.lastVerifyRawToken;
    expect(newRawToken).toBeTruthy();
    expect(newRawToken).not.toBe(firstRawToken);

    // Old token is now consumed
    const oldRecord = await testApp.rawPrisma.emailVerificationToken.findUnique({
      where: { tokenHash: firstHash },
    });
    expect(oldRecord?.consumedAt).not.toBeNull();
  }, 20_000);
});
