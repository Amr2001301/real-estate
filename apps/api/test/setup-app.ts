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
  // Raw client with no tenant middleware — for test fixture setup and direct
  // DB assertions that happen outside the HTTP request lifecycle.
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  return {
    app,
    prisma,
    rawPrisma,
    flushCapabilities: (companyId) => capabilitySvc.invalidateCache(companyId),
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
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  const testApp: TestApp = {
    app,
    prisma,
    rawPrisma,
    flushCapabilities: (companyId) => capabilitySvc.invalidateCache(companyId),
    close: async () => {},
  };

  NativeModule._cache[SEC_CACHE_KEY] = {
    exports: { secTestApp: testApp },
  } as unknown as { exports: Record<string, unknown> };

  // Mark this process as having compiled the singleton so any future MISS
  // (from a spec file that can't see the cache) fails loudly rather than
  // silently spawning a 15-app boot cycle.
  process.env.__SEC_SINGLETON_COMPILED__ = '1';

  return testApp;
}
