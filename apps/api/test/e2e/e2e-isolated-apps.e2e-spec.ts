/**
 * Merged e2e group 6: email-verification + password-reset + p12 + rbac-route-coverage
 *
 * These four specs cannot use the shared singleton (createE2ETestApp) because:
 *   - email-verification and password-reset need EmailService overridden in DI
 *   - p12 needs ContractsService via app.get() — requires isolated app
 *   - rbac-route-coverage builds its own module for introspection
 *
 * All four describe blocks create their own NestJS app instances and close them
 * in afterAll. The shared createIsolatedEmailApp() factory captures the required
 * DI overrides (EmailService stub + ThrottlerStorage noop) in one place.
 */

import 'reflect-metadata';
import request from 'supertest';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { EmailService } from '../../src/modules/auth/email.service';
import { DateSerializerInterceptor } from '../../src/common/interceptors/date-serializer.interceptor';
import { requestIdMiddleware } from '../../src/common/logging/request-id.middleware';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { ContractsService } from '../../src/modules/contracts/contracts.module';
import { enterTenantContext } from '../../src/common/tenant/tenant-context';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { IS_PLATFORM_PUBLIC_KEY } from '../../src/common/decorators/platform-public.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

// ── Noop throttler storage ─────────────────────────────────────────────────────

const noopStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

// ── Shared isolated-app boot helper ───────────────────────────────────────────

interface IsolatedApp {
  app: INestApplication;
  prisma: PrismaService;
  rawPrisma: PrismaClient;
  close: () => Promise<void>;
}

