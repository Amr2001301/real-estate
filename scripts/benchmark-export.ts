/**
 * One-shot benchmark: measure the data export against the local dev database.
 *
 * Run from the repo root:
 *   npx tsx --tsconfig apps/api/tsconfig.json scripts/benchmark-export.ts
 *
 * Bypasses the NestJS DI container — wires PrismaClient directly into
 * DataExportService to avoid ConfigModule/JWT bootstrap failures.
 */
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../apps/api/.env') });

async function main() {
  const { DataExportService } = await import('../apps/api/src/modules/data-export/data-export.service');

  const prisma = new PrismaClient();
  await prisma.$connect();

  // Cast: DataExportService only uses standard Prisma CRUD — no middleware needed for a read-only benchmark.
  const service = new DataExportService(prisma as never);

  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company in dev database');

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: 'ADMIN' },
    select: { id: true, fullName: true },
  });
  if (!admin) throw new Error('No ADMIN user found');

  console.log(`\nCompany : ${company.name}  (${company.id})`);
  console.log(`Actor   : ${admin.fullName}  (${admin.id})\n`);

  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const wallStart  = performance.now();

  const result = await service.generate(company.id, admin.id);

  const wallMs   = performance.now() - wallStart;
  const heapDiff = process.memoryUsage().heapUsed - heapBefore;

  const sizeMB = (result.buffer.length / 1024 / 1024).toFixed(3);
  const heapMB = (heapDiff / 1024 / 1024).toFixed(1);

  console.log('── Results ──────────────────────────────────────');
  console.log(`Total rows   : ${result.totalRows.toLocaleString()}`);
  console.log(`Wall time    : ${wallMs.toFixed(0)} ms`);
  console.log(`File size    : ${sizeMB} MB`);
  console.log(`Heap delta   : ${heapMB} MB`);
  console.log('');
  console.log('Sheet breakdown:');
  for (const [sheet, count] of Object.entries(result.sheetCounts)) {
    console.log(`  ${sheet.padEnd(22)} ${String(count).padStart(6)} rows`);
  }

  const outPath = join(homedir(), 'Desktop', 'rep-export-test.xlsx');
  writeFileSync(outPath, result.buffer);
  console.log(`\nSaved → ${outPath}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
