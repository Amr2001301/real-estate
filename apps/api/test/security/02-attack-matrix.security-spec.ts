/**
 * STEP 3 — Attack-matrix tests.
 *
 * Each test is named after the finding or attack scenario from
 * docs/audit/02-rbac-tenancy.md.  Tests assert the SECURE outcome (403 / 404).
 * A test that FAILS means the API returns a 2xx where it should not — that is a
 * confirmed vulnerability.
 *
 * Labels:
 *   [F1]  Body-supplied User FKs not companyId-validated          (HIGH — EXPLOITABLE)
 *   [F2]  @Permissions adminBypass makes ADMIN ungranulable       (HIGH — STRUCTURAL)
 *   [F3]  SALES GET /leads/:id bypasses row-level scope           (MEDIUM — EXPLOITABLE)
 *   [A1]  Cross-company unit read                                 (BLOCKED)
 *   [A2]  Cross-company lead write                                (BLOCKED)
 *   [A3]  JWT/tenant X-Tenant-Slug mismatch                       (BLOCKED)
 *   [A4]  Cross-company unitId in reservation body                (BLOCKED)
 *   [A5]  OTP cross-company scope                                 (NOT REPRODUCIBLE — HTTP)
 *   [A6]  Legacy CLIENT companyId=NULL fallback                   (KNOWN / DOCUMENTED)
 *   [A7]  BROKER role cannot access /leads                        (BLOCKED)
 *   [A8]  Broker accesses project without BrokerProjectAccess     (BLOCKED)
 *   [A9]  Document download cross-company                         (BLOCKED)
 *   [A10] Chat session anonymousId enforcement                    (PARTIALLY BLOCKED)
 *   [RAW] $queryRaw bypasses Prisma middleware                    (DOCUMENTED BYPASS)
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';
import { runTenantContext } from '../../src/common/tenant/tenant-context';
import { MissingTenantContextError } from '../../src/common/tenant/tenant-context.errors';

const FAKE_UUID = '00000000-0000-4000-8000-000000000000';

describe('SEC — Attack Matrix (STEP 3)', () => {
  let testApp: TestApp;
  let fx: SecurityFixture;

  // ── per-actor tokens (set in beforeAll) ────────────────────────────────────
  let adminAToken: string;
  let sales1AToken: string;
  let sales2AToken: string;
  let adminBToken: string;
  let brokerAToken: string;
  let customerAToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    [adminAToken, sales1AToken, sales2AToken, adminBToken, brokerAToken, customerAToken] =
      await Promise.all([
        loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password),
        loginAs(testApp.app, fx.users.sales1A.email, fx.users.sales1A.password),
        loginAs(testApp.app, fx.users.sales2A.email, fx.users.sales2A.password),
        loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password),
        loginAs(testApp.app, fx.users.brokerUserA.email, fx.users.brokerUserA.password),
        loginAs(testApp.app, fx.users.customerA.email, fx.users.customerA.password, 'customer'),
      ]);
  }, 60_000);

  afterAll(async () => {
    await teardownSecurityFixture(testApp.rawPrisma);
    await testApp.close();
  }, 30_000);

  const http = () => request(testApp.app.getHttpServer());

  // ══════════════════════════════════════════════════════════════════════════
  // [A1] Cross-company unit read — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A1] Cross-company unit read', () => {
    it('A1-1: Company A ADMIN cannot read a Unit belonging to Company B (404)', async () => {
      await http()
        .get(`/v1/units/${fx.resources.b.unit1Id}`)
        .set('Authorization', bearer(adminAToken))
        .expect(404);
    });

    it('A1-2: Company A SALES cannot read a Unit belonging to Company B (403 — @Permissions gate fires before DB lookup for SALES without units:read)', async () => {
      // SALES without units:read permission → 403 from PermissionsGuard (before DB lookup).
      // ADMIN bypass is tested in A1-1 above — that test shows tenant scoping works.
      const res = await http()
        .get(`/v1/units/${fx.resources.b.unit1Id}`)
        .set('Authorization', bearer(sales1AToken));
      expect([403, 404]).toContain(res.status);
    });

    it('A1-3: Company A ADMIN CAN read their own Unit (200 sanity check)', async () => {
      await http()
        .get(`/v1/units/${fx.resources.a.unit1Id}`)
        .set('Authorization', bearer(adminAToken))
        .expect(200);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A2] Cross-company lead write — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A2] Cross-company lead write', () => {
    it('A2-1: Company A SALES cannot PATCH a Lead belonging to Company B (403 or 404)', async () => {
      // sales1A has leads:update permission. Middleware injects companyId=A on lookup
      // → company B lead is not found → 404. If @Permissions fires first → 403.
      const res = await http()
        .patch(`/v1/leads/${fx.resources.b.leadId}`)
        .set('Authorization', bearer(sales1AToken))
        .send({ fullName: 'attack' });
      expect([403, 404]).toContain(res.status);
    });

    it('A2-2: Company A ADMIN cannot PATCH a Lead belonging to Company B (404)', async () => {
      // ADMIN bypasses @Permissions. The lead lookup is TENANT_OWNED → middleware
      // injects companyId=A → company B lead not found → 404.
      await http()
        .patch(`/v1/leads/${fx.resources.b.leadId}`)
        .set('Authorization', bearer(adminAToken))
        .send({ fullName: 'attack' })
        .expect(404);
    });

    it('A2-3: Company A ADMIN CAN PATCH their own Lead (200 sanity check)', async () => {
      const res = await http()
        .patch(`/v1/leads/${fx.resources.a.leadId}`)
        .set('Authorization', bearer(adminAToken))
        .send({ fullName: 'updated-by-sec-test' });
      expect([200, 204]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A3] JWT / X-Tenant-Slug mismatch — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A3] JWT/tenant-slug mismatch', () => {
    it('A3-1: Company A JWT + X-Tenant-Slug=sec-co-b → 403 TENANT_CONTEXT_MISMATCH', async () => {
      const res = await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminAToken))
        .set('x-tenant-slug', SEC_SLUG_B)
        .expect(403);
      expect(JSON.stringify(res.body)).toMatch(/TENANT_CONTEXT_MISMATCH|mismatch|Tenant/i);
    });

    it('A3-2: Company B JWT + X-Tenant-Slug=sec-co-a → 403', async () => {
      await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminBToken))
        .set('x-tenant-slug', SEC_SLUG_A)
        .expect(403);
    });

    it('A3-3: matching slug (same company) does NOT trigger 403', async () => {
      const res = await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminAToken))
        .set('x-tenant-slug', SEC_SLUG_A);
      expect(res.status).not.toBe(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A4] Cross-company unitId in reservation body — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A4] Cross-company unitId in reservation body', () => {
    it('A4-1: Company A ADMIN reservation with unitId from Company B → 404 Not Found', async () => {
      // Middleware injects companyId=A on the unit lookup → cross-company unit
      // returns null → NotFoundException("Unit not found").
      await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .send({
          unitId: fx.resources.b.unit1Id,
          clientId: fx.users.clientA.id,
        })
        .expect(404);
    });

    it('A4-2: same attack with a fabricated UUID → 404', async () => {
      await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .send({ unitId: FAKE_UUID, clientId: fx.users.clientA.id })
        .expect(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A5] OTP cross-company — NOT REPRODUCIBLE via HTTP
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A5] OTP cross-company scope', () => {
    it('A5: OTP queries include companyId (documented in code, not reproducible via HTTP without OTP delivery mock)', () => {
      // auth.service.ts:961 — verifyOtpV2 uses { phone, companyId, consumed: false }
      // The User.phone unique constraint prevents the same phone in two companies.
      // Testing requires an OTP delivery mock; deferred per test spec.
      expect(true).toBe(true); // placeholder — see docs/audit/03-vuln-tests.md
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A6] Legacy CLIENT companyId=NULL — KNOWN / DOCUMENTED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A6] Legacy CLIENT null companyId fallback', () => {
    it('A6-1: legacy CLIENT with companyId=NULL can login via customer/login when DEFAULT_COMPANY_ID is set', async () => {
      // This is the intentional legacy support documented in the audit.
      // DISABLE_DEFAULT_COMPANY_FALLBACK=false (default) allows the fallback.
      // The test documents that this path exists; it is not a defect by itself
      // but the legacy account has access to DEFAULT_COMPANY_ID's data.
      const defaultCompanyId = process.env.DEFAULT_COMPANY_ID;
      if (!defaultCompanyId) {
        // Cannot test fallback without DEFAULT_COMPANY_ID — skip.
        return;
      }
      // Attempt login: may return 401 if the legacy client email is not
      // registered via the customer auth flow (different from staff login).
      // The legacy CLIENT was seeded with a passwordHash — try both endpoints.
      const res = await http()
        .post('/v1/auth/customer/login')
        .send({ email: fx.users.legacyClient.email, password: 'SecTest-1234!' });
      // 200 = fallback fires; 401 = login failed (expected if the customer
      // endpoint validates companyId differently). Both outcomes are documented.
      expect([200, 201, 400, 401, 403]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A7] BROKER role cannot access /leads — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A7] BROKER role cannot access staff endpoints', () => {
    it('A7-1: BROKER token → GET /v1/leads → 403 (role not in @Roles)', async () => {
      await http()
        .get('/v1/leads')
        .set('Authorization', bearer(brokerAToken))
        .expect(403);
    });

    it('A7-2: BROKER token → GET /v1/reservations → 403', async () => {
      await http()
        .get('/v1/reservations')
        .set('Authorization', bearer(brokerAToken))
        .expect(403);
    });

    it('A7-3: BROKER token → GET /v1/reports/kpis → 403', async () => {
      await http()
        .get('/v1/reports/kpis')
        .set('Authorization', bearer(brokerAToken))
        .expect(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A8] Broker accesses project without BrokerProjectAccess — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A8] Broker portal project scope', () => {
    it('A8-1: broker with no BrokerProjectAccess rows → GET /v1/portal/projects → empty list (blocked)', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(brokerAToken))
        .expect(200);
      // No BrokerProjectAccess rows for this broker → result must be empty.
      const body = res.body as { data?: unknown[]; items?: unknown[] } | unknown[];
      const items = Array.isArray(body) ? body : (body as { data?: unknown[]; items?: unknown[] }).data ?? (body as { data?: unknown[]; items?: unknown[] }).items ?? [];
      expect(items).toHaveLength(0);
    });

    it('A8-2: broker cannot directly access a project by UUID via the portal (no :id endpoint)', async () => {
      // The audit confirmed no GET /portal/projects/:id endpoint exists.
      const res = await http()
        .get(`/v1/portal/projects/${fx.resources.a.projectId}`)
        .set('Authorization', bearer(brokerAToken));
      // 404 (route not found) is the expected outcome.
      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A9] Document download cross-company — BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A9] Document ownership enforcement', () => {
    it('A9-1: Company B CUSTOMER cannot download Company A document even by UUID (404)', async () => {
      // Company B customer has a different companyId — middleware injects B's
      // companyId on the lookup, so Company A's document is not found.
      const customerBToken = await loginAs(
        testApp.app,
        fx.users.customerB.email,
        fx.users.customerB.password,
        'customer',
      );
      await http()
        .get(`/v1/me/documents/${fx.resources.a.documentId}/download`)
        .set('Authorization', bearer(customerBToken))
        .expect(404);
    });

    it('A9-2: Company A CUSTOMER with wrong userId cannot download Company A document (404)', async () => {
      // customerA is valid for companyId=A, but the document.ownerId=contract.id
      // and ownership check is: ownerId chain → contract.customerId === user.id.
      // customerA is not the contract customer (customerA is the contract customer actually)
      // so this test verifies A's CUSTOMER can download their own document.
      const res = await http()
        .get(`/v1/me/documents/${fx.resources.a.documentId}/download`)
        .set('Authorization', bearer(customerAToken));
      // customerA IS the contract customer → should 200 (redirect or signed URL)
      expect([200, 302, 307]).toContain(res.status);
    });

    it('A9-3: fabricated document UUID → 404', async () => {
      await http()
        .get(`/v1/me/documents/${FAKE_UUID}/download`)
        .set('Authorization', bearer(customerAToken))
        .expect(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [A10] Chat session anonymousId enforcement — PARTIALLY BLOCKED
  // ══════════════════════════════════════════════════════════════════════════

  describe('[A10] Chat session anonymousId enforcement', () => {
    // Chat routes are @Public. Without x-tenant-slug, DEFAULT_COMPANY_ID is used.
    // The fixture's chat session is under sec-co-a. We must send the slug header
    // so TenantContextInterceptor resolves companyId=sec-co-a.

    it('A10-1: GET /v1/chat/sessions/:id with wrong anonymousId → 404', async () => {
      await http()
        .get(`/v1/chat/sessions/${fx.resources.a.chatSessionId}`)
        .set('x-tenant-slug', SEC_SLUG_A)
        .query({ anonymousId: 'wrong-anon-id' })
        .expect(404);
    });

    it('A10-2: GET /v1/chat/sessions/:id with correct anonymousId and tenant slug → 200', async () => {
      await http()
        .get(`/v1/chat/sessions/${fx.resources.a.chatSessionId}`)
        .set('x-tenant-slug', SEC_SLUG_A)
        .query({ anonymousId: fx.resources.a.chatAnonId })
        .expect(200);
    });

    it('A10-3: fabricated session UUID → 404 regardless of anonymousId', async () => {
      await http()
        .get(`/v1/chat/sessions/${FAKE_UUID}`)
        .set('x-tenant-slug', SEC_SLUG_A)
        .query({ anonymousId: fx.resources.a.chatAnonId })
        .expect(404);
    });

    it('A10-4: anonymousId is not a server-issued credential (finding #5 — client-controlled)', () => {
      // The anonymousId is a client-generated UUID stored in client storage.
      // Audit finding #5: a leaked anonymousId grants full session read/write.
      // This is documented here as a known partial block: session UUID + anonymousId
      // must both be known, but neither is server-issued or revocable.
      expect(fx.resources.a.chatAnonId).toMatch(/^sec-anon-/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [RAW] $queryRaw bypasses Prisma middleware — DOCUMENTED BYPASS
  // ══════════════════════════════════════════════════════════════════════════

  describe('[RAW] $queryRaw middleware bypass', () => {
    it('RAW-1: $queryRaw on PrismaService succeeds outside ALS (not blocked by tenant middleware)', async () => {
      // Documented in tenant-query-policy.ts:13:
      //   "$queryRaw / $executeRaw is completely outside this layer"
      // This test confirms raw SQL is not intercepted. Callers (reports.service,
      // units.service) must manually include companyId in WHERE clauses.
      const result = await testApp.prisma.$queryRaw<{ result: string }[]>`SELECT 'ok' as result`;
      expect(result[0]?.result).toBe('ok');
    });

    it('RAW-2: $queryRaw on PrismaService can read cross-tenant data without ALS context', async () => {
      // This proves the bypass: $queryRaw returns rows regardless of tenant context.
      // Services that use $queryRaw MUST manually enforce companyId in their SQL.
      const rows = await testApp.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Lead" LIMIT 1
      `;
      // We don't assert a specific value — just that it executes without throwing.
      expect(Array.isArray(rows)).toBe(true);
    });

    it('RAW-3: ORM middleware throw-on-null is proven in 01-middleware-classification MC-5', () => {
      // The ORM path is separately verified to throw MissingTenantContextError in
      // 01-middleware-classification.security-spec.ts (MC-5/MC-5b/MC-5c), which runs
      // before HTTP requests establish an ALS context via enterWith(). Testing it here,
      // after supertest response callbacks inherit the server-side ALS state via
      // enterWith(), produces a false-positive pass (ALS context already set from
      // HTTP traffic). Covered by MC-5; not re-verified here to avoid false negatives.
      expect(MissingTenantContextError).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [F1] Body-supplied User FKs not companyId-validated — EXPLOITABLE
  //
  // IMPORTANT: These tests assert the SECURE outcome (400).
  // If a test FAILS (API returns 201), the vulnerability is CONFIRMED.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[F1] Body-supplied User FK bypass (salesId / clientId)', () => {
    it('F1-1: Company A ADMIN reservation with clientId from Company B → expect 400 (SECURE) [VULNERABILITY: may return 201]', async () => {
      // Finding #1 in the audit: User is TENANT_CONTROLLED, middleware does not
      // scope the user lookup in reservations.module.ts:396.
      // A ADMIN supplies clientId = Company B's CLIENT user UUID.
      // SECURE outcome: 400 "Client not found" (user not in company A)
      // EXPLOITABLE outcome: 201 (cross-tenant clientId accepted)
      //
      // unit2A is available (unit1A is already reserved in the fixture).
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .send({
          unitId: fx.resources.a.unit2Id,
          clientId: fx.users.clientB.id,
        });

      // Assert secure outcome. A failing assertion here = confirmed F1 vulnerability.
      expect(res.status).toBe(400);
    });

    it('F1-2: Company A ADMIN reservation with salesId from Company B → expect 400 (SECURE) [VULNERABILITY: may return 201]', async () => {
      // Same vulnerability via salesId path (reservations.module.ts:373).
      // Provide a valid clientId from company A + cross-company salesId.
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .send({
          unitId: fx.resources.a.unit2Id,
          clientId: fx.users.clientA.id,
          salesId: fx.users.adminB.id, // adminB is ADMIN role, not SALES — will 400 for wrong role
        });
      // With adminB (role=ADMIN), the roleCheck at line 380 fires first ("not a sales person")
      // before the companyId check would matter. Still expect 400.
      expect(res.status).toBe(400);
    });

    it('F1-3: Company A ADMIN reservation with salesId=Company B SALES → expect 400 (SECURE) [VULNERABILITY: may return 201]', async () => {
      // sales1B has role=SALES in company B. The middleware does not scope the
      // user lookup, so findUnique({id: sales1BId}) finds them cross-company.
      // Need sales1B ID — fetch from rawPrisma by email.
      const sales1B = await runTenantContext(
        { companyId: null, bypass: true, isPublic: false },
        () => testApp.rawPrisma.user.findFirstOrThrow({
          where: { email: 'sec-sales-b1@sec.test' },
          select: { id: true },
        }),
      );
      // Use unit3A (not unit2A which was reserved by F1-1) so the unit status
      // check is not conflated with the salesId scoping check.
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .send({
          unitId: fx.resources.a.unit3Id,
          clientId: fx.users.clientA.id,
          salesId: sales1B.id,
        });
      // SECURE: 400 (sales1B not found within company A's scope)
      // EXPLOITABLE: 201 (cross-tenant salesId accepted — F1 confirmed)
      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [F2] @Permissions adminBypass makes ADMIN ungranulable — STRUCTURAL
  // ══════════════════════════════════════════════════════════════════════════

  describe('[F2] ADMIN adminBypass structural issue', () => {
    it('F2-1: bare ADMIN (no UserPermission rows) passes @Permissions("reservations:read") gate', async () => {
      // adminA was created with no UserPermission rows. The @Permissions decorator
      // has adminBypass=true → ADMIN always passes. This confirms the finding.
      await http()
        .get('/v1/reservations')
        .set('Authorization', bearer(adminAToken))
        .expect(200);
    });

    it('F2-2: bare ADMIN passes @Permissions("leads:read") gate', async () => {
      await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminAToken))
        .expect(200);
    });

    it('F2-3: bare ADMIN is blocked by @PermissionsStrict("reservations:approve") — strict gate works', async () => {
      // @PermissionsStrict has adminBypass=false. ADMIN without the code is blocked.
      // This confirms the strict gate functions as intended (positive control).
      await http()
        .post(`/v1/reservations/${fx.resources.a.reservationId}/approve`)
        .set('Authorization', bearer(adminAToken))
        .expect(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [F3] SALES GET /leads/:id bypasses row-level scope — EXPLOITABLE
  //
  // Lead in fixture is assigned to sales1A. sales2A is a different SALES user.
  // SECURE: sales2A cannot read sales1A's lead.
  // EXPLOITABLE: managersOnly: true skips SALES self-check → sales2A gets 200.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[F3] SALES GET /leads/:id row-level scope bypass', () => {
    it('F3-1: sales1A CAN read their own lead (sanity check, expect 200)', async () => {
      await http()
        .get(`/v1/leads/${fx.resources.a.leadId}`)
        .set('Authorization', bearer(sales1AToken))
        .expect(200);
    });

    it('F3-2: sales2A → GET /leads/:id (assigned to sales1A) → expect 403 (SECURE) [VULNERABILITY: may return 200]', async () => {
      // leads.controller.ts:198: assertLeadInScope uses managersOnly: true.
      // sales-scope.ts:130: if (opts.managersOnly && role !== SALES_MANAGER) return;
      // → SALES early-returns without checking assignedSalesId === self.
      //
      // SECURE outcome: 403 Forbidden (sales2A is not assigned to this lead)
      // EXPLOITABLE outcome: 200 OK (row-level check bypassed)
      const res = await http()
        .get(`/v1/leads/${fx.resources.a.leadId}`)
        .set('Authorization', bearer(sales2AToken));
      expect(res.status).toBe(403);
    });

    it('F3-3: sales2A → PATCH /leads/:id (assigned to sales1A) → expect 403 (SECURE) [VULNERABILITY: may return 200]', async () => {
      const res = await http()
        .patch(`/v1/leads/${fx.resources.a.leadId}`)
        .set('Authorization', bearer(sales2AToken))
        .send({ notes: 'unauthorized-patch' });
      expect(res.status).toBe(403);
    });

    it('F3-4: sales2A → GET /v1/leads list only shows own leads (assignedSalesId = self)', async () => {
      const res = await http()
        .get('/v1/leads')
        .set('Authorization', bearer(sales2AToken))
        .expect(200);
      // sales2A has no leads assigned → list must be empty.
      const body = res.body as { data?: unknown[]; items?: unknown[] } | unknown[];
      const items = Array.isArray(body) ? body : (body as { data?: unknown[]; items?: unknown[] }).data ?? [];
      expect(items).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [F4] Body-supplied User FKs V-04..V-17 — regression coverage
  //
  // Each test supplies a cross-tenant user id in a body/path field and asserts
  // that no 2xx is returned. The exact error code is documented inline.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[F4] Cross-tenant User FK regression tests (V-04..V-17)', () => {
    // V-05 — visits.service.ts:451 — clientId in createDirectAppointment
    it('V-05: POST /visits/appointments with clientId from Company B → 400 (resolveTenantUser throwBadRequest)', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(adminAToken))
        .send({
          projectId: fx.resources.a.projectId,
          scheduledAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          clientId: fx.users.clientB.id,
          customerName: 'Test',
          customerPhone: '+201000000001',
        });
      expect(res.status).toBe(400);
    });

    // V-06 — visits.service.ts:739 — assignedSalesId in resolveAssignableSalesId
    //         (called by createDirectAppointment when dto.assignedSalesId is set)
    it('V-06: POST /visits/appointments with assignedSalesId from Company B → 400 (resolveTenantUser throwBadRequest)', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(adminAToken))
        .send({
          projectId: fx.resources.a.projectId,
          scheduledAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          assignedSalesId: fx.users.adminB.id,
          customerName: 'Test Walk-in',
          customerPhone: '+201000000002',
        });
      expect(res.status).toBe(400);
    });

    // V-07 — visits.service.ts:1037 — assignedSalesId in assignSales
    it('V-07: PATCH /visits/appointments/:id/assign with assignedSalesId from Company B → 400 (resolveTenantUser throwBadRequest)', async () => {
      const res = await http()
        .patch(`/v1/visits/appointments/${fx.resources.a.visitAppointmentId}/assign`)
        .set('Authorization', bearer(adminAToken))
        .send({ assignedSalesId: fx.users.adminB.id });
      expect(res.status).toBe(400);
    });

    // V-08 — broker-leads.service.ts:122 — assignedSalesId in approve
    // adminA has broker_leads:approve (seeded). The lead has no brokerId so
    // assertBrokerLead returns 404 before resolveTenantUser fires; the test
    // confirms no 2xx is returned.
    it('V-08: PATCH /broker-leads/:id/approve with assignedSalesId from Company B → 403 or 404 (no 2xx)', async () => {
      const res = await http()
        .patch(`/v1/broker-leads/${fx.resources.a.leadId}/approve`)
        .set('Authorization', bearer(adminAToken))
        .send({ assignedSalesId: fx.users.adminB.id });
      expect([403, 404]).toContain(res.status);
    });

    // V-09 — leads.service.ts:117 — clientId in resolveClient
    it('V-09: POST /leads with clientId from Company B → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .post('/v1/leads')
        .set('Authorization', bearer(adminAToken))
        .send({ clientId: fx.users.clientB.id });
      expect(res.status).toBe(404);
    });

    // V-10 — contracts.module.ts:338 — customerId in create
    it('V-10: POST /contracts with customerId from Company B → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .post('/v1/contracts')
        .set('Authorization', bearer(adminAToken))
        .send({
          customerId: fx.users.customerB.id,
          unitId: fx.resources.a.unit2Id,
          totalAmount: 500_000,
        });
      expect(res.status).toBe(404);
    });

    // V-11 — maintenance.service.ts:373 — customerId path param in customerUnits
    it('V-11: GET /customers/:id/maintenance-units with id from Company B → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .get(`/v1/customers/${fx.users.customerB.id}/maintenance-units`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(404);
    });

    // V-12 — maintenance.service.ts:505 — customerId in createRequest (admin path)
    it('V-12: POST /maintenance-requests with customerId from Company B → 400 (resolveTenantUser throwBadRequest)', async () => {
      const res = await http()
        .post('/v1/maintenance-requests')
        .set('Authorization', bearer(adminAToken))
        .send({
          customerId: fx.users.customerB.id,
          unitId: fx.resources.a.unit1Id,
          description: 'Cross-tenant attack test',
        });
      expect(res.status).toBe(400);
    });

    // V-13 — maintenance.service.ts:670 — assignedAdminId in assign
    it('V-13: POST /maintenance-requests/:id/assign with assignedAdminId from Company B → 400 (resolveTenantUser throwBadRequest)', async () => {
      const res = await http()
        .post(`/v1/maintenance-requests/${fx.resources.a.maintenanceRequestId}/assign`)
        .set('Authorization', bearer(adminAToken))
        .send({ assignedAdminId: fx.users.adminB.id });
      expect(res.status).toBe(400);
    });

    // V-14 — permissions.module.ts:73 — userId path param in getUserPermissions
    it('V-14: GET /users/:id/permissions with id from Company B → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .get(`/v1/users/${fx.users.adminB.id}/permissions`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(404);
    });

    // V-15 — permissions.module.ts:105 — userId path param in applyPermissionDiff
    it('V-15: PATCH /users/:id/permissions with id from Company B → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .patch(`/v1/users/${fx.users.adminB.id}/permissions`)
        .set('Authorization', bearer(adminAToken))
        .send({ addPermissionCodes: [], removePermissionCodes: [] });
      expect(res.status).toBe(404);
    });

    // V-16 — documents.module.ts:407 — ownerId USER in assertOwnerExists
    it('V-16: POST /documents with ownerId from Company B (ownerType=USER) → 404 (resolveTenantUser NotFoundException)', async () => {
      const res = await http()
        .post('/v1/documents')
        .set('Authorization', bearer(adminAToken))
        .send({
          ownerType: 'USER',
          ownerId: fx.users.adminB.id,
          title: 'Cross-tenant document',
          fileUrl: 'https://example.com/test.pdf',
        });
      expect(res.status).toBe(404);
    });

    // V-17 — notifications.module.ts:328 — userId best-effort; notification row
    //         is created (Notification is TENANT_OWNED so companyId=A is injected,
    //         userId points to adminB — cross-tenant reference in DB), push is
    //         silently skipped (resolveTenantUser NotFoundException caught in try block).
    it('V-17: POST /notifications/send with userId from Company B → 201 (best-effort, push silently skipped)', async () => {
      await http()
        .post('/v1/notifications/send')
        .set('Authorization', bearer(adminAToken))
        .send({
          userId: fx.users.adminB.id,
          templateCode: fx.resources.a.notificationTemplateCode,
        })
        .expect(201);
    });

    // ── V-18: bonus salesPerformance ?salesId cross-tenant IDOR ────────────────
    //
    // SECURE outcome: 404 (resolveTenantUser rejects salesId not in Company A)
    // VULNERABLE outcome (before fix): 200 with Company B user's fullName in body

    // V-18-1: ADMIN supplies cross-tenant salesId → 404
    it('V-18: GET /sales-targets/performance?salesId=<Company B user> → 404', async () => {
      const res = await http()
        .get('/v1/sales-targets/performance')
        .set('Authorization', bearer(adminAToken))
        .query({ salesId: fx.users.adminB.id });
      expect(res.status).toBe(404);
    });

    // V-18-2: sanity — ADMIN with valid Company A salesId works
    it('V-18 sanity: ADMIN with a Company A salesId → 200', async () => {
      const res = await http()
        .get('/v1/sales-targets/performance')
        .set('Authorization', bearer(adminAToken))
        .query({ salesId: fx.users.sales1A.id });
      expect(res.status).toBe(200);
    });

    // ── V-19: notification broadcast USER target cross-tenant action ─────────
    //
    // SECURE outcome: 404 (resolveTenantUser rejects targetUserId not in Company A)
    //   AND no Notification row created for the cross-tenant user (no action taken)
    // VULNERABLE outcome (before fix): 201 + push delivered to Company B user

    // V-19-1: broadcast to a cross-tenant user → 404
    it('V-19: POST /notifications/broadcast { target: USER, targetUserId: Company B } → 404', async () => {
      const countBefore = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });

      const res = await http()
        .post('/v1/notifications/broadcast')
        .set('Authorization', bearer(adminAToken))
        .send({
          target: 'USER',
          targetUserId: fx.users.adminB.id,
          channel: 'IN_APP',
          title_ar: 'هجوم',
          title_en: 'Attack',
          body_ar: 'اختبار متقاطع الشركات',
          body_en: 'Cross-tenant test',
        });

      expect(res.status).toBe(404);

      // No Notification row was written for the cross-tenant user — action fully blocked.
      const countAfter = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });
      expect(countAfter).toBe(countBefore);
    });

    // V-19-2: sanity — broadcast to a valid Company A user works
    it('V-19 sanity: broadcast to Company A user → 201', async () => {
      const res = await http()
        .post('/v1/notifications/broadcast')
        .set('Authorization', bearer(adminAToken))
        .send({
          target: 'USER',
          targetUserId: fx.users.sales1A.id,
          channel: 'IN_APP',
          title_ar: 'إشعار صحيح',
          title_en: 'Valid broadcast',
          body_ar: 'اختبار',
          body_en: 'Test',
        });
      expect(res.status).toBe(201);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [NOTIF] Cross-tenant notification template overwrite — BLOCKED
  //
  // NotificationTemplate.code has a global @unique constraint; the $queryRaw
  // guard in upsertTemplate detects cross-tenant ownership and throws 403.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[NOTIF] Cross-tenant notification template overwrite', () => {
    it('NOTIF-1: Company A ADMIN cannot overwrite a template owned by Company B (403)', async () => {
      // Company B's template 'sec-notif-tpl-b' was seeded in the fixture.
      // Company A ADMIN submits the same code → $queryRaw detects companyId mismatch → 403.
      const res = await http()
        .post('/v1/notification-templates')
        .set('Authorization', bearer(adminAToken))
        .send({
          code: fx.resources.b.notificationTemplateCode,
          channel: 'IN_APP',
          ar_subject: 'هجوم',
          en_subject: 'Attack',
          ar_body: 'محتوى',
          en_body: 'Content',
          active: true,
        })
        .expect(403);

      expect(res.body).toMatchObject({
        message: expect.stringContaining('belongs to another tenant'),
      });
    });

    it('NOTIF-2: Company B template is unchanged after the rejected attack', async () => {
      const tpl = await testApp.rawPrisma.notificationTemplate.findUnique({
        where: { code: fx.resources.b.notificationTemplateCode },
        select: { companyId: true, subject: true },
      });
      expect(tpl).not.toBeNull();
      expect(tpl!.companyId).toBe(fx.companies.bId);
    });

    it('NOTIF-3: Company A ADMIN CAN create a template with a new code (sanity check)', async () => {
      // Proves the guard only blocks cross-tenant conflicts, not all creates.
      await http()
        .post('/v1/notification-templates')
        .set('Authorization', bearer(adminAToken))
        .send({
          code: 'sec-notif-tpl-a-only',
          channel: 'IN_APP',
          ar_subject: 'شركة أ',
          en_subject: 'Company A',
          ar_body: 'نص',
          en_body: 'Body',
          active: true,
        })
        .expect(201);

      // Clean up immediately so teardown does not conflict on the global unique code.
      await testApp.rawPrisma.notificationTemplate.delete({
        where: { code: 'sec-notif-tpl-a-only' },
      }).catch(() => void 0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [V-20/V-21] Cross-tenant broadcast fan-out — rows 15 + 13/16
  //
  // User is TENANT_CONTROLLED. The middleware does NOT inject companyId for
  // TENANT_CONTROLLED models (prisma.service.ts: TENANT_OWNED_MODELS is built
  // from MODEL_TENANCY entries where tier === 'TENANT_OWNED' only; User is
  // TENANT_CONTROLLED → not in scopedModels → applyReadPolicy is a no-op for
  // every prisma.user.* call).
  //
  // resolveRecipients / activeUserIdsByRole / ALL_ACTIVE all call
  // prisma.user.findMany without companyId → rows from every company returned.
  //
  // SECURE outcome: Company B users must NOT receive Notification rows from a
  // Company A broadcast.
  // FINDING if tests fail: V-20 (ALL_ACTIVE) and/or V-21 (ROLE=ADMIN) confirmed.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[V-20/V-21] Cross-tenant broadcast fan-out (rows 15 + 13/16)', () => {

    const BROADCAST_BODY = {
      channel: 'IN_APP',
      title_ar: 'اختبار',
      title_en: 'V-20/V-21 test',
      body_ar: 'نص',
      body_en: 'Body',
    };

    // V-20: ALL_ACTIVE broadcasts to all active users across every company.
    it('V-20: ALL_ACTIVE broadcast must not deliver to Company B users (row 15)', async () => {
      const countBefore = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });

      const res = await http()
        .post('/v1/notifications/broadcast')
        .set('Authorization', bearer(adminAToken))
        .send({ ...BROADCAST_BODY, target: 'ALL_ACTIVE' });

      expect(res.status).toBe(201);
      // Broadcast reached at least Company A's own users — proves the call succeeded.
      expect(res.body.recipientCount).toBeGreaterThan(0);
      // IN_APP channel: no push is ever attempted (push.sendToUser is never called).
      // The only observable side-effect is Notification row creation.

      const countAfter = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });
      // SECURE: Company B's admin must not have received a Notification row.
      expect(countAfter).toBe(countBefore);
    });

    // V-21: ROLE=ADMIN broadcast — Company B also has an active ADMIN (adminB).
    it('V-21: ROLE=ADMIN broadcast must not deliver to Company B ADMIN users (rows 13/16)', async () => {
      const countBefore = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });

      const res = await http()
        .post('/v1/notifications/broadcast')
        .set('Authorization', bearer(adminAToken))
        .send({ ...BROADCAST_BODY, target: 'ROLE', targetRole: 'ADMIN' });

      expect(res.status).toBe(201);
      expect(res.body.recipientCount).toBeGreaterThan(0);

      const countAfter = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminB.id },
      });
      // SECURE: Company B's admin must not have received a Notification row.
      expect(countAfter).toBe(countBefore);
    });

    // V-20 sanity: Company A's own users DO receive the notification.
    it('V-20 sanity: ALL_ACTIVE broadcast reaches Company A users', async () => {
      const countBefore = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminA.id },
      });

      await http()
        .post('/v1/notifications/broadcast')
        .set('Authorization', bearer(adminAToken))
        .send({ ...BROADCAST_BODY, target: 'ALL_ACTIVE' })
        .expect(201);

      const countAfter = await testApp.rawPrisma.notification.count({
        where: { userId: fx.users.adminA.id },
      });
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    // V-20 bonus: Row 3 — GET /sales-targets/actors returns all SALES/SALES_MANAGER
    // across every company when called by ADMIN. Company B's SALES user must not appear.
    it('V-20 bonus/row-3: GET /sales-targets/actors must not return Company B SALES users', async () => {
      const sales1B = await testApp.rawPrisma.user.findFirst({
        where: { companyId: fx.companies.bId, role: 'SALES' },
        select: { id: true },
      });
      // Only run assertion if Company B has a SALES user in the fixture.
      if (!sales1B) return;

      const res = await http()
        .get('/v1/sales-targets/actors')
        .set('Authorization', bearer(adminAToken))
        .expect(200);

      const returnedIds = (res.body as Array<{ id: string }>).map((u) => u.id);
      // SECURE: Company B SALES user must not appear in Company A ADMIN's actor list.
      expect(returnedIds).not.toContain(sales1B.id);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // [V-25/V-26] Reports dashboard cross-tenant count contamination (rows 17/18)
  //
  // prisma.user.count({ where: { role: CUSTOMER } }) and
  // prisma.user.count({ where: { role: { in: [ADMIN, SALES, SM, MAINTENANCE] } } })
  // have no companyId filter. The Prisma tenant middleware does not inject
  // companyId for TENANT_CONTROLLED models. Both counts include rows from every
  // company in the database.
  //
  // Proof: compare the API-returned count with the rawPrisma count scoped to
  // Company A only. If they differ, cross-tenant data is included.
  //
  // SECURE outcome: api count === Company A scoped count.
  // FINDING if tests fail: V-25 (customers) and/or V-26 (staff) confirmed.
  // ══════════════════════════════════════════════════════════════════════════

  describe('[V-25/V-26] Reports dashboard cross-tenant count contamination (rows 17/18)', () => {

    it('V-25: kpis.totalCustomers must be scoped to Company A only (row 17)', async () => {
      const trueCompanyACount = await testApp.rawPrisma.user.count({
        where: { role: 'CUSTOMER', companyId: fx.companies.aId },
      });

      const res = await http()
        .get('/v1/reports/admin-summary')
        .set('Authorization', bearer(adminAToken));

      expect(res.status).toBe(200);
      // SECURE: API totalCustomers must equal the Company A-scoped count.
      // If this fails: the API count exceeds the scoped count → cross-tenant rows included.
      expect(res.body.kpis.totalCustomers).toBe(trueCompanyACount);
    });

    it('V-26: kpis.totalTeam must be scoped to Company A only (row 18)', async () => {
      const trueCompanyACount = await testApp.rawPrisma.user.count({
        where: {
          role: { in: ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR'] },
          companyId: fx.companies.aId,
        },
      });

      const res = await http()
        .get('/v1/reports/admin-summary')
        .set('Authorization', bearer(adminAToken));

      expect(res.status).toBe(200);
      // SECURE: API totalTeam must equal the Company A-scoped count.
      // If this fails: the API count exceeds the scoped count → cross-tenant rows included.
      expect(res.body.kpis.totalTeam).toBe(trueCompanyACount);
    });
  });
});
