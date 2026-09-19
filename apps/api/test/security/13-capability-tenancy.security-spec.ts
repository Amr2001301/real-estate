/**
 * Phase 1 capability system — tenancy and access-control tests.
 *
 * All tests use real Postgres (TEST_DATABASE_URL).
 *
 * Attack matrix:
 *   CAP-1   SUPER_ADMIN reads GET /super-admin/companies/:id/capabilities/view → 200
 *   CAP-2   SUPER_ADMIN writes PUT /super-admin/companies/:id/capabilities/overrides → 200
 *   CAP-3   SUPER_ADMIN reads GET /super-admin/companies/:id/usage → 200
 *   CAP-4   SUPER_ADMIN reads GET /super-admin/capabilities/report → 200, companies array
 *   CAP-5   Company A ADMIN reads GET /capabilities/me → 200 (own company caps)
 *   CAP-6   Company A ADMIN → super-admin endpoint → 403
 *   CAP-7   SUPER_ADMIN reads nonexistent company → 404
 *   CAP-8   SUPER_ADMIN sends unknown override key → 400
 *   CAP-9   SUPER_ADMIN sends column-backed key in overrides → 400
 *   CAP-10  Company A ADMIN reads GET /capabilities/me/usage → 200 (counts A only, not B)
 *   CAP-11  Override set for Company A does not affect Company B effective view
 *   CAP-12  Plan change does not remove existing overrides (override survives plan change)
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  type SecurityFixture,
} from './seed/security-fixture';

const SUPER_ADMIN_EMAIL = 'cap-super-admin@sec.test';
const SUPER_ADMIN_PASSWORD = 'SuperAdm-1234!';

let testApp: TestApp;
let fx: SecurityFixture;
let superAdminToken: string;
let adminAToken: string;
let superAdminId: string;

async function loginSuperAdmin(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login-super-admin')
    .send({ email, password });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Super-admin login failed: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  const token: unknown = res.body?.tokens?.accessToken ?? res.body?.accessToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`Super-admin login returned no accessToken: ${JSON.stringify(res.body)}`);
  }
  return token;
}

describe('SEC — CAP: capability tenancy and access-control (Phase 1)', () => {
  beforeAll(async () => {
    testApp = await createSecurityTestApp();
    fx = await seedSecurityFixture(testApp.rawPrisma);

    // Clean up any leftover SUPER_ADMIN from a prior run
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { email: SUPER_ADMIN_EMAIL } } });
    await testApp.rawPrisma.user.deleteMany({ where: { email: SUPER_ADMIN_EMAIL } });

    const hash = await argon2.hash(SUPER_ADMIN_PASSWORD);
    const superAdmin = await testApp.rawPrisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash: hash,
        fullName: 'Cap Security Super Admin',
        role: UserRole.SUPER_ADMIN,
        active: true,
        companyId: null,
      },
    });
    superAdminId = superAdmin.id;

    superAdminToken = await loginSuperAdmin(testApp.app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    adminAToken = await (async () => {
      const res = await request(testApp.app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: fx.users.adminA.email, password: fx.users.adminA.password });
      return res.body?.tokens?.accessToken ?? res.body?.accessToken;
    })();
  }, 90_000);

  afterAll(async () => {
    // Clear overrides written during tests so teardown is clean
    await testApp.rawPrisma.company.updateMany({
      where: { id: { in: [fx.companies.aId, fx.companies.bId] } },
      data: { capabilities: {} },
    });
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: superAdminId } });
    await testApp.rawPrisma.user.delete({ where: { id: superAdminId } });
    await teardownSecurityFixture(testApp.rawPrisma);
  });

  // ── CAP-1: SUPER_ADMIN reads capabilities view ────────────────────────────

  it('CAP-1: SUPER_ADMIN reads capabilities view → 200 with plan/keys structure', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/view`)
      .set('Authorization', bearer(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(res.body).toHaveProperty('keys');
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys.length).toBeGreaterThan(0);
    // Each key entry must have the three-layer structure
    const first = res.body.keys[0];
    expect(first).toHaveProperty('key');
    expect(first).toHaveProperty('planDefault');
    expect(first).toHaveProperty('effective');
    expect(first).toHaveProperty('source');
  });

  // ── CAP-2: SUPER_ADMIN writes overrides ──────────────────────────────────

  describe('CAP-2: SUPER_ADMIN writes valid override → 200; effective view reflects new value', () => {
    let viewAfter: Record<string, unknown>;

    beforeAll(async () => {
      const res = await request(testApp.app.getHttpServer())
        .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
        .set('Authorization', bearer(superAdminToken))
        .send({ overrides: { 'limit.maxUnits': 999 } });
      expect(res.status).toBe(200);
      viewAfter = res.body as Record<string, unknown>;
    });

    it('response contains updated effective view', () => {
      expect(viewAfter).toHaveProperty('keys');
      const keys = viewAfter.keys as Array<{ key: string; effective: unknown; source: string }>;
      const unitKey = keys.find((k) => k.key === 'limit.maxUnits');
      expect(unitKey).toBeDefined();
      expect(unitKey!.effective).toBe(999);
      expect(unitKey!.source).toBe('capabilities_override');
    });

    it('subsequent GET capabilities view shows the override', async () => {
      const res = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(res.status).toBe(200);
      const keys = res.body.keys as Array<{ key: string; effective: unknown; source: string }>;
      const unitKey = keys.find((k) => k.key === 'limit.maxUnits');
      expect(unitKey!.effective).toBe(999);
      expect(unitKey!.source).toBe('capabilities_override');
    });
  });

  // ── CAP-3: SUPER_ADMIN reads usage ───────────────────────────────────────

  it('CAP-3: SUPER_ADMIN reads usage → 200 with limits/used structure', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get(`/v1/super-admin/companies/${fx.companies.aId}/usage`)
      .set('Authorization', bearer(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('companyId', fx.companies.aId);
    expect(res.body).toHaveProperty('plan');
    expect(res.body).toHaveProperty('limits');
    expect(res.body.limits).toHaveProperty('units');
    expect(res.body.limits).toHaveProperty('users');
    expect(res.body.limits).toHaveProperty('projects');
    expect(res.body.limits.units).toHaveProperty('limit');
    expect(res.body.limits.units).toHaveProperty('used');
    expect(typeof res.body.limits.units.used).toBe('number');
  });

  // ── CAP-4: SUPER_ADMIN reads cross-company report ────────────────────────

  it('CAP-4: SUPER_ADMIN reads capability report → 200 with summary + companies array', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/super-admin/capabilities/report')
      .set('Authorization', bearer(superAdminToken));

    expect(res.status).toBe(200);
    // Report returns { total, overLimit, nearLimit, companies: [...] }
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('overLimit');
    expect(res.body).toHaveProperty('nearLimit');
    expect(Array.isArray(res.body.companies)).toBe(true);
    expect(res.body.companies.length).toBeGreaterThan(0);
    const entry = res.body.companies[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('plan');
    expect(entry).toHaveProperty('flags');
    expect(entry.flags).toHaveProperty('overLimit');
    expect(entry.flags).toHaveProperty('nearLimit');
  });

  // ── CAP-5: Company A ADMIN reads own capabilities ─────────────────────────

  it('CAP-5: Company A ADMIN reads /capabilities/me → 200 with own caps', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/capabilities/me')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(res.body).toHaveProperty('keys');
    expect(Array.isArray(res.body.keys)).toBe(true);
    // Must be scoped to Company A
    expect(res.body).not.toHaveProperty('companyId', fx.companies.bId);
  });

  // ── CAP-6: Company A ADMIN → super-admin endpoint → 403 ──────────────────

  it('CAP-6: Company A ADMIN hits super-admin capabilities endpoint → 403', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/view`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A);

    expect(res.status).toBe(403);
  });

  it('CAP-6b: Company A ADMIN cannot PUT overrides via super-admin endpoint → 403', async () => {
    const res = await request(testApp.app.getHttpServer())
      .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .send({ overrides: { 'limit.maxUnits': 1 } });

    expect(res.status).toBe(403);
  });

  // ── CAP-7: SUPER_ADMIN → nonexistent company → 404 ───────────────────────

  it('CAP-7a: SUPER_ADMIN reads capabilities view for nonexistent company → 404', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/super-admin/companies/00000000-0000-0000-0000-000000000000/capabilities/view')
      .set('Authorization', bearer(superAdminToken));

    expect(res.status).toBe(404);
  });

  it('CAP-7b: SUPER_ADMIN reads usage for nonexistent company → 404', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/super-admin/companies/00000000-0000-0000-0000-000000000000/usage')
      .set('Authorization', bearer(superAdminToken));

    expect(res.status).toBe(404);
  });

  // ── CAP-8: Unknown override key → 400 ────────────────────────────────────

  it('CAP-8: SUPER_ADMIN sends unknown override key → 400', async () => {
    const res = await request(testApp.app.getHttpServer())
      .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
      .set('Authorization', bearer(superAdminToken))
      .send({ overrides: { 'feature.nonExistentCapability': true } });

    expect(res.status).toBe(400);
  });

  // ── CAP-9: Column-backed key in overrides → 400 ───────────────────────────

  it('CAP-9a: SUPER_ADMIN sends feature.publicWebsite in overrides → 400 (column-backed)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
      .set('Authorization', bearer(superAdminToken))
      .send({ overrides: { 'feature.publicWebsite': true } });

    expect(res.status).toBe(400);
  });

  it('CAP-9b: SUPER_ADMIN sends feature.customerApp in overrides → 400 (column-backed)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
      .set('Authorization', bearer(superAdminToken))
      .send({ overrides: { 'feature.customerApp': true } });

    expect(res.status).toBe(400);
  });

  it('CAP-9c: SUPER_ADMIN sends feature.staffApp in overrides → 400 (column-backed)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
      .set('Authorization', bearer(superAdminToken))
      .send({ overrides: { 'feature.staffApp': false } });

    expect(res.status).toBe(400);
  });

  // ── CAP-10: /capabilities/me/usage is scoped to own company ──────────────

  describe('CAP-10: /capabilities/me/usage counts are scoped to Company A only', () => {
    let usageA: Record<string, unknown>;

    beforeAll(async () => {
      const res = await request(testApp.app.getHttpServer())
        .get('/v1/capabilities/me/usage')
        .set('Authorization', bearer(adminAToken))
        .set('X-Tenant-Slug', SEC_SLUG_A);
      expect(res.status).toBe(200);
      usageA = res.body as Record<string, unknown>;
    });

    it('response is scoped to Company A (companyId matches)', () => {
      expect(usageA).toHaveProperty('companyId', fx.companies.aId);
    });

    it('unit count matches only Company A units', async () => {
      const limits = usageA.limits as Record<string, { limit: number | null; used: number } | undefined>;
      const aCount = await testApp.rawPrisma.unit.count({ where: { companyId: fx.companies.aId } });
      expect(limits['units']!.used).toBe(aCount);
    });

    it('user count does not include Company B users', async () => {
      const limits = usageA.limits as Record<string, { limit: number | null; used: number } | undefined>;
      // Must match the staff-seat definition: deletedAt=null + role in STAFF_SEAT_ROLES
      const staffFilter = {
        deletedAt: null,
        role: { in: ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER'] as UserRole[] },
      };
      const aUsers = await testApp.rawPrisma.user.count({
        where: { companyId: fx.companies.aId, ...staffFilter },
      });
      const bUsers = await testApp.rawPrisma.user.count({
        where: { companyId: fx.companies.bId, ...staffFilter },
      });
      expect(limits['users']!.used).toBe(aUsers);
      expect(limits['users']!.used).not.toBe(aUsers + bUsers);
    });
  });

  // ── CAP-11: Override for Company A does not affect Company B ─────────────

  describe('CAP-11: override written for Company A does not bleed into Company B', () => {
    beforeAll(async () => {
      // Set a distinct override on Company A (CAP-2 already did this, but be explicit)
      const res = await request(testApp.app.getHttpServer())
        .put(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/overrides`)
        .set('Authorization', bearer(superAdminToken))
        .send({ overrides: { 'limit.maxUsers': 77 } });
      expect(res.status).toBe(200);
    });

    it('Company B capabilities view does not show the Company A override', async () => {
      const res = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${fx.companies.bId}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(res.status).toBe(200);
      const keys = res.body.keys as Array<{ key: string; effective: unknown; source: string }>;
      const userKey = keys.find((k) => k.key === 'limit.maxUsers');
      // Company B should NOT have 77 (Company A's override); it should come from plan default
      expect(userKey!.effective).not.toBe(77);
      expect(userKey!.source).toBe('plan_default');
    });

    it('Company A capabilities view still shows 77', async () => {
      const res = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${fx.companies.aId}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(res.status).toBe(200);
      const keys = res.body.keys as Array<{ key: string; effective: unknown; source: string }>;
      const userKey = keys.find((k) => k.key === 'limit.maxUsers');
      expect(userKey!.effective).toBe(77);
      expect(userKey!.source).toBe('capabilities_override');
    });
  });

  // ── CAP-12: Override survives a plan change ───────────────────────────────
  // Sequential state mutations — all checks in one `it` to be order-independent.

  it('CAP-12: override survives plan changes (STARTER→PROFESSIONAL→ENTERPRISE)', async () => {
    // Step 0: Create a fresh company
    const co = await testApp.rawPrisma.company.create({
      data: {
        name: 'CAP-12 Test Co',
        slug: `cap-12-test-${Date.now()}`,
        isActive: true,
        subscriptionPlan: 'STARTER',
      },
    });
    const cap12Id = co.id;

    try {
      // Step 1: write brokers=true override on STARTER (default=false)
      const r1 = await request(testApp.app.getHttpServer())
        .put(`/v1/super-admin/companies/${cap12Id}/capabilities/overrides`)
        .set('Authorization', bearer(superAdminToken))
        .send({ overrides: { 'feature.brokers': true } });
      expect(r1.status).toBe(200);

      // Verify: STARTER planDefault=false, override wins → effective=true
      const v1 = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${cap12Id}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(v1.status).toBe(200);
      const k1 = (v1.body.keys as Array<{ key: string; planDefault: unknown; effective: unknown; source: string }>)
        .find((k) => k.key === 'feature.brokers')!;
      expect(k1.planDefault).toBe(false);   // STARTER default
      expect(k1.effective).toBe(true);       // override wins
      expect(k1.source).toBe('capabilities_override');

      // Step 2: upgrade to PROFESSIONAL — override must survive
      await testApp.rawPrisma.company.update({
        where: { id: cap12Id },
        data: { subscriptionPlan: 'PROFESSIONAL' },
      });

      const v2 = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${cap12Id}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(v2.status).toBe(200);
      const k2 = (v2.body.keys as Array<{ key: string; planDefault: unknown; effective: unknown; source: string }>)
        .find((k) => k.key === 'feature.brokers')!;
      expect(k2.effective).toBe(true);              // override still present
      expect(k2.source).toBe('capabilities_override'); // blob still has the entry

      // Step 3: add maxUnits=500 override, then upgrade to ENTERPRISE (default=null)
      const r3 = await request(testApp.app.getHttpServer())
        .put(`/v1/super-admin/companies/${cap12Id}/capabilities/overrides`)
        .set('Authorization', bearer(superAdminToken))
        .send({ overrides: { 'limit.maxUnits': 500 } });
      expect(r3.status).toBe(200);

      await testApp.rawPrisma.company.update({
        where: { id: cap12Id },
        data: { subscriptionPlan: 'ENTERPRISE' },
      });

      const v3 = await request(testApp.app.getHttpServer())
        .get(`/v1/super-admin/companies/${cap12Id}/capabilities/view`)
        .set('Authorization', bearer(superAdminToken));
      expect(v3.status).toBe(200);
      const k3 = (v3.body.keys as Array<{ key: string; planDefault: unknown; effective: unknown; source: string }>)
        .find((k) => k.key === 'limit.maxUnits')!;
      expect(k3.planDefault).toBeNull();          // ENTERPRISE default is unlimited
      expect(k3.effective).toBe(500);              // override wins even over null
      expect(k3.source).toBe('capabilities_override');
    } finally {
      await testApp.rawPrisma.company.delete({ where: { id: cap12Id } });
    }
  });
});
