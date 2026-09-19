/**
 * Boot the real Nest application for backend e2e tests.
 *
 * Mirrors `src/main.ts` exactly (same middleware order, same global
 * prefix, same pipes, same interceptors) so the integration boundary
 * we exercise via supertest matches what production sees. The only
 * differences from main.ts:
 *   - no Sentry init (test env)
 *   - no JSON logger (default Nest logger is fine for jest)
 *   - no Swagger doc (we don't hit `/docs` in tests)
 *   - no `app.listen()` — supertest binds to the in-process HTTP server.
 *
 * `globalSetup.ts` has already pointed `process.env.DATABASE_URL` at
 * the e2e database before this module is imported, so PrismaService
 * picks up the right connection automatically.
 */

import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { CapabilityService } from '../src/common/capabilities/capability.service';
import { DateSerializerInterceptor } from '../src/common/interceptors/date-serializer.interceptor';
import { requestIdMiddleware } from '../src/common/logging/request-id.middleware';
import { PrismaService } from '../src/common/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  /**
   * The tenant-enforced PrismaService used by the Nest application internally.
   * Do NOT call this directly in test setup/assertions — it requires an active
   * ALS tenant context. Use `rawPrisma` instead for direct DB operations.
   */
  prisma: PrismaService;
  /**
   * A raw PrismaClient with no tenant middleware — for use in test beforeAll /
   * afterAll hooks and helper assertions that need direct DB access without
   * going through the HTTP layer.
   */
  rawPrisma: PrismaClient;
  close: () => Promise<void>;
  /**
   * Flush the capability cache for a company. Use this instead of calling
   * `app.get(CapabilityService).invalidateCache()` directly — the class
   * reference captured here matches the DI token the app was compiled with,
   * so it works correctly even when called from a different Jest vm context.
   */
  flushCapabilities: (companyId: string) => Promise<void>;
  /**
   * Sign a JWT access token for an existing user. Use this instead of
   * `app.get(JwtService)` — the JwtService and ConfigService references
   * captured here belong to the app's vm context and work correctly even
   * when called from a different Jest vm context (e.g. from a singleton spec).
   */
  signAccessToken: (userId: string, role: string, expiresIn?: string) => Promise<string>;
}

