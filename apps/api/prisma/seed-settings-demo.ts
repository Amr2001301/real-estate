/**
 * seed-settings-demo.ts — Development-only system settings demo data
 *
 * Seeds realistic platform settings grouped by domain so the
 * /dashboard/settings page loads with populated, grouped configuration.
 *
 * SAFETY:
 *   • Aborts immediately if NODE_ENV === "production".
 *   • Fully idempotent — uses upsert, safe to run multiple times.
 *   • All values are demo-only and non-functional.
 *
 * USAGE:
 *   cd apps/api
 *   pnpm tsx prisma/seed-settings-demo.ts
 *
 * OR add to package.json scripts:
 *   "prisma:seed:settings": "tsx prisma/seed-settings-demo.ts"
 *
 * REMOVE DEMO DATA:
 *   pnpm tsx prisma/seed-settings-demo.ts --cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Safety guard ────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seed-settings-demo must NOT run in production. Aborting.');
  process.exit(1);
}

// ── Demo settings ────────────────────────────────────────────────────────────

interface SettingSeed {
  key: string;
  value: unknown;
}

const DEMO_SETTINGS: SettingSeed[] = [
  // company
  { key: 'company.name',           value: 'ديفورا للتطوير العقاري' },
  { key: 'company.phone',          value: '+966 11 000 0000' },
  { key: 'company.email',          value: 'info@devora.sa' },
  { key: 'company.address',        value: 'الرياض، المملكة العربية السعودية' },
  { key: 'company.website',        value: 'https://devora.sa' },
  { key: 'company.vatNumber',      value: '300000000000003' },

  // broker
  { key: 'broker.defaultCommissionPct', value: 2.5 },
  { key: 'broker.payoutCycleDays',      value: 30 },
  { key: 'broker.minPayoutAmount',      value: 1000 },
  { key: 'broker.autoApproveLeads',     value: false },

  // sales
  { key: 'sales.leadExpireDays',        value: 90 },
  { key: 'sales.reservationExpireDays', value: 7 },
  { key: 'sales.allowMultiReservation', value: false },

  // notifications
  { key: 'notifications.smsEnabled',   value: true },
  { key: 'notifications.emailEnabled', value: true },
  { key: 'notifications.fromEmail',    value: 'noreply@devora.sa' },

  // reports
  { key: 'reports.currency',   value: 'SAR' },
  { key: 'reports.dateFormat', value: 'DD/MM/YYYY' },
  { key: 'reports.timezone',   value: 'Asia/Riyadh' },

  // security
  { key: 'security.sessionTimeoutMins', value: 60 },
  { key: 'security.maxLoginAttempts',   value: 5 },
  { key: 'security.requireMfa',         value: false },
];

const DEMO_KEYS = DEMO_SETTINGS.map((s) => s.key);

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('🧹 Removing demo settings...');
  const { count } = await prisma.setting.deleteMany({
    where: { key: { in: DEMO_KEYS } },
  });
  console.log(`✅ Removed ${count} demo settings.`);
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const companyId = process.env.SEED_COMPANY_ID
    ?? (await prisma.company.findFirst({ select: { id: true } }))?.id;
  if (!companyId) {
    console.error('❌ No company found. Pass SEED_COMPANY_ID or seed a Company first.');
    process.exit(1);
  }

  console.log(`🌱 Seeding demo system settings for company ${companyId}...`);
  let created = 0;

  for (const { key, value } of DEMO_SETTINGS) {
    await prisma.setting.upsert({
      where:  { companyId_key: { companyId, key } },
      update: { value: value as never },
      create: { companyId, key, value: value as never },
    });
    created++;
    console.log(`   ✓ ${key}`);
  }

  console.log(`\n✅ Done — ${created} settings upserted.`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const isCleanup = process.argv.includes('--cleanup');

(isCleanup ? cleanup() : seed())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
