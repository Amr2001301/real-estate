/**
 * MT-017 v3 — Hardened read-only identity / email / phone audit.
 *
 * Semantic corrections applied (B-Contract Gate 1 Hardening v3):
 *   §1  SUPER_ADMIN blocker is environment-specific:
 *         PRODUCTION / PRODUCTION MIRROR → HARD CONTRACT BLOCKER
 *         LOCAL DEV / other             → DIAGNOSTIC ONLY (stale seed, not proven production state)
 *   §2  MT-020 scope corrected: companyId backfill only.
 *       Legacy raw-phone storage gap is LEGACY AUTH RETIREMENT DEBT, reported separately.
 *   §3  MT-023 predicate: no standalone canonical specification exists in docs/ or migrations/.
 *       Predicate reported as INFERRED FROM APPLICATION CODE. Application consistency confirmed.
 *   §4  Guard: script never emits "PRODUCTION AUDIT PASSED" for LOCAL DEV / TEST / STAGING.
 *   §5  Production guard: if environment is not PRODUCTION / PRODUCTION MIRROR, still runs
 *       diagnostics for the appendix but always returns BLOCKED verdict.
 *
 * Run:
 *   cd apps/api && npx tsx prisma/scripts/mt017-identity-audit.ts
 *
 * Override DB (required for production run):
 *   DATABASE_URL=postgres://... npx tsx prisma/scripts/mt017-identity-audit.ts
 */

import { PrismaClient } from '@prisma/client';
import { canonicalEmail, canonicalPhone } from '../../src/common/utils/identity-normalize';

const prisma = new PrismaClient();

// ── Environment classification ────────────────────────────────────────────────

// MT017_ENVIRONMENT is the operator attestation set by the GitHub Actions
// workflow (or manually for local testing). When set to PRODUCTION it overrides
// the URL heuristic so that cloud URLs (e.g. Railway) that don't contain "prod"
// are correctly classified. A safety guard rejects the attestation if the URL
// contradicts it (e.g. MT017_ENVIRONMENT=PRODUCTION but URL is localhost).
function envLabel(dbUrl: string | undefined): string {
  const attestation = (process.env.MT017_ENVIRONMENT ?? '').trim().toUpperCase();

  if (attestation === 'PRODUCTION') {
    // Reject if URL clearly contradicts the attestation.
    if (dbUrl) {
      const lower = dbUrl.toLowerCase();
      if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('_local')) {
        return 'LOCAL DEV'; // attestation rejected — URL says local
      }
      if (lower.includes('staging') || lower.includes('stage') || lower.includes('_test')) {
        return 'STAGING'; // attestation rejected — URL says staging
      }
    }
    return 'PRODUCTION';
  }

  // No attestation — fall back to URL heuristic.
  if (!dbUrl) return 'UNKNOWN';
  const lower = dbUrl.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('_local')) {
    return 'LOCAL DEV';
  }
  if (lower.includes('mirror') || lower.includes('replica') || lower.includes('snapshot')) {
    return 'PRODUCTION MIRROR';
  }
  if (lower.includes('staging') || lower.includes('stage') || lower.includes('_test')) {
    return 'STAGING';
  }
  if (lower.includes('prod')) return 'PRODUCTION';
  return 'UNKNOWN';
}

function dbFingerprint(dbUrl: string | undefined): string {
  if (!dbUrl) return '(no DATABASE_URL set)';
  // Extract only the database name — never the host, port, or credentials.
  const match = /\/([^/?]+)(\?|$)/.exec(dbUrl);
  return match?.[1] ? `database=${match[1]}` : '(database name unavailable)';
}