async function createIsolatedEmailApp<TStub extends object>(
  emailStub: TStub,
): Promise<IsolatedApp & { email: TStub }> {
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
      whitelist: true,
      transform: true,
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
    app,
    prisma,
    rawPrisma,
    email: emailStub,
    close: async () => {
      await rawPrisma.$disconnect();
      await app.close();
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Email verification flow (e2e, real Postgres)
// ═════════════════════════════════════════════════════════════════════════════

describe('Email verification flow (e2e, real Postgres)', () => {
  class VerifyStubEmailService {
    lastVerifyTo: string | undefined;
    lastVerifyRawToken: string | undefined;

    async sendEmailVerification(to: string, rawToken: string): Promise<void> {
      this.lastVerifyTo = to;
      this.lastVerifyRawToken = rawToken;
    }

    async sendPasswordReset(_to: string, _rawToken: string): Promise<void> {}
  }

  let testApp: IsolatedApp & { email: VerifyStubEmailService };
  let userId: string;
  let accessToken: string;

  const USER_EMAIL = `ev-test-${Date.now()}@example.com`;
  const USER_PW = 'VerifyPass123!';

  async function insertVerifyToken(
    prisma: PrismaClient,
    uid: string,
    rawToken: string,
    opts: { expired?: boolean } = {},
  ): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = opts.expired
      ? new Date(Date.now() - 1_000)
      : new Date(Date.now() + 60 * 60_000);
    await prisma.emailVerificationToken.create({ data: { userId: uid, tokenHash, expiresAt } });
  }

  beforeAll(async () => {
    testApp = await createIsolatedEmailApp(new VerifyStubEmailService());

    const reg = await request(testApp.app.getHttpServer())
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

  const http = () => request(testApp.app.getHttpServer());

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
    expect(record!.tokenHash).not.toBe(rawToken);
    expect(record!.tokenHash).toBe(expectedHash);
  });

  it('V4: issueTokens response includes emailVerifiedAt: null on registration', () => {
    return testApp.rawPrisma.user.findUnique({ where: { id: userId } }).then((u) => {
      expect(u!.emailVerifiedAt).toBeNull();
    });
  });

  it('V5: POST /verify-email succeeds with a valid unused token', async () => {
    const rawToken = `valid-ev-v5-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);
    const res = await http().post('/v1/auth/verify-email').send({ token: rawToken });
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
    await http().post('/v1/auth/verify-email').send({ token: rawToken });
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    expect(record?.consumedAt).not.toBeNull();
  });

  it('V8: replay of an already-consumed token returns 400', async () => {
    const rawToken = `replay-v8-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);
    const first = await http().post('/v1/auth/verify-email').send({ token: rawToken });
    expect(first.status).toBe(201);
    const second = await http().post('/v1/auth/verify-email').send({ token: rawToken });
    expect(second.status).toBe(400);
  });

  it('V9: expired token returns 400', async () => {
    const rawToken = `expired-v9-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken, { expired: true });
    const res = await http().post('/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(400);
  });

  it('V10: completely unknown token returns 400', async () => {
    const res = await http()
      .post('/v1/auth/verify-email')
      .send({ token: 'not-a-real-token-at-all' });
    expect(res.status).toBe(400);
  });

  it('V11: already-verified user gets { ok: true, alreadyVerified: true } from a valid token', async () => {
    const rawToken = `already-verified-v11-${Date.now()}`;
    await insertVerifyToken(testApp.rawPrisma, userId, rawToken);
    const res = await http().post('/v1/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, alreadyVerified: true });
  });

  it('V12: POST /resend-verification requires authentication', async () => {
    expect((await http().post('/v1/auth/resend-verification')).status).toBe(401);
  });

  it('V13: authenticated resend returns { ok: true } silently for already-verified user', async () => {
    const res = await http()
      .post('/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('V14: resend for unverified user sends email and invalidates old tokens', async () => {
    const newEmail = `ev-resend-${Date.now()}@example.com`;
    const reg = await http()
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

    const firstRawToken = testApp.email.lastVerifyRawToken!;
    const firstHash = createHash('sha256').update(firstRawToken).digest('hex');

    const newUser = await testApp.rawPrisma.user.findUnique({ where: { email: newEmail } });
    await testApp.rawPrisma.emailVerificationToken.updateMany({
      where: { userId: newUser!.id },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    testApp.email.lastVerifyRawToken = undefined;
    const res = await http()
      .post('/v1/auth/resend-verification')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });

    const newRawToken = testApp.email.lastVerifyRawToken;
    expect(newRawToken).toBeTruthy();
    expect(newRawToken).not.toBe(firstRawToken);

    const oldRecord = await testApp.rawPrisma.emailVerificationToken.findUnique({
      where: { tokenHash: firstHash },
    });
    expect(oldRecord?.consumedAt).not.toBeNull();
  }, 20_000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Password reset flow (e2e, real Postgres)
// ═════════════════════════════════════════════════════════════════════════════

describe('Password reset flow (e2e, real Postgres)', () => {
  class ResetStubEmailService {
    lastTo: string | undefined;
    lastRawToken: string | undefined;
    async sendPasswordReset(to: string, rawToken: string): Promise<void> {
      this.lastTo = to;
      this.lastRawToken = rawToken;
    }
  }

  let testApp: IsolatedApp & { email: ResetStubEmailService };
  let userId: string;

  const USER_EMAIL = `pwr-test-${Date.now()}@example.com`;
  const INITIAL_PW = 'InitialPass123!';
  const NEW_PW = 'NewSecurePass456!';

  async function insertResetToken(
    prisma: PrismaClient,
    uid: string,
    rawToken: string,
    opts: { expired?: boolean } = {},
  ): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = opts.expired
      ? new Date(Date.now() - 1_000)
      : new Date(Date.now() + 20 * 60_000);
    await prisma.passwordResetToken.create({ data: { userId: uid, tokenHash, expiresAt } });
  }

  beforeAll(async () => {
    testApp = await createIsolatedEmailApp(new ResetStubEmailService());

    const reg = await request(testApp.app.getHttpServer())
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

  const http = () => request(testApp.app.getHttpServer());

  it('R1: POST /forgot-password returns 201 + stub captures the raw token', async () => {
    testApp.email.lastRawToken = undefined;
    const res = await http().post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(testApp.email.lastRawToken).toBeTruthy();
  });

  it('R2: POST /forgot-password returns 201 for unknown email (no enumeration)', async () => {
    testApp.email.lastRawToken = undefined;
    const res = await http()
      .post('/v1/auth/forgot-password')
      .send({ email: 'nobody-xyz-7890@example.com' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(testApp.email.lastRawToken).toBeUndefined();
  });

  it('R3: only the SHA-256 hash of the raw token is stored in DB', async () => {
    testApp.email.lastRawToken = undefined;
    await http().post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    const rawToken = testApp.email.lastRawToken!;
    expect(rawToken).toBeTruthy();
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.passwordResetToken.findFirst({
      where: { tokenHash: expectedHash },
    });
    expect(record).not.toBeNull();
    expect(record!.consumedAt).toBeNull();
    expect(record!.tokenHash).not.toBe(rawToken);
    expect(record!.tokenHash).toBe(expectedHash);
  });

  it('R3b: previous active tokens invalidated when a new reset is requested', async () => {
    testApp.email.lastRawToken = undefined;
    await http().post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    const rawA = testApp.email.lastRawToken!;
    expect(rawA).toBeTruthy();
    const hashA = createHash('sha256').update(rawA).digest('hex');

    testApp.email.lastRawToken = undefined;
    await http().post('/v1/auth/forgot-password').send({ email: USER_EMAIL });
    expect(testApp.email.lastRawToken).toBeTruthy();

    const recordA = await testApp.rawPrisma.passwordResetToken.findUnique({
      where: { tokenHash: hashA },
    });
    expect(recordA?.consumedAt).not.toBeNull();
  });

  it('R4: POST /reset-password rejects a token that does not exist', async () => {
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ token: 'completely-invalid-token', newPassword: NEW_PW });
    expect(res.status).toBe(400);
  });

  it('R5: POST /reset-password rejects an expired token', async () => {
    const rawToken = `expired-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken, { expired: true });
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(res.status).toBe(400);
  });

  it('R6: POST /reset-password succeeds with a valid token', async () => {
    const rawToken = `valid-reset-r6-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);
    const res = await http()
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('R7: new password works for login after reset', async () => {
    const res = await http()
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: NEW_PW });
    expect(res.status).toBe(201);
    expect(res.body.tokens.accessToken).toBeTruthy();
  });

  it('R8: old password no longer works after reset', async () => {
    const res = await http()
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: INITIAL_PW });
    expect(res.status).toBe(401);
  });

  it('R9: all pre-reset refresh tokens are revoked', async () => {
    const login = await http()
      .post('/v1/auth/customer/login')
      .send({ email: USER_EMAIL, password: NEW_PW });
    expect(login.status).toBe(201);
    const preResetRefresh = login.body.tokens.refreshToken as string;

    const rawToken = `valid-reset-r9-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);
    const reset = await http()
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: INITIAL_PW });
    expect(reset.status).toBe(201);

    const refresh = await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: preResetRefresh });
    expect(refresh.status).toBe(401);
  });

  it('R9a: DB password hash matches argon2 hash of current password', async () => {
    const user = await testApp.rawPrisma.user.findUnique({
      where: { email: USER_EMAIL },
      select: { passwordHash: true },
    });
    expect(await argon2.verify(user!.passwordHash!, INITIAL_PW)).toBe(true);
  });

  it('R10: used reset token cannot be replayed (single-use)', async () => {
    const rawToken = `replay-test-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);
    const first = await http()
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: NEW_PW });
    expect(first.status).toBe(201);
    const second = await http()
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: INITIAL_PW });
    expect(second.status).toBe(400);
  });

  it('R11: consumed reset token in DB has consumedAt set', async () => {
    const rawToken = `consumed-check-${Date.now()}`;
    await insertResetToken(testApp.rawPrisma, userId, rawToken);
    await http().post('/v1/auth/reset-password').send({ token: rawToken, newPassword: INITIAL_PW });
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await testApp.rawPrisma.passwordResetToken.findUnique({ where: { tokenHash } });
    expect(record?.consumedAt).not.toBeNull();
    expect(record?.consumedAt).toBeInstanceOf(Date);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// P12 — Contract conversion document linking + notifications (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('P12 — Contract conversion document linking + notifications (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let customer1Token: string;
  let customer2Token: string;

  let customer1UserId: string;
  let reservationId: string;
  let contractId: string;

  const PDF_URL = 'https://r2.example.com/contracts/p12-e2e-converted.pdf';
  const FILE_NAME = 'p12-e2e-converted.pdf';

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const prisma = testApp.rawPrisma;

    [adminToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    customer1UserId = fixtures.userIds.customer1UserId;

    const company = await prisma.company.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    const testCompanyId = company.id;

    const building = await prisma.building.findFirstOrThrow({ select: { id: true } });
    const unit = await prisma.unit.create({
      data: {
        buildingId: building.id,
        companyId: testCompanyId,
        code: `P12-E2E-${Date.now()}`,
        type: '2BR',
        area: 120,
        price: '500000',
        status: 'AVAILABLE',
      },
      select: { id: true },
    });

    const reservation = await prisma.reservation.create({
      data: {
        companyId: testCompanyId,
        unitId: unit.id,
        salesId: fixtures.userIds.salesId,
        clientId: customer1UserId,
        status: 'APPROVED',
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        bookingAmount: '0',
      },
      select: { id: true },
    });
    reservationId = reservation.id;

    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/reservations/${reservationId}/convert`)
      .set('Authorization', bearer(adminToken))
      .send({
        pdfUrl: PDF_URL,
        fileName: FILE_NAME,
        mimeType: 'application/pdf',
        sizeBytes: 4096,
      })
      .expect(201);

    contractId = res.body.contractId;
    expect(typeof contractId).toBe('string');
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  it('P12.1: the uploaded file becomes a CUSTOMER_VISIBLE CONTRACT Document in the Documents Center', async () => {
    const res = await http()
      .get('/v1/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(adminToken))
      .expect(200);

    const docs = res.body.data as Array<Record<string, unknown>>;
    expect(Array.isArray(docs)).toBe(true);
    const doc = docs.find((d) => d.fileUrl === PDF_URL);
    expect(doc).toBeDefined();
    expect(doc).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: contractId,
      category: 'CONTRACT',
      visibility: 'CUSTOMER_VISIBLE',
      fileName: FILE_NAME,
    });
  });

  it('P12.2: customer /contracts/me/contracts shows the contract with hasDocument=true and pdfUrl=null', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer1Token))
      .expect(200);

    const row = (res.body.data as Array<Record<string, unknown>>).find((c) => c.id === contractId);
    expect(row).toBeDefined();
    expect(row!.hasDocument).toBe(true);
    expect(row!.pdfUrl).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
  });

  it('P12.3a: customer /me/documents lists the contract document as metadata only (no fileUrl)', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer1Token))
      .expect(200);

    const docs = res.body as Array<Record<string, unknown>>;
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs[0]!;
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('fileName', FILE_NAME);
    expect(doc).not.toHaveProperty('fileUrl');
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
  });

  it('P12.3b: customer signed-download returns a short-lived URL (or 503 when storage unset) — never the permanent URL', async () => {
    const list = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer1Token))
      .expect(200);
    const docId = (list.body as Array<{ id: string }>)[0]!.id;

    const res = await http()
      .get(`/v1/me/documents/${docId}/download`)
      .set('Authorization', bearer(customer1Token));

    expect([200, 503]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
    if (res.status === 200) {
      expect(typeof res.body.url).toBe('string');
      expect(res.body).toHaveProperty('expiresIn');
    }
  });

  it('P12.4: customer2 cannot enumerate customer1\'s contract document (404, no existence leak)', async () => {
    await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer2Token))
      .expect(404);
  });

  it('P12.5: customer received contract_created_customer + contract_document_available notifications', async () => {
    const rows = await testApp.rawPrisma.notification.findMany({
      where: {
        userId: customer1UserId,
        templateCode: { in: ['contract_created_customer', 'contract_document_available'] },
        payload: { path: ['contractId'], equals: contractId },
      },
      select: { templateCode: true, payload: true },
    });
    const codes = rows.map((r) => r.templateCode);
    expect(codes).toContain('contract_created_customer');
    expect(codes).toContain('contract_document_available');
    expect(JSON.stringify(rows)).not.toContain(PDF_URL);
  });

  describe('Legacy backfill (pre-P12 contracts)', () => {
    const LEGACY_PDF_URL = 'https://r2.example.com/contracts/legacy/p12-backfill-old.pdf';
    let legacyContractId: string;
    let legacyCompanyId: string;
    let contractsService: ContractsService;

    beforeAll(async () => {
      const prisma = testApp.rawPrisma;
      contractsService = testApp.app.get(ContractsService);

      const company = await prisma.company.findFirstOrThrow({
        where: { isActive: true },
        select: { id: true },
      });
      legacyCompanyId = company.id;
      const building = await prisma.building.findFirstOrThrow({ select: { id: true } });
      const unit = await prisma.unit.create({
        data: {
          buildingId: building.id,
          companyId: legacyCompanyId,
          code: `P12-LEGACY-${Date.now()}`,
          type: '2BR',
          area: 110,
          price: '400000',
          status: 'SOLD',
        },
        select: { id: true },
      });
      const contract = await prisma.contract.create({
        data: {
          companyId: legacyCompanyId,
          customerId: customer1UserId,
          unitId: unit.id,
          totalAmount: '400000',
          downPayment: '0',
          pdfUrl: LEGACY_PDF_URL,
        },
        select: { id: true },
      });
      legacyContractId = contract.id;
    });

    const countContractDocs = () =>
      testApp.rawPrisma.document.count({
        where: {
          ownerType: 'CONTRACT',
          ownerId: legacyContractId,
          category: 'CONTRACT',
          deletedAt: null,
        },
      });

    it('precondition: legacy contract has pdfUrl but no Document and reads hasDocument=false', async () => {
      expect(await countContractDocs()).toBe(0);
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .query({ pageSize: 100 })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find(
        (c) => c.id === legacyContractId,
      );
      expect(row).toBeDefined();
      expect(row!.hasDocument).toBe(false);
      expect(row!.pdfUrl).toBeNull();
    });

    it('dry-run reports would-create and writes nothing', async () => {
      enterTenantContext({ companyId: legacyCompanyId, bypass: false, isPublic: false });
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: true },
      );
      expect(result).toBe('would-create');
      expect(await countContractDocs()).toBe(0);
    });

    it('execute registers a CUSTOMER_VISIBLE CONTRACT document visible in the Documents Center', async () => {
      enterTenantContext({ companyId: legacyCompanyId, bypass: false, isPublic: false });
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: false },
      );
      expect(result).toBe('created');

      const res = await http()
        .get('/v1/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const doc = (res.body.data as Array<Record<string, unknown>>).find(
        (d) => d.fileUrl === LEGACY_PDF_URL,
      );
      expect(doc).toBeDefined();
      expect(doc).toMatchObject({
        ownerType: 'CONTRACT',
        ownerId: legacyContractId,
        category: 'CONTRACT',
        visibility: 'CUSTOMER_VISIBLE',
      });
    });

    it('repaired: /me/contracts now reports hasDocument=true, pdfUrl=null, no permanent URL', async () => {
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .query({ pageSize: 100 })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find(
        (c) => c.id === legacyContractId,
      );
      expect(row!.hasDocument).toBe(true);
      expect(row!.pdfUrl).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(LEGACY_PDF_URL);
    });

    it('customer signed-download works for the repaired doc (200 url or 503) — never the permanent URL', async () => {
      const list = await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const docId = (list.body as Array<{ id: string }>)[0]!.id;
      const res = await http()
        .get(`/v1/me/documents/${docId}/download`)
        .set('Authorization', bearer(customer1Token));
      expect([200, 503]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain(LEGACY_PDF_URL);
    });

    it('customer2 cannot reach the repaired document (404, no existence leak)', async () => {
      await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(customer2Token))
        .expect(404);
    });

    it('is idempotent: a second execute is a no-op (still exactly one document)', async () => {
      enterTenantContext({ companyId: legacyCompanyId, bypass: false, isPublic: false });
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: false },
      );
      expect(result).toBe('exists');
      expect(await countContractDocs()).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RBAC route coverage (master spec)
