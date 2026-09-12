/**
 * MT-045 — Backfill platform subdomains for existing companies.
 *
 * Provisions a PLATFORM_SUBDOMAIN CompanyDomain record for every company
 * that does not yet have one. Idempotent — safe to run multiple times.
 * Companies already provisioned (found via type=PLATFORM_SUBDOMAIN) are skipped.
 *
 * Reserved / collapsing slugs are reported as BLOCKER and cause a non-zero
 * exit even in dry-run mode. This matches the runtime guard in
 * CompanyDomainsService.provisionPlatformSubdomain and SuperAdminService.createCompany.
 *
 * Requires PLATFORM_BASE_DOMAIN in environment:
 *   PLATFORM_BASE_DOMAIN=platform.example.com \
 *   DATABASE_URL=postgres://... \
 *   npx tsx prisma/scripts/backfill-platform-domains.ts
 *
 * Dry-run mode (no writes):
 *   DRY_RUN=true PLATFORM_BASE_DOMAIN=... npx tsx prisma/scripts/backfill-platform-domains.ts
 */

import { PrismaClient, DomainType } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { normalizeHostname, InvalidHostnameError } from '../../src/common/utils/hostname-normalize';

// Keep in sync with CompanyDomainsService.RESERVED_PLATFORM_SLUGS
const RESERVED_SLUGS = new Set(['www', 'api', 'admin']);

const prisma = new PrismaClient();

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

async function main() {
  const baseDomain = process.env.PLATFORM_BASE_DOMAIN?.trim().toLowerCase().replace(/\.$/, '');
  if (!baseDomain) {
    console.error('ERROR: PLATFORM_BASE_DOMAIN is not set');
    process.exit(1);
  }

  const dryRun = process.env.DRY_RUN === 'true';
  if (dryRun) console.log('[DRY RUN] No writes will be performed.');

  const companies = await prisma.company.findMany({
    select: { id: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${companies.length} companies to check.`);

  let provisioned = 0;
  let skipped = 0;
  let failed = 0;
  let blockers = 0;

  for (const company of companies) {
    // Layer 1: reserved slug check — matches SuperAdminService guard
    if (RESERVED_SLUGS.has(company.slug)) {
      console.error(`  BLOCKER  ${company.slug} (id=${company.id}) — slug is reserved (${[...RESERVED_SLUGS].join('|')}); fix the company slug before re-running`);
      blockers++;
      continue;
    }

    // Layer 2: compute and normalize the candidate hostname
    let hostname: string;
    try {
      hostname = normalizeHostname(`${company.slug}.${baseDomain}`);
    } catch (err) {
      if (err instanceof InvalidHostnameError) {
        console.error(`  BLOCKER  ${company.slug} (id=${company.id}) — slug produces an invalid hostname: ${err.message}`);
      } else {
        console.error(`  ERROR    ${company.slug} (id=${company.id}) — unexpected normalization error: ${(err as Error).message}`);
      }
      blockers++;
      continue;
    }

    // Layer 3: collapsing-slug check — mirrors CompanyDomainsService.provisionPlatformSubdomain guard
    if (hostname === baseDomain) {
      console.error(`  BLOCKER  ${company.slug} (id=${company.id}) — subdomain collapses to the platform base domain (${baseDomain}); slug must be changed`);
      blockers++;
      continue;
    }

    const existing = await prisma.companyDomain.findFirst({
      where: { companyId: company.id, type: DomainType.PLATFORM_SUBDOMAIN },
      select: { id: true, hostname: true },
    });

    if (existing) {
      console.log(`  SKIP  ${company.slug} → ${existing.hostname} (already provisioned)`);
      skipped++;
      continue;
    }

    // Check hostname conflict (another company may have claimed it — edge case)
    const conflict = await prisma.companyDomain.findUnique({ where: { hostname } });
    if (conflict) {
      console.warn(`  WARN  ${company.slug} → hostname ${hostname} is claimed by another domain (id=${conflict.id})`);
      failed++;
      continue;
    }

    if (!dryRun) {
      try {
        await prisma.companyDomain.create({
          data: {
            companyId: company.id,
            hostname,
            type: DomainType.PLATFORM_SUBDOMAIN,
            isPrimary: true,
            verifiedAt: new Date(),
            verificationToken: generateToken(),
          },
        });
        console.log(`  OK    ${company.slug} → ${hostname}`);
        provisioned++;
      } catch (err) {
        console.error(`  ERROR ${company.slug} → ${hostname}: ${(err as Error).message}`);
        failed++;
      }
    } else {
      console.log(`  WOULD provision  ${company.slug} → ${hostname}`);
      provisioned++;
    }
  }

  console.log(`\nDone. provisioned=${provisioned} skipped=${skipped} failed=${failed} blockers=${blockers}`);
  if (blockers > 0 || failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