export interface CreateTestAppOptions {
  /**
   * When true, overrides ThrottlerGuard with a pass-through so tests that make
   * many login calls within 60 s are not blocked by the per-IP rate limit.
   * Use only in specs that are testing capability enforcement, not rate limiting.
   */
  skipThrottle?: boolean;
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (options.skipThrottle) {
    // Override the throttler storage so increment() always reports 1 hit (never blocked).
    // overrideGuard(ThrottlerGuard) does not work for APP_GUARD useClass registrations.
    builder = builder.overrideProvider(ThrottlerStorage).useValue({
      increment: () => Promise.resolve({ totalHits: 1, timeToExpire: 0, isBlocked: false, blockExpiresAt: 0 }),
    });
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/live', 'health/ready', '/'] });
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
  const capabilitySvc = app.get(CapabilityService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  const jwtSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  const jwtDefaultExpiry = configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  // Raw client with no tenant middleware — for test fixture setup and direct
  // DB assertions that happen outside the HTTP request lifecycle.
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  return {
    app,
    prisma,
    rawPrisma,
    flushCapabilities: (companyId) => capabilitySvc.invalidateCache(companyId),
    signAccessToken: (userId, role, expiresIn) =>
      jwtService.signAsync({ sub: userId, role }, { secret: jwtSecret, expiresIn: expiresIn ?? jwtDefaultExpiry }),
    close: async () => {
      await rawPrisma.$disconnect();
      await app.close();
    },
  };
}

// ─── Security suite singleton ─────────────────────────────────────────────────
// All 15 security spec files share one NestJS application instance.
//
// Jest creates a fresh vm context per test file, so `process`, `global`, and
// the Jest module registry are all reset between files. However, the real
// Node.js require cache (Module._cache) lives outside Jest's sandbox and IS
// shared across vm contexts — exactly what our vm-context isolation test
// confirmed. We store the TestApp under a NUL-prefixed synthetic key that
// can never collide with a real file path.
//
// close() is a no-op: forceExit:true in jest-security.json terminates the
// process (and all DB connections) after the suite completes.
//
// ── vm-context rules for security spec authors ──────────────────────────────
//
//   SAFE  testApp.app.getHttpServer()  — native HTTP server, no DI lookup
//   SAFE  testApp.rawPrisma.*          — plain PrismaClient, no middleware
//   SAFE  testApp.flushCapabilities()  — closed over the correct vm context
//   SAFE  HTTP requests via supertest  — transport-level, no class refs
//
//   UNSAFE  testApp.app.get(SomeClass)     — SEALED; throws SEC_VM_CONTEXT_UNSAFE
//   UNSAFE  instanceof SomeClass           — class from a different vm context;
//                                            use error.message matching instead
//   UNSAFE  testApp.prisma.model.*()       — requires ALS context; only used in
//                                            files 01/03/07 which have isolated apps
//
// Files 01/03/07 use createTestApp() (isolated apps) because they test ALS
// fail-closed behavior and instanceof checks that require the ALS instance and
// error class to come from the SAME vm context as the app.

// ─── E2E suite singleton ──────────────────────────────────────────────────────
// All 23 standard e2e spec files share one NestJS application instance via the
// same Module._cache mechanism used by the security suite.
//
// ── vm-context rules for e2e spec authors ────────────────────────────────────
//
//   SAFE  testApp.app.getHttpServer()  — native HTTP server, no DI lookup
//   SAFE  testApp.rawPrisma.*          — plain PrismaClient, no middleware
//   SAFE  testApp.flushCapabilities()  — closed over the correct vm context
//   SAFE  HTTP requests via supertest  — transport-level, no class refs
//
//   UNSAFE  testApp.app.get(SomeClass)     — SEALED; throws E2E_VM_CONTEXT_UNSAFE
//   UNSAFE  instanceof SomeClass           — class from a different vm context
//   UNSAFE  testApp.prisma.model.*()       — requires ALS context; use rawPrisma
//
// email-verification and password-reset use createTestApp() (isolated apps)
// because they override providers (ThrottlerStorage). rbac-route-coverage
// is standalone (boots its own module, closes itself). All others use this.

const E2E_CACHE_KEY = '\0jest-e2e-shared-app';

export async function createE2ETestApp(): Promise<TestApp> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeModule = require('module') as {
    _cache: Record<string, { exports: Record<string, unknown> }>;
  };
  const cached = NativeModule._cache[E2E_CACHE_KEY];
  if (cached?.exports?.e2eTestApp) return cached.exports.e2eTestApp as TestApp;

  // Guard: if another spec file already compiled the singleton, a second MISS means
  // Module._cache is no longer shared across vm contexts (Jest or Node upgrade).
  // Fail immediately so CI shows a clear error instead of silently booting 23 apps.
  if (process.env.__E2E_SINGLETON_COMPILED__) {
    throw new Error(
      '[E2E_SINGLETON_BROKEN] createE2ETestApp() compiled a fresh NestJS app ' +
        'even though Module._cache[E2E_CACHE_KEY] was already set in this Jest run. ' +
        'The cross-vm cache-sharing mechanism has stopped working — check whether ' +
        'a Jest or Node.js upgrade changed how vm contexts share require cache entries.',
    );
  }

  // Override ThrottlerStorage so 23 sequential beforeAll logins don't exhaust
  // the per-IP rate-limit window that would otherwise be shared across all specs.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () => Promise.resolve({ totalHits: 1, timeToExpire: 0, isBlocked: false, blockExpiresAt: 0 }),
    })
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/live', 'health/ready', '/'] });
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
  const capabilitySvc = app.get(CapabilityService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  const jwtSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  const jwtDefaultExpiry = configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  const testApp: TestApp = {
    app,
    prisma,
    rawPrisma,
    flushCapabilities: (companyId) => capabilitySvc.invalidateCache(companyId),
    signAccessToken: (userId, role, expiresIn) =>
      jwtService.signAsync({ sub: userId, role }, { secret: jwtSecret, expiresIn: expiresIn ?? jwtDefaultExpiry }),
    close: async () => {},
  };

  NativeModule._cache[E2E_CACHE_KEY] = {
    exports: { e2eTestApp: testApp },
  } as unknown as { exports: Record<string, unknown> };

  process.env.__E2E_SINGLETON_COMPILED__ = '1';

  (app as unknown as Record<string, unknown>).get = (token: unknown): never => {
    throw new Error(
      `[E2E_VM_CONTEXT_UNSAFE] testApp.app.get(${
        typeof token === 'function' ? (token as { name?: string }).name ?? 'unknown' : String(token)
      }) called on the shared e2e singleton from a different Jest vm context. ` +
        'Class references in this file are different objects from those registered in the app. ' +
        'Add a TestApp helper in setup-app.ts instead (pattern: see flushCapabilities). ' +
        'Never call app.get() directly from e2e spec files using the singleton.',
    );
  };

  return testApp;
}

