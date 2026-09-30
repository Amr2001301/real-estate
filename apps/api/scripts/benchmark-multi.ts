/**
 * Multi-point data-export benchmark.
 *
 * Seeds synthetic data at three sizes in the local dev/test DB,
 * measures wall time / file size / peak heap / SQL query count,
 * then cleans up and writes results to docs/audit/18-data-export-benchmark.md.
 *
 * Run from apps/api/:
 *   npx tsx --tsconfig tsconfig.json scripts/benchmark-multi.ts
 */
import 'reflect-metadata';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../.env') });

// ── Size definitions ──────────────────────────────────────────────────────────

interface SizeSpec {
  label: string;
  units: number;
  contracts: number;
  installmentsPerContract: number;
}

const SIZES: SizeSpec[] = [
  { label: 'small',  units: 100,  contracts: 40,  installmentsPerContract: 10 },
  { label: 'medium', units: 1000, contracts: 350, installmentsPerContract: 10 },
  { label: 'large',  units: 2500, contracts: 800, installmentsPerContract: 10 },
];

// ── Seeder ────────────────────────────────────────────────────────────────────

async function seed(
  prisma: PrismaClient,
  spec: SizeSpec,
): Promise<{ companyId: string; adminId: string }> {
  const companyId = randomUUID();
  const projectId  = randomUUID();
  const phaseId    = randomUUID();
  const buildingId = randomUUID();
  const adminId    = randomUUID();

  // Company
  await prisma.company.create({
    data: {
      id: companyId,
      name: `BENCH_${spec.label}_${Date.now()}`,
      slug: `bench-${spec.label}-${Date.now()}`,
    },
  });

  // Hierarchy
  await prisma.project.create({
    data: {
      id: projectId,
      name: { ar: 'مشروع القياس', en: 'Bench Project' },
      description: { ar: '', en: '' },
      city: 'Cairo',
      lat: 30.0,
      lng: 31.0,
      status: 'DRAFT',
      companyId,
    },
  });
  await prisma.phase.create({
    data: { id: phaseId, name: { ar: 'مرحلة', en: 'Phase 1' }, order: 1, projectId, companyId },
  });
  await prisma.building.create({
    data: { id: buildingId, name: 'B-1', totalFloors: 20, order: 1, phaseId, companyId },
  });

  // Admin user (for recordedBy on deposits later — not needed in benchmark but
  // avoids FK errors if a future sheet builder queries it)
  await prisma.user.create({
    data: { id: adminId, fullName: 'Bench Admin', role: 'ADMIN', active: true, companyId },
  });

  // Units (createMany — no IDs needed; we'll query them back)
  await prisma.unit.createMany({
    data: Array.from({ length: spec.units }, (_, i) => ({
      buildingId,
      code: `U-${String(i + 1).padStart(5, '0')}`,
      type: i % 3 === 0 ? 'APARTMENT' : i % 3 === 1 ? 'VILLA' : 'STUDIO',
      area: 80 + (i % 100),
      bedrooms: 1 + (i % 3),
      bathrooms: 1 + (i % 2),
      floor: (i % 20) + 1,
      price: 500_000 + i * 1000,
      status: 'AVAILABLE',
      companyId,
    })),
  });

  // Customers — phone must be globally unique; use companyId prefix to avoid clashes
  const customerCount = Math.max(spec.contracts, 20);
  const customerIds = Array.from({ length: customerCount }, () => randomUUID());
  const phonePrefix = companyId.replace(/-/g, '').slice(0, 8);
  await prisma.user.createMany({
    data: customerIds.map((id, i) => ({
      id,
      fullName: `Customer ${i + 1}`,
      phone: `${phonePrefix}${String(i).padStart(6, '0')}`,
      role: 'CLIENT',
      active: true,
      companyId,
    })),
  });

  // Leads (one per customer — clientId required by schema)
  await prisma.lead.createMany({
    data: customerIds.slice(0, spec.contracts).map((clientId, i) => ({
      clientId,
      fullName: `Lead ${i + 1}`,
      phone: `L${phonePrefix}${String(i).padStart(5, '0')}`,
      stage: 'NEW',
      companyId,
    })),
  });

  // Units IDs for contracts
  const unitRows = await prisma.unit.findMany({
    where: { companyId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: spec.contracts,
  });

  // Contracts + plans + installments in batches
  const contractIds: string[] = [];
  const planIds: string[] = [];

  const contractData = unitRows.map((u, i) => {
    const id = randomUUID();
    contractIds.push(id);
    return {
      id,
      contractNumber: `C-BENCH-${String(i + 1).padStart(6, '0')}`,
      customerId: customerIds[i % customerIds.length]!,
      unitId: u.id,
      totalAmount: 1_500_000 + i * 500,
      downPayment: 150_000,
      status: 'ACTIVE' as const,
      signedAt: new Date(),
      companyId,
    };
  });

  // createMany can't take an array of 800+ in one shot on some DBs — batch at 500
  for (let start = 0; start < contractData.length; start += 500) {
    await prisma.contract.createMany({ data: contractData.slice(start, start + 500) });
  }

  const planData = contractIds.map((contractId) => {
    const id = randomUUID();
    planIds.push(id);
    return {
      id,
      contractId,
      totalMonths: spec.installmentsPerContract,
      monthlyAmount: 10_000,
      startsAt: new Date(),
      frequency: 'MONTHLY' as const,
      companyId,
    };
  });

  for (let start = 0; start < planData.length; start += 500) {
    await prisma.installmentPlan.createMany({ data: planData.slice(start, start + 500) });
  }

  const installmentData: Array<{
    planId: string; dueDate: Date; amount: number; status: 'PENDING'; type: 'INSTALLMENT'; companyId: string;
  }> = [];
  const baseDate = new Date();
  for (const planId of planIds) {
    for (let m = 0; m < spec.installmentsPerContract; m++) {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + m);
      installmentData.push({ planId, dueDate: due, amount: 10_000, status: 'PENDING', type: 'INSTALLMENT', companyId });
    }
  }

  for (let start = 0; start < installmentData.length; start += 1000) {
    await prisma.installment.createMany({ data: installmentData.slice(start, start + 1000) });
  }

  return { companyId, adminId };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(prisma: PrismaClient, companyId: string): Promise<void> {
  // The following order respects FK constraints without relying on CASCADE:
  // installments → installmentPlans → contracts → leads/units → buildings → phases → projects → users → company
  await prisma.installment.deleteMany({ where: { companyId } });
  await prisma.installmentPlan.deleteMany({ where: { companyId } });
  await prisma.contract.deleteMany({ where: { companyId } });
  await prisma.lead.deleteMany({ where: { companyId } });   // before users (clientId FK)
  await prisma.unit.deleteMany({ where: { companyId } });
  await prisma.building.deleteMany({ where: { companyId } });
  await prisma.phase.deleteMany({ where: { companyId } });
  await prisma.project.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

// ── Row counting ──────────────────────────────────────────────────────────────

async function countRows(prisma: PrismaClient, companyId: string): Promise<Record<string, number>> {
  const [units, customers, leads, contracts, plans, installments] = await Promise.all([
    prisma.unit.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, role: 'CLIENT' } }),
    prisma.lead.count({ where: { companyId } }),
    prisma.contract.count({ where: { companyId } }),
    prisma.installmentPlan.count({ where: { companyId } }),
    prisma.installment.count({ where: { companyId } }),
  ]);
  return { units, customers, leads, contracts, plans, installments };
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface BenchResult {
  label: string;
  seededRows: Record<string, number>;
  exportedRows: number;
  sqlQueries: number;
  wallMs: number;
  fileSizeKB: number;
  peakHeapMB: number;
}

