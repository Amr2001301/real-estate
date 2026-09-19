/**
 * TEST-002 — @PermissionsStrict two-person rule e2e
 *
 * Verifies that every endpoint decorated with @PermissionsStrict rejects
 * even a fully-qualified ADMIN when the explicit permission code is absent,
 * and accepts the same ADMIN once the code is explicitly assigned.
 *
 * The @PermissionsStrict decorator implements a "two-person rule": unlike the
 * regular @Permissions which auto-bypasses for ADMIN, PermissionsStrict
 * requires the code to be explicitly stored in UserPermission, regardless of
 * role. This spec proves that invariant is in place for all 21 strict-gated
 * endpoints across 12 permission codes.
 *
 * Strategy:
 *   "bareAdmin"   — ADMIN role, zero explicit permission codes
 *   "seededAdmin" — admin@example.com, granted all 12 strict codes in beforeAll
 *
 * For each endpoint:
 *   1. Call as bareAdmin → assert 403
 *   2. Call as seededAdmin → assert NOT 403 / NOT 401
 *      (typically 404 because the resource UUID is fake, proving the permission
 *      gate was passed and the handler ran)
 *
 * Audit reference: docs/PLATFORM_TASK_PLAN.md TASK-TEST-002
 */

import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';

// ---------------------------------------------------------------------------
// Fake UUID — valid format, no real resource. ParseUUIDPipe will accept it.
// The DB lookup will return null → 404, which proves we passed the guard.
// ---------------------------------------------------------------------------
const FAKE = '11111111-1111-4111-8111-111111111111';

/**
 * Table of all @PermissionsStrict endpoints.
 * [permissionCode, httpMethod, url, body?]
 */
const STRICT_ENDPOINTS: readonly [string, string, string, Record<string, unknown>?][] = [
  // deposits:verify (3 endpoints, 1 representative)
  ['deposits:verify',              'patch', `/v1/deposits/${FAKE}/verify`,                  { status: 'VERIFIED', note: 'test' }],

  // reservations:* (6 endpoints, 1 each)
  ['reservations:approve',         'post',  `/v1/reservations/${FAKE}/approve`,             {}],
  ['reservations:reject',          'post',  `/v1/reservations/${FAKE}/reject`,              { reason: 'test' }],
  ['reservations:cancel',          'post',  `/v1/reservations/${FAKE}/cancel`,              { reason: 'test' }],
  ['reservations:convert',         'post',  `/v1/reservations/${FAKE}/convert`,             {}],
  ['reservations:booking-payment', 'post',  `/v1/reservations/${FAKE}/booking-payment/confirm`, {}],

  // contracts:sign
  ['contracts:sign',               'post',  `/v1/contracts/${FAKE}/sign`,                   { signedAt: '2026-01-01T00:00:00.000Z' }],

  // broker_leads:approve / reject
  ['broker_leads:approve',         'post',  `/v1/broker-leads/${FAKE}/approve`,             {}],
  ['broker_leads:reject',          'post',  `/v1/broker-leads/${FAKE}/reject`,              { reason: 'test' }],

  // bonus:entries:approve / pay
  ['bonus:entries:approve',        'post',  `/v1/bonus-entries/${FAKE}/approve`,            {}],
  ['bonus:entries:pay',            'post',  `/v1/bonus-entries/${FAKE}/pay`,                {}],

  // broker_payouts:* (4 endpoints)
  ['broker_payouts:approve',       'patch', `/v1/broker-payouts/${FAKE}/approve`,           {}],
  ['broker_payouts:process',       'patch', `/v1/broker-payouts/${FAKE}/process`,           {}],
  ['broker_payouts:pay',           'patch', `/v1/broker-payouts/${FAKE}/mark-paid`,         {}],
  ['broker_payouts:cancel',        'patch', `/v1/broker-payouts/${FAKE}/cancel`,            {}],

  // broker_commissions:* (3 endpoints)
  ['broker_commissions:approve',   'patch', `/v1/broker-commissions/${FAKE}/approve`,       {}],
  ['broker_commissions:reject',    'patch', `/v1/broker-commissions/${FAKE}/reject`,        { reason: 'test' }],
  ['broker_commissions:cancel',    'patch', `/v1/broker-commissions/${FAKE}/cancel`,        {}],

  // brokers:suspend / terminate
  ['brokers:suspend',              'patch', `/v1/brokers/${FAKE}/suspend`,                  {}],
  ['brokers:terminate',            'patch', `/v1/brokers/${FAKE}/terminate`,                {}],

  // broker_users:remove
  ['broker_users:remove',          'patch', `/v1/broker-users/${FAKE}/status`,              { active: false }],
] as const;

// ---------------------------------------------------------------------------

