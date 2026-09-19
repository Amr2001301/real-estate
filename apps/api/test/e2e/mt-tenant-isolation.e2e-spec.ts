/**
 * MT-Test-02 — Multi-tenant data isolation (e2e, real DB).
 *
 * Proves that the Prisma middleware + TenantContextInterceptor chain enforces
 * strict companyId boundaries:
 *
 *   ISO-1: Company B admin cannot read a project that belongs to Company A.
 *   ISO-2: Company B admin's project list contains only Company B projects.
 *   ISO-3: Company A admin can still read Company A's own project (regression).
 *   ISO-4: Company A admin's project list does NOT include Company B's project.
 *
 * Data setup (all via direct Prisma — no company-management HTTP API yet):
 *   - Company A = the default company already present after e2e globalSetup.
 *   - Company B = created inline in beforeAll; torn down in afterAll.
 *   - Project A = created via rawPrisma (bypasses plan-limit enforcement).
 *   - Project B = created via rawPrisma (same reason).
 *
 * This spec uses the full Nest app (real AppModule, real interceptors, real
 * Prisma middleware) pointed at the e2e database.
 */

import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

const COMPANY_B_SLUG = 'mt-test-company-b';
const COMPANY_B_ADMIN_EMAIL = 'admin-b@mt-test.local';
const COMPANY_B_ADMIN_PASSWORD = 'AdminB-123!';

describe('MT-Test-02 — multi-tenant data isolation (e2e)', () => {
  let testApp: TestApp;

  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
  let projectBId: string;

  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    // ── Company A: use the default seeded company ─────────────────────────
    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    // ── Company B: create a second tenant inline ──────────────────────────
    // Pre-clean in case a previous run was killed before afterAll could run.
    const leftover = await raw.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await raw.project.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }
    const companyB = await raw.company.create({
      data: {
        name: 'MT Test Company B',
        slug: COMPANY_B_SLUG,
        isActive: true,
      },
    });
    companyBId = companyB.id;

    // Create an ADMIN user for Company B (direct DB — no HTTP user-creation API).
    const passwordHash = await argon2.hash(COMPANY_B_ADMIN_PASSWORD);
    await raw.user.create({
      data: {
        email: COMPANY_B_ADMIN_EMAIL,
        passwordHash,
        fullName: 'Admin B',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    // ── Authenticate both admins ─────────────────────────────────────────
    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, COMPANY_B_ADMIN_EMAIL, COMPANY_B_ADMIN_PASSWORD),
    ]);

    // ── Create one project per company via rawPrisma ─────────────────────
    // Use rawPrisma to bypass plan-limit enforcement: the seeded Company A may
    // already be at the TRIAL maxProjects cap (set via seed). The isolation
    // invariants (ISO-1–ISO-4) are verified by GET endpoints only — how the
    // project is created does not affect what is being tested.
    const projectA = await raw.project.create({
      data: {
        companyId: companyAId,
        name: { ar: 'مشروع أ - اختبار عزل المستأجر', en: 'MT-Test Project A' },
        description: { ar: 'وصف', en: 'desc' },
        city: 'Riyadh',
        lat: 24.7136,
        lng: 46.6753,
      },
      select: { id: true },
    });
    projectAId = projectA.id;

    const projectB = await raw.project.create({
      data: {
        companyId: companyBId,
        name: { ar: 'مشروع ب - اختبار عزل المستأجر', en: 'MT-Test Project B' },
        description: { ar: 'وصف', en: 'desc' },
        city: 'Jeddah',
        lat: 21.4858,
        lng: 39.1925,
      },
      select: { id: true },
    });
    projectBId = projectB.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.project.deleteMany({ where: { companyId: companyBId } });
    await raw.project.deleteMany({ where: { id: projectAId } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });
  });

  const http = () => request(testApp.app.getHttpServer());

  // ── ISO-1 ─────────────────────────────────────────────────────────────────
  it('ISO-1: Company B admin cannot read Company A project by ID (404)', async () => {
    const res = await http()
      .get(`/v1/projects/${projectAId}`)
      .set('Authorization', bearer(adminBToken));
    // The middleware scopes the lookup to companyB; projectA is not in companyB
    // → PrismaService returns null → service throws NotFoundException → 404.
    expect(res.status).toBe(404);
  });

  // ── ISO-2 ─────────────────────────────────────────────────────────────────
  it('ISO-2: Company B project list contains Project B and NOT Project A', async () => {
    const res = await http()
      .get('/v1/projects')
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);

    const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(projectBId);
    expect(ids).not.toContain(projectAId);
  });

  // ── ISO-3 ─────────────────────────────────────────────────────────────────
  it('ISO-3: Company A admin can still read Company A project (regression)', async () => {
    const res = await http()
      .get(`/v1/projects/${projectAId}`)
      .set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(projectAId);
  });

  // ── ISO-4 ─────────────────────────────────────────────────────────────────
  it('ISO-4: Company A project list does NOT include Company B project', async () => {
    const res = await http()
      .get('/v1/projects')
      .set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);

    const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(projectBId);
  });
});