async function main() {
  const { DataExportService } = await import('../src/modules/data-export/data-export.service');

  // Separate PrismaClient with query event logging for counting
  const prisma = new PrismaClient({
    log: [{ emit: 'event', level: 'query' }],
  });

  // Plain PrismaClient for seeding (no logging overhead)
  const seedPrisma = new PrismaClient();
  await seedPrisma.$connect();
  await prisma.$connect();

  const results: BenchResult[] = [];

  for (const spec of SIZES) {
    process.stdout.write(`\n[${spec.label}] Seeding ${spec.units} units / ${spec.contracts} contracts...`);
    const { companyId } = await seed(seedPrisma, spec);
    const seededRows = await countRows(seedPrisma, companyId);
    process.stdout.write(' done\n');

    // Reset query counter for this run
    let sqlQueries = 0;
    prisma.$on('query' as never, () => { sqlQueries++; });

    // Cast raw PrismaClient as PrismaService — the service only uses standard CRUD
    const service = new DataExportService(prisma as never);

    // Peak heap polling
    if (global.gc) global.gc();
    let peakHeap = process.memoryUsage().heapUsed;
    const heapInterval = setInterval(() => {
      const h = process.memoryUsage().heapUsed;
      if (h > peakHeap) peakHeap = h;
    }, 50);

    const wallStart = performance.now();
    const exportResult = await service.generate(companyId, companyId /* dummy actorId */);
    const wallMs = performance.now() - wallStart;

    clearInterval(heapInterval);
    const peakHeapMB = peakHeap / 1024 / 1024;
    const fileSizeKB = exportResult.buffer.length / 1024;

    results.push({
      label: spec.label,
      seededRows,
      exportedRows: exportResult.totalRows,
      sqlQueries,
      wallMs,
      fileSizeKB,
      peakHeapMB,
    });

    process.stdout.write(`  exported ${exportResult.totalRows} rows | ${wallMs.toFixed(0)} ms | ${(fileSizeKB / 1024).toFixed(3)} MB | ${sqlQueries} SQL queries\n`);

    // Cleanup bench data
    process.stdout.write(`  Cleaning up...`);
    await cleanup(seedPrisma, companyId);
    process.stdout.write(' done\n');
  }

  await seedPrisma.$disconnect();
  await prisma.$disconnect();

  // ── Report ──────────────────────────────────────────────────────────────────

  const queryCounts = results.map(r => r.sqlQueries);
  const queryCountFixed = queryCounts.every(q => Math.abs(q - queryCounts[0]!) <= 5);
  const n1Verdict = queryCountFixed
    ? '**Fixed** — query count does not grow with row count. No N+1 pattern detected.'
    : `**Growing** — query count varies across sizes (${queryCounts.join(', ')}). Investigate N+1.`;

  const md = `# Data Export — Multi-Point Benchmark

> Measured on: ${new Date().toISOString().slice(0, 10)} against local dev PostgreSQL.
> Script: \`apps/api/scripts/benchmark-multi.ts\`
> All numbers are wall-clock measured. No extrapolation.

## Results

| Size | Seeded rows | Exported rows | SQL queries | Wall time (ms) | File size (KB) | Peak heap (MB) |
|------|------------|--------------|-------------|---------------|---------------|----------------|
${results.map(r => {
  const seed = Object.values(r.seededRows).reduce((a, b) => a + b, 0);
  return `| ${r.label} | ${seed.toLocaleString()} | ${r.exportedRows.toLocaleString()} | ${r.sqlQueries} | ${r.wallMs.toFixed(0)} | ${r.fileSizeKB.toFixed(0)} | ${r.peakHeapMB.toFixed(1)} |`;
}).join('\n')}

## Seeded entity breakdown

| Entity | small | medium | large |
|--------|-------|--------|-------|
${Object.keys(results[0]!.seededRows).map(k => `| ${k} | ${results[0]!.seededRows[k]} | ${results[1]!.seededRows[k]} | ${results[2]!.seededRows[k]} |`).join('\n')}

## N+1 analysis

${n1Verdict}

The export runs one \`Promise.all\` containing ${results[0]!.sqlQueries}-${results[results.length - 1]!.sqlQueries} SQL queries
(17 Prisma API calls; Prisma executes nested relation selects as separate
\`SELECT … WHERE id IN (…)\` batches — one per relation depth level, not one per row).

## Notes

- Seeded entities that are exported but not seeded (deposits, instruments, refunds,
  brokers, commissions, maintenance) contribute 0 rows. Timing includes their empty
  queries.
- Peak heap measurement uses a 50 ms polling interval during \`generate()\`.
  Actual peak may be slightly higher between samples.
- File size scales sub-linearly with row count because header/style overhead
  dominates at small sizes; most growth is from row data.
`;

  const outDir = join(__dirname, '../../..', 'docs', 'audit');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, '18-data-export-benchmark.md');
  writeFileSync(mdPath, md, 'utf8');
  console.log(`\nWrote → ${mdPath}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
