/**
 * Exports the OpenAPI spec to apps/api/openapi.json offline (no server / DB).
 *
 *   pnpm --filter api openapi:export
 *
 * Uses Nest "preview" mode so the provider graph is built without instantiating
 * DB connections. The committed openapi.json is the source for mobile Dio model
 * codegen (see docs/mobile-backend-readiness.md → OpenAPI section).
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  const config = new DocumentBuilder()
    .setTitle('Real Estate Platform API')
    .setDescription('Backend for Public, Admin, Sales, Client/Customer surfaces')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  const outPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  await app.close();
  const pathCount = Object.keys(doc.paths ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath} (${pathCount} paths)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