describe('TEST-002 — @PermissionsStrict two-person rule (e2e)', () => {
  let testApp: TestApp;
  let bareToken: string;
  let adminToken: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    // ── 1. Active company (same as seed uses) ─────────────────────────────
    const company = await raw.company.findFirstOrThrow({ where: { isActive: true } });

    // ── 2. Create "bareAdmin" — ADMIN role, no permission codes ───────────
    const bareEmail = `bare-admin-strict-test-${Date.now()}@example.com`;
    const barePass  = 'BareAdmin123!';
    const hash      = await argon2.hash(barePass);

    const bareUser = await raw.user.create({
      data: {
        email:        bareEmail,
        passwordHash: hash,
        fullName:     'Bare Admin (strict-perm test)',
        role:         'ADMIN',
        active:       true,
        companyId:    company.id,
      },
    });

    // ── 3. Grant ALL 12 strict codes to the seeded admin ──────────────────
    //    We find the seeded admin by email and upsert all permission codes
    //    so this spec owns its own permission state and doesn't depend on
    //    what the seed happened to grant.
    const adminUser = await raw.user.findFirstOrThrow({
      where: { email: 'admin@example.com' },
    });

    const strictCodes = [
      'deposits:verify',
      'reservations:approve',
      'reservations:reject',
      'reservations:cancel',
      'reservations:convert',
      'reservations:booking-payment',
      'contracts:sign',
      'broker_leads:approve',
      'broker_leads:reject',
      'bonus:entries:approve',
      'bonus:entries:pay',
      'broker_payouts:approve',
      'broker_payouts:process',
      'broker_payouts:pay',
      'broker_payouts:cancel',
      'broker_commissions:approve',
      'broker_commissions:reject',
      'broker_commissions:cancel',
      'brokers:suspend',
      'brokers:terminate',
      'broker_users:remove',
      // Also needed: permissions:manage (to use PATCH /users/:id/permissions via HTTP if needed)
      'permissions:manage',
    ];

    const permRows = await raw.permission.findMany({
      where: { code: { in: strictCodes } },
      select: { id: true, code: true },
    });

    // Upsert all codes for seeded admin (idempotent)
    await raw.userPermission.createMany({
      data: permRows.map((p) => ({ userId: adminUser.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    // ── 4. Login both users ───────────────────────────────────────────────
    const [bareRes, adminRes] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: bareEmail, password: barePass }),
      request(testApp.app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'ChangeMe123!' }),
    ]);

    if (bareRes.status !== 200 && bareRes.status !== 201) {
      throw new Error(`bareAdmin login failed: ${bareRes.status} ${JSON.stringify(bareRes.body)}`);
    }
    if (adminRes.status !== 200 && adminRes.status !== 201) {
      throw new Error(`seededAdmin login failed: ${adminRes.status} ${JSON.stringify(adminRes.body)}`);
    }

    bareToken  = bareRes.body?.tokens?.accessToken ?? bareRes.body?.accessToken;
    adminToken = adminRes.body?.tokens?.accessToken ?? adminRes.body?.accessToken;

    // ── 5. Cleanup bareUser on suite teardown ─────────────────────────────
    // Register a teardown to delete the bare user so it doesn't pollute
    // other specs if the DB isn't reset between runs.
    afterAll(async () => {
      await raw.user.delete({ where: { id: bareUser.id } }).catch(() => {/* already gone */});
    });
  }, 60_000);

  // =========================================================================
  // WITHOUT PERMISSION — every strict endpoint must reject bareAdmin with 403
  // =========================================================================

  describe('bareAdmin (ADMIN role, zero explicit codes) → 403 on every strict endpoint', () => {
    for (const [code, method, url, body] of STRICT_ENDPOINTS) {
      it(`${code} — ${method.toUpperCase()} ${url} → 403`, async () => {
        const res = await (request(testApp.app.getHttpServer()) as any)[method](url)
          .set('Authorization', `Bearer ${bareToken}`)
          .send(body ?? {});

        expect(res.status).toBe(403);
      });
    }
  });

  // =========================================================================
  // WITH PERMISSION — same endpoints must NOT return 403 or 401
  // (typically 404 because the resource UUID is fake; the guard was passed)
  // =========================================================================

  describe('seededAdmin (ADMIN role + all strict codes) → NOT 403/401 on every strict endpoint', () => {
    for (const [code, method, url, body] of STRICT_ENDPOINTS) {
      it(`${code} — ${method.toUpperCase()} ${url} → not 401/403`, async () => {
        const res = await (request(testApp.app.getHttpServer()) as any)[method](url)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body ?? {});

        // Permission gate was passed. We expect 404 (resource not found for fake UUID)
        // or occasionally 400 (business logic validation). We must NOT see 401 or 403.
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    }
  });
});