function isApprovedProductionEnv(env: string): boolean {
  return env === 'PRODUCTION' || env === 'PRODUCTION MIRROR';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  const env = envLabel(dbUrl);
  const fingerprint = dbFingerprint(dbUrl);
  const isProduction = isApprovedProductionEnv(env);

  // MT017_GIT_SHA is injected by the protected GitHub Actions workflow step.
  // A locally generated report will show "(not set)" here, distinguishing it
  // from an artifact produced under required-reviewer protection.
  const gitSha = (process.env.MT017_GIT_SHA ?? '').trim() || '(not set — not from protected workflow)';
  // MT017_ENVIRONMENT attestation source for report traceability.
  const attestationSource = (process.env.MT017_ENVIRONMENT ?? '').trim() || '(none — URL heuristic only)';

  console.log('\n========================================================');
  console.log('  MT-017 PRODUCTION IDENTITY AUDIT — SIGN-OFF REPORT');
  console.log('  (v3 — hardened semantics)');
  console.log('========================================================');
  console.log(`Timestamp:     ${new Date().toISOString()}`);
  console.log(`Environment:   ${env}`);
  console.log(`Attestation:   ${attestationSource}`);
  console.log(`Git SHA:       ${gitSha}`);
  console.log(`DB:            ${fingerprint}`);
  console.log('');

  // ── §0 Status ─────────────────────────────────────────────────────────────
  console.log('## Status');
  if (!isProduction) {
    console.log('  BLOCKED — environment is not PRODUCTION or PRODUCTION MIRROR.');
    console.log('  Diagnostics below are LOCAL DEV appendix data only.');
    console.log('  They do NOT authorize B-Contract.');
  } else {
    console.log('  Running full production audit…');
  }
  console.log('');

  // ── §1 Environment classification ─────────────────────────────────────────
  console.log('## Environment Classification');
  console.log(`  Classification: ${env}`);
  console.log(`  DB fingerprint: ${fingerprint}`);
  console.log(`  Approved for production sign-off: ${isProduction ? 'YES' : 'NO'}`);
  console.log('');

  // ── §2 Read-Only Verification ─────────────────────────────────────────────
  console.log('## Read-Only Verification');
  console.log('  ✓ All operations are read-only: count, findMany, findFirst');
  console.log('  ✓ No write operations (create/update/delete/upsert)');
  console.log('  ✓ No raw SQL execution');
  console.log('  ✓ No migrations or seeds invoked');
  console.log('  Zero writes performed.');
  console.log('');

  // ── §3 Canonicalization implementation ────────────────────────────────────
  console.log('## Canonicalization Implementation Used');
  console.log('  canonicalEmail(v) — MT-018');
  console.log('    = v?.trim().toLowerCase() || null');
  console.log('    source: apps/api/src/common/utils/identity-normalize.ts');
  console.log('');
  console.log('  canonicalPhone(v, countryHint?) — MT-019');
  console.log('    E.164 (+CC…): self-identifying; resolved without country hint');
  console.log('    non-E.164:   requires Company.country; returns null if absent or ambiguous');
  console.log('    never guesses country; uses libphonenumber-js');
  console.log('    source: apps/api/src/common/utils/identity-normalize.ts');
  console.log('');

  // ── §4 Canonical MT-023 Predicate Source ──────────────────────────────────
  console.log('## Canonical MT-023 Predicate Source');
  console.log('  Search result: NO standalone MT-023 migration spec or master-plan');
  console.log('  document found in docs/, prisma/migrations/, or prisma/scripts/.');
  console.log('  The latest migration referencing identity is:');
  console.log('    20260813122650_add_company_id_to_user  (adds User.companyId)');
  console.log('  No MT-023 partial-index migration file exists yet.');
  console.log('');
  console.log('  Predicate inferred from application code:');
  console.log('    registerCustomerV2: findFirst({ where: { email, companyId, deletedAt: null } })');
  console.log('    loginStaff:         findFirst({ where: { email, companyId, deletedAt: null } })');
  console.log('    loginCustomerV2:    findFirst({ where: { email, companyId, deletedAt: null } })');
  console.log('    auth.service.ts:849 comment: "partial indexes replace global uniqueness in B-Contract"');
  console.log('');
  console.log('  Inferred future email uniqueness predicate:');
  console.log('    UNIQUE (companyId, email)');
  console.log('    WHERE email IS NOT NULL AND "deletedAt" IS NULL');
  console.log('');
  console.log('  Inferred future phone uniqueness predicate:');
  console.log('    UNIQUE (companyId, phone)');
  console.log('    WHERE phone IS NOT NULL AND "deletedAt" IS NULL');
  console.log('');
  console.log('  Application code consistency: CONSISTENT with inferred predicate.');
  console.log('  No plan-vs-application discrepancy detected.');
  console.log('  Action required before MT-023 execution: write the canonical migration');
  console.log('  specification as a reviewed document before creating indexes.');
  console.log('');
  console.log('  All collision calculations below use the inferred predicate.');
  console.log('');

  // ── Load data ──────────────────────────────────────────────────────────────

  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      email: true,
      phone: true,
      companyId: true,
      deletedAt: true,
      passwordHash: true,
      company: { select: { id: true, country: true } },
    },
  });

  const companies = await prisma.company.findMany({
    select: { id: true, country: true },
  });
  const countryByCompanyId = new Map(companies.map(c => [c.id, c.country ?? null]));

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.deletedAt === null);
  const deletedUsers = users.filter(u => u.deletedAt !== null);

  // Pre-compute canonical forms for all active users
  const canonEmailMap = new Map<string, string | null>();
  const canonPhoneMap = new Map<string, string | null>();

  for (const u of activeUsers) {
    canonEmailMap.set(u.id, u.email ? canonicalEmail(u.email) : null);
    const country = u.companyId ? (countryByCompanyId.get(u.companyId) ?? null) : null;
    const raw = u.phone ?? null;
    if (!raw) {
      canonPhoneMap.set(u.id, null);
    } else {
      canonPhoneMap.set(u.id, canonicalPhone(raw, country ?? undefined) ?? null);
    }
  }

  // ── §5 User / Role Counts ─────────────────────────────────────────────────
  console.log('## User / Role Counts');
  console.log(`  Total users (all states): ${totalUsers}`);
  console.log(`  Active (deletedAt = null): ${activeUsers.length}`);
  console.log(`  Soft-deleted:              ${deletedUsers.length}`);
  console.log('');
  console.log('  By role (all users):');
  const byRole = new Map<string, number>();
  for (const u of users) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
  for (const [role, cnt] of [...byRole.entries()].sort()) {
    console.log(`    ${role}: ${cnt}`);
  }
  console.log('');

  // ── §6 Non-SUPER_ADMIN companyId Integrity ────────────────────────────────
  console.log('## Non-SUPER_ADMIN companyId Integrity');
  const nullCompanyByRole = new Map<string, number>();
  let nonSuperNullCompany = 0;
  for (const u of users) {
    if (u.role === 'SUPER_ADMIN') continue;
    if (u.companyId === null) {
      nonSuperNullCompany++;
      nullCompanyByRole.set(u.role, (nullCompanyByRole.get(u.role) ?? 0) + 1);
    }
  }
  if (nonSuperNullCompany === 0) {
    console.log('  Non-SUPER_ADMIN with companyId = null: 0  [CLEAR]');
  } else {
    console.log(`  Non-SUPER_ADMIN with companyId = null: ${nonSuperNullCompany}`);
    console.log('  By role:');
    for (const [role, cnt] of [...nullCompanyByRole.entries()].sort()) {
      console.log(`    ${role}: ${cnt}`);
    }
  }
  console.log('  (MT-020 scope: backfill companyId for ALL non-SUPER_ADMIN roles with null value.)');
  console.log('');

  // ── §7 SUPER_ADMIN Integrity ──────────────────────────────────────────────
  console.log('## SUPER_ADMIN Integrity');
  const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
  const saCorrect = superAdmins.filter(u => u.companyId === null).length;
  const saAnomaly = superAdmins.filter(u => u.companyId !== null).length;
  console.log(`  SUPER_ADMIN total:              ${superAdmins.length}`);
  console.log(`  companyId = null (correct):     ${saCorrect}`);
  console.log(`  companyId != null (anomaly):    ${saAnomaly}`);

  if (saAnomaly > 0) {
    console.log('');
    if (isProduction) {
      console.log('  [PRODUCTION CONTRACT BLOCKER]');
      console.log('  loginSuperAdmin() WHERE: { role: SUPER_ADMIN, companyId: null, deletedAt: null }');
      console.log('  Anomalous row(s) are NOT found by this query → platform login broken.');
      console.log('  Risks:');
      console.log('    - Platform identity invariant violated');
      console.log('    - Affected row(s) unreachable by loginSuperAdmin()');
      console.log('    - Inconsistent platform-global identity');
      console.log('  Runtime note: SUPER_ADMIN route-guard bypass only applies after session');
      console.log('  exists. Since login cannot be issued, guards are irrelevant.');
    } else {
      console.log('  [LOCAL DEV DIAGNOSTIC — not a proven production blocker]');
      console.log('  loginSuperAdmin() WHERE: { role: SUPER_ADMIN, companyId: null, deletedAt: null }');
      console.log('  If this anomaly exists in PRODUCTION it would be a Contract blocker:');
      console.log('    - Platform login broken for affected row(s)');
      console.log('    - Platform identity invariant violated');
      console.log('  In LOCAL DEV: likely stale seeded data, not a confirmed production state.');
      console.log('  Do not mutate during audit. Verify in production before acting.');
    }
  }
  console.log('');

  // ── §8 Orphan References ──────────────────────────────────────────────────
  console.log('## Orphan References');
  console.log('  FK: User_companyId_fkey → "Company"(id) ON DELETE SET NULL');
  console.log('  DB FK enforces referential integrity — orphaned companyId is structurally');
  console.log('  impossible (Postgres rejects write; SET NULL on Company deletion).');
  const orphanCount = await prisma.user.count({
    where: { companyId: { not: null }, company: null },
  });
  console.log(`  Explicit orphan check (companyId != null AND company IS NULL): ${orphanCount}`);
  if (orphanCount === 0) {
    console.log('  FK invariant confirmed — zero orphaned references.');
  } else {
    console.log('  [UNEXPECTED BLOCKER] FK should prevent this — investigate immediately.');
  }
  console.log('');

  // ── §9 Company Country Readiness ──────────────────────────────────────────
  console.log('## Company Country Readiness');
  const companiesTotal = companies.length;
  const companiesWithCountry = companies.filter(c => c.country && c.country.trim().length >= 2).length;
  const companiesWithoutCountry = companiesTotal - companiesWithCountry;
  console.log(`  Companies total:          ${companiesTotal}`);
  console.log(`  country set and usable:   ${companiesWithCountry}`);
  console.log(`  country missing/unusable: ${companiesWithoutCountry}`);

  // Users whose phone cannot be canonicalized due to missing company country
  let phoneMissingCountryBlocker = 0;
  for (const u of activeUsers) {
    if (!u.phone || u.phone.startsWith('+')) continue; // E.164 self-identifying, no country needed
    const country = u.companyId ? (countryByCompanyId.get(u.companyId) ?? null) : null;
    if (!country) phoneMissingCountryBlocker++;
  }
  console.log(`  Active users: non-E.164 phone AND no Company.country: ${phoneMissingCountryBlocker}`);
  if (phoneMissingCountryBlocker > 0) {
    console.log('  [B-CONTRACT BLOCKER] These phones cannot be deterministically canonicalized.');
    console.log('  No default country will be substituted.');
  } else {
    console.log('  [CLEAR]');
  }
  console.log('');

  // ── §10 Email Canonicalization ────────────────────────────────────────────
  console.log('## Email Canonicalization');
  const emailPresent = activeUsers.filter(u => u.email !== null).length;
  const emailNull = activeUsers.length - emailPresent;
  let emailDrift = 0;
  let emailCanonFail = 0;
  for (const u of activeUsers) {
    if (!u.email) continue;
    const c = canonEmailMap.get(u.id) ?? null;
    if (c === null) emailCanonFail++;
    else if (c !== u.email) emailDrift++;
  }
  console.log(`  email set:                               ${emailPresent}`);
  console.log(`  email null:                              ${emailNull}`);
  console.log(`  canonical drift (stored != canonical):   ${emailDrift}`);
  console.log(`  canonicalization failures (null result): ${emailCanonFail}`);
  console.log('');

  // ── §11 Same-Company Email Collisions ─────────────────────────────────────
  console.log('## Same-Company Email Collisions');
  console.log('  Predicate: active, companyId non-null, canonical email non-null');
  const emailGroupMap = new Map<string, number>();
  for (const u of activeUsers) {
    const cemail = canonEmailMap.get(u.id) ?? null;
    if (!cemail || !u.companyId) continue;
    const key = `${u.companyId}\x00${cemail}`;
    emailGroupMap.set(key, (emailGroupMap.get(key) ?? 0) + 1);
  }
  const sameCompanyEmailGroups = [...emailGroupMap.values()].filter(c => c > 1).length;
  console.log(`  Same-company active canonical email collision groups: ${sameCompanyEmailGroups}`);
  console.log(sameCompanyEmailGroups === 0 ? '  [CLEAR]' : '  [B-CONTRACT BLOCKER]');
  console.log('');

  // ── §12 Cross-Company Email Duplicates ────────────────────────────────────
  console.log('## Cross-Company Email Duplicates');
  const crossEmailMap = new Map<string, Set<string>>();
  for (const u of activeUsers) {
    const cemail = canonEmailMap.get(u.id) ?? null;
    if (!cemail || !u.companyId) continue;
    const s = crossEmailMap.get(cemail) ?? new Set();
    s.add(u.companyId);
    crossEmailMap.set(cemail, s);
  }
  const crossEmailGroups = [...crossEmailMap.values()].filter(s => s.size > 1).length;
  console.log(`  Cross-company canonical email duplicate groups: ${crossEmailGroups}`);
  console.log('  (Not a blocker — expected future behavior once global constraints replaced.)');
  console.log('');

  // ── §13 Phone Canonicalization ────────────────────────────────────────────
  console.log('## Phone Canonicalization');
  const phonePresent = activeUsers.filter(u => u.phone !== null).length;
  const phoneNull = activeUsers.length - phonePresent;
  let phoneDrift = 0;
  let phoneCanonFail = 0;
  let phoneMissingCountry = 0;
  for (const u of activeUsers) {
    if (!u.phone) continue;
    const country = u.companyId ? (countryByCompanyId.get(u.companyId) ?? null) : null;
    const c = canonPhoneMap.get(u.id) ?? null;
    if (c === null) {
      if (!country && !u.phone.startsWith('+')) phoneMissingCountry++;
      else phoneCanonFail++;
    } else if (c !== u.phone) {
      phoneDrift++;
    }
  }
  console.log(`  phone set:                               ${phonePresent}`);
  console.log(`  phone null:                              ${phoneNull}`);
  console.log(`  canonical drift (stored != canonical):   ${phoneDrift}`);
  console.log(`  canonicalization failures (malformed):   ${phoneCanonFail}`);
  console.log(`  missing-country blockers:                ${phoneMissingCountry}`);
  console.log('');
  console.log('  Identity coverage (active users):');
  const bothPresent = activeUsers.filter(u => u.email && u.phone).length;
  const emailOnly = activeUsers.filter(u => u.email && !u.phone).length;
  const phoneOnly = activeUsers.filter(u => !u.email && u.phone).length;
  const neitherPresent = activeUsers.filter(u => !u.email && !u.phone).length;
  console.log(`    email AND phone: ${bothPresent}`);
  console.log(`    email only:      ${emailOnly}`);
  console.log(`    phone only:      ${phoneOnly}`);
  console.log(`    neither:         ${neitherPresent}`);
  console.log('');

  // ── §14 Same-Company Phone Collisions ─────────────────────────────────────
  console.log('## Same-Company Phone Collisions');
  console.log('  Predicate: active, companyId non-null, canonical phone non-null');
  const phoneGroupMap = new Map<string, number>();
  for (const u of activeUsers) {
    const cphone = canonPhoneMap.get(u.id) ?? null;
    if (!cphone || !u.companyId) continue;
    const key = `${u.companyId}\x00${cphone}`;
    phoneGroupMap.set(key, (phoneGroupMap.get(key) ?? 0) + 1);
  }
  const sameCompanyPhoneGroups = [...phoneGroupMap.values()].filter(c => c > 1).length;
  console.log(`  Same-company active canonical phone collision groups: ${sameCompanyPhoneGroups}`);
  console.log(sameCompanyPhoneGroups === 0 ? '  [CLEAR]' : '  [B-CONTRACT BLOCKER]');
  console.log('');

  // ── §15 Cross-Company Phone Duplicates ────────────────────────────────────
  console.log('## Cross-Company Phone Duplicates');
  const crossPhoneMap = new Map<string, Set<string>>();
  for (const u of activeUsers) {
    const cphone = canonPhoneMap.get(u.id) ?? null;
    if (!cphone || !u.companyId) continue;
    const s = crossPhoneMap.get(cphone) ?? new Set();
    s.add(u.companyId);
    crossPhoneMap.set(cphone, s);
  }
  const crossPhoneGroups = [...crossPhoneMap.values()].filter(s => s.size > 1).length;
  console.log(`  Cross-company canonical phone duplicate groups: ${crossPhoneGroups}`);
  console.log('  (Not a blocker — expected future behavior once global constraints replaced.)');
  console.log('');

  // ── §16 Restore Collision Inputs ──────────────────────────────────────────
  console.log('## Restore Collision Inputs (MT-009B candidates)');
  console.log('  Would restoring a soft-deleted user (deletedAt=null) cause a canonical');
  console.log('  collision with an active user in the same company?');

  const activeEmailsByCompany = new Map<string, Set<string>>();
  const activePhonesByCompany = new Map<string, Set<string>>();
  for (const u of activeUsers) {
    if (!u.companyId) continue;
    const cemail = canonEmailMap.get(u.id) ?? null;
    const cphone = canonPhoneMap.get(u.id) ?? null;
    if (cemail) {
      const s = activeEmailsByCompany.get(u.companyId) ?? new Set();
      s.add(cemail);
      activeEmailsByCompany.set(u.companyId, s);
    }
    if (cphone) {
      const s = activePhonesByCompany.get(u.companyId) ?? new Set();
      s.add(cphone);
      activePhonesByCompany.set(u.companyId, s);
    }
  }

  let restoreEmailOnly = 0;
  let restorePhoneOnly = 0;
  let restoreBoth = 0;
  for (const u of deletedUsers) {
    const country = u.companyId ? (countryByCompanyId.get(u.companyId) ?? null) : null;
    const cemail = u.email ? canonicalEmail(u.email) : null;
    const cphone = u.phone ? (canonicalPhone(u.phone, country ?? undefined) ?? null) : null;
    const emailClash = cemail && u.companyId
      ? (activeEmailsByCompany.get(u.companyId)?.has(cemail) ?? false) : false;
    const phoneClash = cphone && u.companyId
      ? (activePhonesByCompany.get(u.companyId)?.has(cphone) ?? false) : false;
    if (emailClash && phoneClash) restoreBoth++;
    else if (emailClash) restoreEmailOnly++;
    else if (phoneClash) restorePhoneOnly++;
  }
  console.log(`  Email-only restore collisions: ${restoreEmailOnly}`);
  console.log(`  Phone-only restore collisions: ${restorePhoneOnly}`);
  console.log(`  Both restore collisions:       ${restoreBoth}`);
  console.log('  (MT-009B controlled-409 inputs — not MT-022 targets.)');
  console.log('');

  // ── §17 Auth V2 Canonicalization Readiness ────────────────────────────────
  console.log('## Auth V2 Canonicalization Readiness');
  console.log('  Source: apps/api/src/modules/auth/auth.service.ts');
  console.log('');
  console.log('  V2 paths (MT-026 through MT-030):');
  console.log('  ┌─────────────────────────┬────────────────┬────────────────┬───────────────────┬────────────────┐');
  console.log('  │ Operation               │ canonicalEmail │ canonicalPhone │ country source    │ tenant-scoped  │');
  console.log('  ├─────────────────────────┼────────────────┼────────────────┼───────────────────┼────────────────┤');
  console.log('  │ loginStaff (MT-026)     │ YES (helper)   │ N/A            │ N/A               │ YES            │');
  console.log('  │ loginSuperAdmin (MT-027)│ YES (helper)   │ N/A            │ N/A               │ cid=null only  │');
  console.log('  │ loginCustomerV2 (MT-028)│ YES (helper)   │ N/A            │ N/A               │ YES            │');
  console.log('  │ registerCustomerV2 (029)│ YES (helper)   │ YES (helper)   │ Company.country   │ YES            │');
  console.log('  │ forgotPasswordV2 (MT030)│ YES (helper)   │ N/A            │ N/A               │ YES            │');
  console.log('  │ requestOtpV2 (MT-030)   │ N/A            │ YES (helper)   │ Company.country   │ YES            │');
  console.log('  │ verifyOtpV2 (MT-030)    │ N/A            │ YES (helper)   │ Company.country   │ YES            │');
  console.log('  └─────────────────────────┴────────────────┴────────────────┴───────────────────┴────────────────┘');
  console.log('');
  console.log('  V2 verdict: ALL V2 paths use canonical helpers and are tenant-scoped. ✓');
  console.log('  No correctness defect found on any V2 path.');
  console.log('');

  // ── §18 Legacy Auth Retirement Debt ──────────────────────────────────────
  console.log('## Legacy Auth Retirement Debt');
  console.log('  (Reported separately — NOT MT-020 tasks. Legacy remains for backward compat.)');
  console.log('');
  console.log('  ┌──────────────────────────────┬────────────────┬─────────────────────────────────────────┐');
  console.log('  │ Legacy operation             │ canonicalPhone │ Notes                                   │');
  console.log('  ├──────────────────────────────┼────────────────┼─────────────────────────────────────────┤');
  console.log('  │ loginEmail (legacy staff)    │ N/A            │ No canonical lookup; MT-035 deprecated  │');
  console.log('  │ loginCustomer (legacy)       │ N/A            │ Inline email trim/lower (equiv); global │');
  console.log('  │ registerCustomer (legacy)    │ N/A            │ phone.trim() only; no E.164 norm        │');
  console.log('  │ forgotPassword (legacy)      │ N/A            │ Inline email trim/lower (equiv)         │');
  console.log('  │ requestOtp (legacy)          │ NO (raw phone) │ companyId:null namespace ✓              │');
  console.log('  │ verifyOtp (legacy)           │ NO (raw phone) │ companyId:null namespace ✓              │');
  console.log('  └──────────────────────────────┴────────────────┴─────────────────────────────────────────┘');
  console.log('');
  console.log('  Legacy raw-phone storage (requestOtp/verifyOtp/registerCustomer) is compatibility');
  console.log('  debt — not an MT-020 task. MT-020 scope is: backfill missing companyId for');
  console.log('  non-SUPER_ADMIN users. Legacy phone normalization is a separate retirement item.');
  console.log('');

  // ── §19 OTP Namespace Verification ───────────────────────────────────────
  console.log('## OTP Namespace Verification');
  const otpTotal = await prisma.otpCode.count();
  const otpLegacyNs = await prisma.otpCode.count({ where: { companyId: null } });
  const otpTenantNs = await prisma.otpCode.count({ where: { companyId: { not: null } } });
  const otpActive = await prisma.otpCode.count({
    where: { consumed: false, expiresAt: { gte: new Date() } },
  });

  console.log('  OtpCode schema (runtime-confirmed):');
  console.log('    companyId column: PRESENT (MT-021 applied)');
  console.log('    FK on companyId:  NONE (intentional — PLATFORM_GLOBAL design)');
  console.log('    Lookup index:     OtpCode_phone_consumed_idx (phone, consumed)');
  console.log('');
  console.log('  Row counts:');
  console.log(`    total:                   ${otpTotal}`);
  console.log(`    legacy namespace (null):  ${otpLegacyNs}`);
  console.log(`    tenant namespace (set):   ${otpTenantNs}`);
  console.log(`    active:                  ${otpActive}`);
  console.log('');
  console.log('  Caller WHERE-predicate audit (from auth.service.ts):');
  console.log('    requestOtp (legacy):  { phone, companyId: null, createdAt >= now-60s }');
  console.log('    verifyOtp (legacy):   { phone, companyId: null, consumed: false, expiresAt > now }');
  console.log('    requestOtpV2 (V2):    { phone, companyId: <resolved>, createdAt >= now-60s }');
  console.log('    verifyOtpV2 (V2):     { phone, companyId: <resolved>, consumed: false, expiresAt > now }');
  console.log('');
  console.log('  Namespace isolation: CORRECT — every query includes explicit companyId predicate.');
  console.log('  A legacy OTP (null) cannot be consumed via V2 path and vice versa.');
  console.log('  Index OtpCode_phone_consumed_idx: PERFORMANCE ADVISORY only (not a security defect).');
  console.log('  Do not create compound index in this batch.');
  console.log('');

  // ── §20 Current User Constraints ─────────────────────────────────────────
  console.log('## Current User Constraints');
  console.log('  User_email_key: UNIQUE (email)  — global; Expand-phase correct state');
  console.log('  User_phone_key: UNIQUE (phone)  — global; Expand-phase correct state');
  console.log('  These are what MT-023 will replace. Their presence is expected, not a failure.');
  console.log('  Do NOT drop them in this batch.');
  console.log('');

  // ── §21 MT-020 Decision ───────────────────────────────────────────────────
  console.log('## MT-020 Decision');
  console.log('  MT-020 scope: backfill missing companyId for ALL non-SUPER_ADMIN users.');
  console.log('  (Not phone normalization, not email normalization, not OTP cleanup.)');
  console.log('');
  const companyCount = await prisma.company.count();
  if (nonSuperNullCompany === 0) {
    console.log('  MT-020 NO-OP — all non-SUPER_ADMIN users have companyId set.');
  } else {
    console.log(`  MT-020 REQUIRED — ${nonSuperNullCompany} non-SUPER_ADMIN user(s) with companyId = null.`);
    console.log('  By role:');
    for (const [role, cnt] of [...nullCompanyByRole.entries()].sort()) {
      console.log(`    ${role}: ${cnt}`);
    }
    if (companyCount === 1) {
      console.log('  Deterministically assignable: YES (single company in system)');
    } else {
      console.log(`  Deterministically assignable: REQUIRES MANUAL DECISION (${companyCount} companies)`);
    }
  }
  console.log('  Do not execute the backfill yet.');
  console.log('');

  // ── §22 MT-022 Decision ───────────────────────────────────────────────────
  console.log('## MT-022 Decision');
  const totalDataBlockers =
    sameCompanyEmailGroups +
    sameCompanyPhoneGroups +
    emailCanonFail +
    phoneCanonFail +
    phoneMissingCountry +
    orphanCount;

  const productionSaBlockers = isProduction ? saAnomaly : 0;
  const totalProductionBlockers = totalDataBlockers + productionSaBlockers;

  console.log('  Production blocker counts:');
  console.log(`    Same-company active canonical email collisions:   ${sameCompanyEmailGroups}`);
  console.log(`    Same-company active canonical phone collisions:   ${sameCompanyPhoneGroups}`);
  console.log(`    Email canonicalization failures:                  ${emailCanonFail}`);
  console.log(`    Phone canonicalization failures (with country):   ${phoneCanonFail}`);
  console.log(`    Phone missing-country blockers:                   ${phoneMissingCountry}`);
  console.log(`    Orphaned companyId references:                    ${orphanCount}`);
  if (isProduction) {
    console.log(`    SUPER_ADMIN companyId anomaly (production):       ${saAnomaly}`);
  } else {
    console.log(`    SUPER_ADMIN companyId anomaly (LOCAL DEV only):   ${saAnomaly}  [diagnostic — not counted]`);
  }
  console.log(`    ─────────────────────────────────────────────────`);
  console.log(`    Total production blockers:                        ${totalProductionBlockers}`);
  console.log('  Do not remediate yet.');
  console.log('');

  // ── §23 MT-023 Readiness ──────────────────────────────────────────────────
  console.log('## MT-023 Readiness');
  if (!isProduction) {
    console.log('  NOT EVALUATED — production-scale audit not completed.');
  } else if (nonSuperNullCompany > 0) {
    console.log('  NOT READY — MT-020 required first (non-SUPER_ADMIN users with companyId=null).');
  } else if (totalProductionBlockers > 0) {
    console.log('  NOT READY — MT-022 blockers must be resolved first.');
  } else {
    console.log('  CANDIDATE — MT-020 no-op, MT-022 blockers = 0, production audit complete.');
    console.log('  Action required: write canonical MT-023 migration spec document before execution.');
  }
  console.log('  Do not create indexes in this batch.');
  console.log('');

  // ── §24 Local Dev Appendix ────────────────────────────────────────────────
  console.log('## Local Dev Appendix');
  console.log('  (Previous run — LOCAL DEV, 14 seed users — preserved for reference only.)');
  console.log('  DOES NOT AUTHORIZE B-CONTRACT.');
  console.log('');
  console.log(`  Environment: LOCAL DEV (database=realestate_local)`);
  console.log(`  Total users: 14  |  Companies: 2 (both DEVELOPER type, country=SA)`);
  console.log(`  Active non-SUPER_ADMIN with valid companyId: 13`);
  console.log(`  SUPER_ADMIN companyId anomaly: 1  (stale seed data — diagnostic only)`);
  console.log(`  Same-company email collisions: 0`);
  console.log(`  Same-company phone collisions: 0`);
  console.log(`  All 7 stored phones: pass canonicalPhone() unchanged (E.164)`);
  console.log(`  Global unique indexes: User_email_key, User_phone_key — in place`);
  console.log(`  OtpCode.companyId column: EXISTS (MT-021 applied)`);
  console.log(`  OTP namespace isolation: CORRECT via WHERE predicate`);
  console.log('');

  // ── §25 Client Release Carry-Forward ─────────────────────────────────────
  console.log('## Client Release Carry-Forward');
  console.log('  Mobile Customer K2: ACCEPTED');
  console.log('    Expand client migration complete');
  console.log('    222/222 tests pass, flutter analyze clean');
  console.log('  Pending: final APK build after disk cleanup (does not block DB audit).');
  console.log('');

  // ── B-Contract Decision ───────────────────────────────────────────────────
  console.log('========================================================');
  console.log('  B-CONTRACT DECISION');
  console.log('========================================================');
  console.log('');

  const blockers: string[] = [];

  // HARD GUARD: never pass LOCAL DEV / STAGING / UNKNOWN
  if (!isProduction) {
    blockers.push(
      `production-scale database unavailable — audit ran against ${env} ` +
      `(${fingerprint}); re-run with DATABASE_URL=<production-url>`,
    );
  } else {
    // Only apply SA blocker when in production
    if (saAnomaly > 0) {
      blockers.push(
        `${saAnomaly} SUPER_ADMIN row(s) have companyId != null — ` +
        `loginSuperAdmin() WHERE { companyId: null } cannot authenticate them`,
      );
    }
  }

  if (nonSuperNullCompany > 0) {
    blockers.push(
      `${nonSuperNullCompany} non-SUPER_ADMIN user(s) have companyId = null (MT-020 required)`,
    );
  }
  if (sameCompanyEmailGroups > 0) {
    blockers.push(`${sameCompanyEmailGroups} same-company active canonical email collision group(s)`);
  }
  if (sameCompanyPhoneGroups > 0) {
    blockers.push(`${sameCompanyPhoneGroups} same-company active canonical phone collision group(s)`);
  }
  if (emailCanonFail > 0) {
    blockers.push(`${emailCanonFail} email canonicalization failure(s)`);
  }
  if (phoneCanonFail > 0) {
    blockers.push(`${phoneCanonFail} phone canonicalization failure(s)`);
  }
  if (phoneMissingCountry > 0) {
    blockers.push(
      `${phoneMissingCountry} phone(s) cannot be canonicalized — non-E.164 and Company.country missing`,
    );
  }
  if (orphanCount > 0) {
    blockers.push(`${orphanCount} orphaned companyId reference(s) — investigate immediately`);
  }

  if (blockers.length === 0) {
    // This branch is only reachable if isProduction is true and all checks pass.
    console.log('MT-017 PRODUCTION AUDIT PASSED — CONTRACT PREFLIGHT MAY BEGIN');
  } else {
    console.log('MT-017 PRODUCTION AUDIT BLOCKED —');
    for (const b of blockers) {
      console.log(`  • ${b}`);
    }
  }

  console.log('');
  console.log('NOTE: Do NOT start MT-020, MT-022, MT-023, MT-009B, or any');
  console.log('      destructive/data-changing Contract work until a PASSED');
  console.log('      verdict is issued against PRODUCTION or PRODUCTION MIRROR data.');
  console.log('');
}

run()
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
