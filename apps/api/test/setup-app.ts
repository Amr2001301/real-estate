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
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
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
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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
  // Raw client with no tenant middleware — for test fixture setup and direct
  // DB assertions that happen outside the HTTP request lifecycle.
  const rawPrisma = new PrismaClient();
  await rawPrisma.$connect();

  return {
    app,
    prisma,
    rawPrisma,
    close: async () => {
      await rawPrisma.$disconnect();
      await app.close();
    },
  };
}