const SEC_CACHE_KEY = '\0jest-security-shared-app';

export async function createSecurityTestApp(): Promise<TestApp> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeModule = require('module') as {
    _cache: Record<string, { exports: Record<string, unknown> }>;
  };
  const cached = NativeModule._cache[SEC_CACHE_KEY];
  if (cached?.exports?.secTestApp) return cached.exports.secTestApp as TestApp;

  // Guard: if another spec file already compiled the singleton, a second MISS means
  // Module._cache is no longer shared across vm contexts (Jest or Node upgrade).
  // Fail immediately so CI shows a clear error instead of slowly timing out.
  if (process.env.__SEC_SINGLETON_COMPILED__) {
    throw new Error(
      '[SEC_SINGLETON_BROKEN] createSecurityTestApp() compiled a fresh NestJS app ' +
        'even though Module._cache[SEC_CACHE_KEY] was already set in this Jest run. ' +
        'The cross-vm cache-sharing mechanism has stopped working — check whether ' +
        'a Jest or Node.js upgrade changed how vm contexts share require cache entries.',
    );
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () => Promise.resolve({ totalHits: 1, timeToExpire: 0, isBlocked: false, blockExpiresAt: 0 }),
    })
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: false });
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/live', 'health/ready', '/'] });
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
  // Capture CapabilityService here, in the same vm context the app was compiled in.
  // Storing it in the closure means callers in OTHER vm contexts can call
  // testApp.flushCapabilities() without needing to resolve the class token themselves.
  const capabilitySvc = app.get(CapabilityService);
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  const jwtSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  const jwtDefaultExpiry = configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  const testApp: TestApp = {
    app,
    prisma,
    rawPrisma,
    flushCapabilities: (companyId) => capabilitySvc.invalidateCache(companyId),
    signAccessToken: (userId, role, expiresIn) =>
      jwtService.signAsync({ sub: userId, role }, { secret: jwtSecret, expiresIn: expiresIn ?? jwtDefaultExpiry }),
    close: async () => {},
  };

  NativeModule._cache[SEC_CACHE_KEY] = {
    exports: { secTestApp: testApp },
  } as unknown as { exports: Record<string, unknown> };

  // Mark this process as having compiled the singleton so any future MISS
  // (from a spec file that can't see the cache) fails loudly rather than
  // silently spawning a 15-app boot cycle.
  process.env.__SEC_SINGLETON_COMPILED__ = '1';

  // Seal app.get() so future spec files cannot accidentally call it.
  // Every spec file runs in its own Jest vm context: the class reference they
  // import (e.g. CapabilityService) is a different object than the one the
  // singleton app was compiled with, so app.get(SomeSvcClass) always fails
  // with a confusing "element not found" Nest error. Replacing the method with
  // an explicit throw makes the cause and fix immediately obvious.
  // Discard the real get() — callers must use TestApp helpers instead.
  (app as unknown as Record<string, unknown>).get = (token: unknown): never => {
    throw new Error(
      `[SEC_VM_CONTEXT_UNSAFE] testApp.app.get(${
        typeof token === 'function' ? (token as { name?: string }).name ?? 'unknown' : String(token)
      }) called on the shared security singleton from a different Jest vm context. ` +
        'Class references in this file are different objects from those registered in the app. ' +
        'Add a TestApp helper in setup-app.ts instead (pattern: see flushCapabilities). ' +
        'Never call app.get() directly from security spec files.',
    );
  };

  return testApp;
}