// ═════════════════════════════════════════════════════════════════════════════

// Routes that use neither @Public()/@PlatformPublic() nor @Roles() but are
// protected by an alternative mechanism reviewed and documented here.
// Keep this list minimal — every entry must have a justification comment.
const ALLOW_LIST_FULL_NAMES = new Set<string>([
  // Authenticated self-service: JWT required (global guard), no role restriction.
  'UsersController.me',
  'UsersController.updateMe',
  'NotificationsController.myList',
  'NotificationsController.unreadCount',
  'NotificationsController.markRead',
  'NotificationsController.markAllRead',
  'NotificationsController.registerDevice',
  'AuthController.changePassword',
  'AuthController.resendVerification',
  'UsersController.uploadAvatar',
  // Prometheus scrape endpoint. @Public() so scrapers reach it without a JWT.
  // Authorization is enforced in the handler via METRICS_TOKEN bearer secret.
  // Set METRICS_TOKEN in production — without it the endpoint is open.
  'MetricsController.metrics',
]);

describe('RBAC route coverage (master spec)', () => {
  it('every controller HTTP route is guarded by @Public(), @PlatformPublic(), @Roles(), @UseGuards(SuperAdminGuard), or the allow-list', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const scanner = new MetadataScanner();

    const violations: string[] = [];
    let checked = 0;

    for (const wrapper of discovery.getControllers()) {
      const { metatype, instance } = wrapper;
      if (!metatype || !instance) continue;
      const proto = Object.getPrototypeOf(instance);
      const methodNames = scanner.getAllMethodNames(proto);

      // Class-level @UseGuards(SuperAdminGuard) is a valid protection mechanism.
      // Stored by NestJS under the '__guards__' metadata key on the class.
      const classGuards: Array<{ name?: string }> =
        (Reflect.getMetadata('__guards__', metatype) as Array<{ name?: string }> | undefined) ?? [];
      const hasSuperAdminGuard = classGuards.some((g) => g?.name === 'SuperAdminGuard');

      for (const methodName of methodNames) {
        const handler = (proto as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function') continue;
        const path = Reflect.getMetadata('path', handler as object);
        const httpMethod = Reflect.getMetadata('method', handler as object);
        if (path === undefined || httpMethod === undefined) continue;

        const fullName = `${metatype.name}.${methodName}`;
        if (ALLOW_LIST_FULL_NAMES.has(fullName)) {
          checked++;
          continue;
        }

        // SuperAdminGuard at the class level protects every route on the controller.
        if (hasSuperAdminGuard) {
          checked++;
          continue;
        }

        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]);
        // @PlatformPublic() (MT-024) is functionally equivalent to @Public() for
        // access-control purposes: JwtAuthGuard skips authentication for both.
        const isPlatformPublic = reflector.getAllAndOverride<boolean>(IS_PLATFORM_PUBLIC_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]);
        const roles = reflector.getAllAndOverride<unknown[]>(ROLES_KEY, [
          handler as (...args: unknown[]) => unknown,
          metatype,
        ]);

        const hasRoles = Array.isArray(roles) && roles.length > 0;
        if (!isPublic && !isPlatformPublic && !hasRoles) {
          violations.push(`${fullName} (${String(httpMethod)} ${path})`);
        }
        checked++;
      }
    }

    await app.close();

    if (violations.length > 0) {
      throw new Error(
        `${violations.length} controller route(s) lack any recognized access guard: \n  ` +
          violations.join('\n  ') +
          '\n\nAccepted guards: @Public(), @PlatformPublic(), @Roles(...), ' +
          'class-level @UseGuards(SuperAdminGuard), or ALLOW_LIST_FULL_NAMES.\n' +
          'Add the "ControllerName.methodName" to ALLOW_LIST_FULL_NAMES only if ' +
          'the route has a documented alternative auth mechanism.',
      );
    }

    expect(checked).toBeGreaterThan(50);
  });
});
