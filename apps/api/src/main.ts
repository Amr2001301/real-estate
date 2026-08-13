import 'reflect-metadata';
import { initSentry } from './common/observability/sentry';
// Sentry must be initialised before any other application code so that the
// SDK can patch http/express/etc. Safe to call when SENTRY_DSN is unset.
initSentry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DateSerializerInterceptor } from './common/interceptors/date-serializer.interceptor';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { requestIdMiddleware } from './common/logging/request-id.middleware';
import { isSentryEnabled } from './common/observability/sentry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new JsonLoggerService());
  const config = app.get(ConfigService);

  // Run before any other middleware so the id is on every response header,
  // including helmet's and CORS preflight responses.
  app.use(requestIdMiddleware);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

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

  const swagger = new DocumentBuilder()
    .setTitle('Devora API')
    .setDescription('Backend for Public, Admin, Sales, Client/Customer surfaces')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port);

  const redisUrl = config.get<string>('REDIS_URL') ?? '';
  let redisHost = 'not-configured';
  try { redisHost = new URL(redisUrl).hostname; } catch { /* ignore */ }

  Logger.log(
    `started env=${config.get('NODE_ENV')} port=${port} ` +
    `sentry=${isSentryEnabled() ? 'enabled' : 'disabled'} ` +
    `redis=${redisHost} otp=${config.get('OTP_PROVIDER')} ` +
    `storage=${config.get('R2_ACCOUNT_ID') ? 'r2' : 'local/unset'}`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
