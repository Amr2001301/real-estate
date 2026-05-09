import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.setGlobalPrefix('v1', { exclude: ['health', '/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const swagger = new DocumentBuilder()
    .setTitle('Real Estate Platform API')
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
  Logger.log(`API running on http://localhost:${port}/v1 (docs: /docs)`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', err);
  process.exit(1);
});
