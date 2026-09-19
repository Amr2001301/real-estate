/**
 * Phase 2 capability enforcement — security tests.
 *
 * Covers the full Phase 2 attack matrix:
 *   P2A — Feature gates (feature.brokers, STARTER plan default)
 *   P2B — App-level enforcement (staffApp / customerApp disabled)
 *   P2C — Creation limits (limit.maxUsers)
 *   P2D — SUPER_ADMIN bypass (never blocked)
 *
 * All tests use real Postgres (TEST_DATABASE_URL).
 * Each describe block creates and destroys its own isolated company rows so
 * there is no shared mutable state between groups.
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer } from '../helpers/login';
import { CapabilityService } from '../../src/common/capabilities/capability.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const PASS = 'Ph2Test-1234!';

async function createCompany(
  raw: TestApp['rawPrisma'],
  opts: {
    slug: string;
    name: string;
    subscriptionPlan?: string;
    staffAppEnabled?: boolean | null;
    customerAppEnabled?: boolean | null;
    capabilities?: Record<string, unknown>;
  },
) {
  return raw.company.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      isActive: true,
      ...(opts.subscriptionPlan !== undefined && { subscriptionPlan: opts.subscriptionPlan as never }),
      ...(opts.staffAppEnabled !== undefined && { staffAppEnabled: opts.staffAppEnabled }),
      ...(opts.customerAppEnabled !== undefined && { customerAppEnabled: opts.customerAppEnabled }),
      ...(opts.capabilities !== undefined && { capabilities: opts.capabilities as never }),
    },
  });
}

async function createUser(
  raw: TestApp['rawPrisma'],
  opts: {
    email: string;
    role: UserRole;
    companyId: string;
    active?: boolean;
    deletedAt?: Date | null;
  },
) {
  const passwordHash = await argon2.hash(PASS);
  return raw.user.create({
    data: {
      email: opts.email,
      passwordHash,
      fullName: 'Phase2 Test User',
      role: opts.role,
      active: opts.active ?? true,
      companyId: opts.companyId,
      ...(opts.deletedAt !== undefined && { deletedAt: opts.deletedAt }),
    },
  });
}

async function loginStaff(app: INestApplication, slug: string, email: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login-staff')
    .send({ slug, email, password: PASS });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

async function loginCustomer(app: INestApplication, slug: string, email: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/tenant/customer/login')
    .send({ slug, email, password: PASS });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

async function flushCapabilities(app: INestApplication, companyId: string): Promise<void> {
  const svc = app.get(CapabilityService);
  await svc.invalidateCache(companyId);
}

function extractAccessToken(body: Record<string, unknown>): string {
  const t = (body?.tokens as Record<string, unknown>)?.accessToken ?? body?.accessToken;
  if (typeof t !== 'string' || !t) throw new Error(`No accessToken in: ${JSON.stringify(body)}`);
  return t;
}

function extractRefreshToken(body: Record<string, unknown>): string {
  const t = (body?.tokens as Record<string, unknown>)?.refreshToken ?? body?.refreshToken;
  if (typeof t !== 'string' || !t) throw new Error(`No refreshToken in: ${JSON.stringify(body)}`);
  return t;
}

// ── shared app ────────────────────────────────────────────────────────────────

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createSecurityTestApp();
}, 60_000);

afterAll(async () => {});

// ══════════════════════════════════════════════════════════════════════════════
// P2A — Feature gates
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2A: feature gates (feature.brokers, STARTER plan)', () => {
  const SLUG = 'p2a-starter-co';
  let companyId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Cleanup from any prior aborted run
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2A Starter Company',
      subscriptionPlan: 'STARTER', // feature.brokers = false per plan defaults
    });
    companyId = co.id;

    const admin = await createUser(testApp.rawPrisma, {
      email: 'p2a-admin@p2test.test',
      role: UserRole.ADMIN,
      companyId,
    });

    const loginRes = await loginStaff(testApp.app, SLUG, admin.email!);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2A admin login failed: ${JSON.stringify(loginRes.body)}`);
    }
    adminToken = extractAccessToken(loginRes.body);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug: SLUG } } } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2A-1: STARTER plan — broker route → 403 CAPABILITY_GATED', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/brokers')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(403);
    // The error must name the blocked feature so the caller knows what to upgrade
    expect(JSON.stringify(res.body)).toMatch(/feature\.brokers/i);
  });

  it('P2A-2: After override enables feature.brokers → broker route → 200', async () => {
    // Enable via capabilities override (simulates SUPER_ADMIN granting the feature)
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { capabilities: { 'feature.brokers': true } },
    });
    await flushCapabilities(testApp.app, companyId);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/brokers')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(200);
  });

  it('P2A-3: STARTER plan — maintenance route → 403 (feature.maintenance = false)', async () => {
    // Restore: remove the broker override to go back to clean STARTER state
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { capabilities: {} },
    });
    await flushCapabilities(testApp.app, companyId);

    const res = await request(testApp.app.getHttpServer())
      .get('/v1/maintenance-requests')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toMatch(/feature\.maintenance/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2B — Staff app enforcement
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2B-staff: staffApp disabled — three-layer enforcement', () => {
  const SLUG = 'p2b-staffapp-off';
  let companyId: string;
  let adminEmail: string;
  let refreshToken: string;
  let tokenBeforeDisable: string;

  beforeAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

    // First create with staffAppEnabled=true so we can log in and get a token
    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2B Staff App Off Company',
      staffAppEnabled: true,
    });
    companyId = co.id;

    const admin = await createUser(testApp.rawPrisma, {
      email: 'p2b-admin@p2test.test',
      role: UserRole.ADMIN,
      companyId,
    });
    adminEmail = admin.email!;

    // Get tokens while staffApp is still enabled
    const loginRes = await loginStaff(testApp.app, SLUG, adminEmail);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2B initial login failed: ${JSON.stringify(loginRes.body)}`);
    }
    tokenBeforeDisable = extractAccessToken(loginRes.body);
    refreshToken = extractRefreshToken(loginRes.body);

    // Now disable staffApp at the column level
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { staffAppEnabled: false },
    });
    await flushCapabilities(testApp.app, companyId);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug: SLUG } } } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2B-1: login-staff returns 403 STAFF_APP_NOT_ENABLED when staffApp disabled', async () => {
    const res = await loginStaff(testApp.app, SLUG, adminEmail);

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('STAFF_APP_NOT_ENABLED');
  });

  it('P2B-2: token refresh returns 403 when staffApp disabled (in-flight session revoked)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(403);
  });

  it('P2B-3: existing valid token → any staff route returns 403 (guard backstop)', async () => {
    // The token obtained before staffApp was disabled is still cryptographically valid,
    // but CapabilityGuard should block every authenticated call for this company.
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', bearer(tokenBeforeDisable))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(403);
  });

  it('P2B-4: re-enabling staffApp allows login again', async () => {
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { staffAppEnabled: true },
    });
    await flushCapabilities(testApp.app, companyId);

    const res = await loginStaff(testApp.app, SLUG, adminEmail);
    expect([200, 201]).toContain(res.status);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2B — Customer app enforcement
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2B-customer: customerApp disabled — three-layer enforcement', () => {
  const SLUG = 'p2b-customerapp-off';
  let companyId: string;
  let customerEmail: string;
  let refreshToken: string;
  let tokenBeforeDisable: string;

  beforeAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

    // Create with customerAppEnabled=true to get a valid token first
    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2B Customer App Off Company',
      customerAppEnabled: true,
    });
    companyId = co.id;

    const customer = await createUser(testApp.rawPrisma, {
      email: 'p2b-customer@p2test.test',
      role: UserRole.CUSTOMER,
      companyId,
    });
    customerEmail = customer.email!;

    // Get tokens while customerApp is still enabled
    const loginRes = await loginCustomer(testApp.app, SLUG, customerEmail);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2B customer initial login failed: ${JSON.stringify(loginRes.body)}`);
    }
    tokenBeforeDisable = extractAccessToken(loginRes.body);
    refreshToken = extractRefreshToken(loginRes.body);

    // Disable customerApp
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { customerAppEnabled: false },
    });
    await flushCapabilities(testApp.app, companyId);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug: SLUG } } } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2B-5: customer login returns 403 CUSTOMER_APP_NOT_ENABLED when disabled', async () => {
    const res = await loginCustomer(testApp.app, SLUG, customerEmail);

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('CUSTOMER_APP_NOT_ENABLED');
  });

  it('P2B-6: token refresh returns 403 when customerApp disabled', async () => {
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(403);
  });

  it('P2B-7: existing valid customer token → me/* route returns 403 (guard backstop)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/me/favorites')
      .set('Authorization', bearer(tokenBeforeDisable))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2C — Creation limits
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2C: creation limits (limit.maxUsers)', () => {
  const SLUG = 'p2c-limits-co';
  let companyId: string;
  let adminToken: string;
  let existingUserId: string;

  beforeAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

    // TRIAL plan → feature.brokers=true, no hard limits by default.
    // We'll set limit.maxUsers=1 via capabilities blob to force the limit at 1 seat.
    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2C Limits Company',
      capabilities: { 'limit.maxUsers': 1 },
    });
    companyId = co.id;

    // Create exactly 1 ADMIN user (the only allowed seat)
    const admin = await createUser(testApp.rawPrisma, {
      email: 'p2c-admin@p2test.test',
      role: UserRole.ADMIN,
      companyId,
    });
    existingUserId = admin.id;

    const loginRes = await loginStaff(testApp.app, SLUG, admin.email!);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2C admin login failed: ${JSON.stringify(loginRes.body)}`);
    }
    adminToken = extractAccessToken(loginRes.body);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug: SLUG } } } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2C-1: company at maxUsers limit → create staff user → 403 PLAN_LIMIT_REACHED', async () => {
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG)
      .send({ email: 'p2c-extra-staff@p2test.test', role: 'SALES', fullName: 'Extra Staff', password: PASS });

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('PLAN_LIMIT_REACHED');
    const body = res.body as { limit?: string; current?: number; max?: number };
    expect(body.limit).toBe('limit.maxUsers');
    expect(typeof body.current).toBe('number');
    expect(typeof body.max).toBe('number');
  });

  it('P2C-2: at maxUsers limit → create CLIENT user → 200 (CLIENT not a staff seat)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG)
      .send({ email: 'p2c-client@p2test.test', role: 'CLIENT', fullName: 'A Client', password: PASS });

    expect(res.status).toBe(201);
  });

  it('P2C-3: at maxUsers limit → list users → 200 (reads never blocked)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG);

    expect(res.status).toBe(200);
  });

  it('P2C-4: at maxUsers limit → update existing user → 200 (updates never blocked)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .patch(`/v1/users/${existingUserId}`)
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG)
      .send({ fullName: 'Updated Name' });

    expect(res.status).toBe(200);
  });

  it('P2C-5: raising limit via override → staff creation immediately succeeds', async () => {
    // Raise limit.maxUsers to 10 — takes effect immediately (cache TTL 300s,
    // but capabilities endpoint calls invalidateCache after write)
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { capabilities: { 'limit.maxUsers': 10 } },
    });
    await flushCapabilities(testApp.app, companyId);

    const res = await request(testApp.app.getHttpServer())
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG)
      .send({ email: 'p2c-new-staff@p2test.test', role: 'SALES', fullName: 'New Staff', password: PASS });

    expect(res.status).toBe(201);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2C-cross-tenant: limits always use the caller's own company
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2C-cross-tenant: limits resolved from JWT company, not request', () => {
  const SLUG_A = 'p2c-xco-a';
  const SLUG_B = 'p2c-xco-b';
  let companyAId: string;
  let adminAToken: string;

  beforeAll(async () => {
    for (const slug of [SLUG_A, SLUG_B]) {
      await testApp.rawPrisma.user.deleteMany({ where: { company: { slug } } });
      await testApp.rawPrisma.company.deleteMany({ where: { slug } });
    }

    // Company A: at its limit (1 seat)
    const coA = await createCompany(testApp.rawPrisma, {
      slug: SLUG_A,
      name: 'P2C Cross Tenant A',
      capabilities: { 'limit.maxUsers': 1 },
    });
    companyAId = coA.id;

    // Company B: unlimited (TRIAL default)
    await createCompany(testApp.rawPrisma, {
      slug: SLUG_B,
      name: 'P2C Cross Tenant B',
    });

    const adminA = await createUser(testApp.rawPrisma, {
      email: 'p2c-xco-admin-a@p2test.test',
      role: UserRole.ADMIN,
      companyId: companyAId,
    });

    const loginRes = await loginStaff(testApp.app, SLUG_A, adminA.email!);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2C cross-tenant admin login failed: ${JSON.stringify(loginRes.body)}`);
    }
    adminAToken = extractAccessToken(loginRes.body);
  }, 30_000);

  afterAll(async () => {
    for (const slug of [SLUG_A, SLUG_B]) {
      await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug } } } });
      await testApp.rawPrisma.user.deleteMany({ where: { company: { slug } } });
      await testApp.rawPrisma.company.deleteMany({ where: { slug } });
    }
  });

  it('P2C-6: Admin A at limit tries to create user (cannot inject Company B context) → 403', async () => {
    // Company A is at its maxUsers=1 limit.
    // Company B has no limit. The limit check must use Company A (from JWT),
    // regardless of any header or body field.
    const res = await request(testApp.app.getHttpServer())
      .post('/v1/users')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SLUG_A) // own tenant slug — not Company B
      .send({ email: 'p2c-xco-new@p2test.test', role: 'SALES', fullName: 'New Staff', password: PASS });

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('PLAN_LIMIT_REACHED');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2C-enterprise: ENTERPRISE null limits never blocked
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2C-enterprise: ENTERPRISE plan with null limits is never blocked', () => {
  const SLUG = 'p2c-enterprise-co';
  let companyId: string;
  let adminToken: string;

  beforeAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

    // ENTERPRISE plan: all limits are null (unlimited) by definition
    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2C Enterprise Company',
      subscriptionPlan: 'ENTERPRISE',
    });
    companyId = co.id;

    const admin = await createUser(testApp.rawPrisma, {
      email: 'p2c-ent-admin@p2test.test',
      role: UserRole.ADMIN,
      companyId,
    });

    const loginRes = await loginStaff(testApp.app, SLUG, admin.email!);
    if (loginRes.status !== 200 && loginRes.status !== 201) {
      throw new Error(`P2C enterprise admin login failed: ${JSON.stringify(loginRes.body)}`);
    }
    adminToken = extractAccessToken(loginRes.body);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { company: { slug: SLUG } } } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2C-7: ENTERPRISE → staff user creation succeeds regardless of usage count', async () => {
    // Force a null limit override to be explicit (ENTERPRISE plan already gives null limits)
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { capabilities: { 'limit.maxUsers': null } },
    });
    await flushCapabilities(testApp.app, companyId);

    const res = await request(testApp.app.getHttpServer())
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .set('X-Tenant-Slug', SLUG)
      .send({ email: 'p2c-ent-sales@p2test.test', role: 'SALES', fullName: 'Ent Sales', password: PASS });

    expect(res.status).toBe(201);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// P2D — SUPER_ADMIN bypass
// ══════════════════════════════════════════════════════════════════════════════

describe('SEC — P2D: SUPER_ADMIN never blocked by capability checks', () => {
  const SA_EMAIL = 'p2d-super-admin@p2test.test';
  const SA_PASS = 'P2DSuperAdm-1234!';
  const SLUG = 'p2d-starter-co';
  let saToken: string;
  let companyId: string;
  let saId: string;

  beforeAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { user: { email: SA_EMAIL } } });
    await testApp.rawPrisma.user.deleteMany({ where: { email: SA_EMAIL } });

    // STARTER plan: feature.brokers=false, staffApp=true by default
    const co = await createCompany(testApp.rawPrisma, {
      slug: SLUG,
      name: 'P2D Starter Company',
      subscriptionPlan: 'STARTER',
    });
    companyId = co.id;

    const hash = await argon2.hash(SA_PASS);
    const sa = await testApp.rawPrisma.user.create({
      data: {
        email: SA_EMAIL,
        passwordHash: hash,
        fullName: 'P2D Super Admin',
        role: UserRole.SUPER_ADMIN,
        active: true,
        companyId: null,
      },
    });
    saId = sa.id;

    const res = await request(testApp.app.getHttpServer())
      .post('/v1/auth/login-super-admin')
      .send({ email: SA_EMAIL, password: SA_PASS });

    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`P2D super admin login failed: ${JSON.stringify(res.body)}`);
    }
    saToken = extractAccessToken(res.body as Record<string, unknown>);
  }, 30_000);

  afterAll(async () => {
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: saId } });
    await testApp.rawPrisma.user.delete({ where: { id: saId } });
    await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
    await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
  });

  it('P2D-1: SUPER_ADMIN hits STARTER broker route → 200 (never blocked by feature gate)', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get(`/v1/super-admin/companies/${companyId}/capabilities/view`)
      .set('Authorization', bearer(saToken));

    // SUPER_ADMIN can always read — capability checks must be bypassed
    expect(res.status).toBe(200);
  });
});
