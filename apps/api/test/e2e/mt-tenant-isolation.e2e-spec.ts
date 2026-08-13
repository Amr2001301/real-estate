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
 *   - Project A = created via HTTP as Company A admin.
 *   - Project B = created via HTTP as Company B admin.
 *
 * This spec uses the full Nest app (real AppModule, real interceptors, real
 * Prisma middleware) pointed at the e2e database.
 */

import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { runTenantContext } from '../../src/common/tenant/tenant-context';

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
    testApp = await createTestApp();
    const prisma = testApp.prisma;

    // ── Company A: use the default seeded company ─────────────────────────
    const companyA = await prisma.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    // ── Company B: create a second tenant inline ──────────────────────────
    // Pre-clean in case a previous run was killed before afterAll could run.
    const leftover = await prisma.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
        await prisma.project.deleteMany({ where: { companyId: leftover.id } });
      });
      await prisma.user.deleteMany({ where: { companyId: leftover.id } });
      await prisma.company.delete({ where: { id: leftover.id } });
    }
    const companyB = await prisma.company.create({
      data: {
        name: 'MT Test Company B',
        slug: COMPANY_B_SLUG,
        isActive: true,
      },
    });
    companyBId = companyB.id;

    // Create an ADMIN user for Company B (direct DB — no HTTP user-creation API).
    const passwordHash = await argon2.hash(COMPANY_B_ADMIN_PASSWORD);
    await prisma.user.create({
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

    // ── Create one project per company via HTTP ───────────────────────────
    const http = () => request(testApp.app.getHttpServer());

    const projectPayloadA = {
      name: { ar: 'مشروع أ - اختبار عزل المستأجر', en: 'MT-Test Project A' },
      description: { ar: 'وصف', en: 'desc' },
      city: 'Riyadh',
      lat: 24.7136,
      lng: 46.6753,
    };
    const resA = await http()
      .post('/v1/projects')
      .set('Authorization', bearer(adminAToken))
      .send(projectPayloadA);
    if (resA.status !== 201) {
      throw new Error(`Failed to create Project A: ${resA.status} ${JSON.stringify(resA.body)}`);
    }
    projectAId = (resA.body as { id: string }).id;

    const projectPayloadB = {
      name: { ar: 'مشروع ب - اختبار عزل المستأجر', en: 'MT-Test Project B' },
      description: { ar: 'وصف', en: 'desc' },
      city: 'Jeddah',
      lat: 21.4858,
      lng: 39.1925,
    };
    const resB = await http()
      .post('/v1/projects')
      .set('Authorization', bearer(adminBToken))
      .send(projectPayloadB);
    if (resB.status !== 201) {
      throw new Error(`Failed to create Project B: ${resB.status} ${JSON.stringify(resB.body)}`);
    }
    projectBId = (resB.body as { id: string }).id;
  });

  afterAll(async () => {
    // Clean up Company B's data so subsequent suite runs start clean.
    // Order matters: child records before parent; bypass context required
    // because the Prisma middleware enforces tenant scope on all scoped models.
    const prisma = testApp.prisma;
    const bypass = { companyId: null as null, bypass: true, isPublic: false };
    await runTenantContext(bypass, async () => {
      await prisma.project.deleteMany({ where: { companyId: companyBId } });
      await prisma.project.deleteMany({ where: { id: projectAId } });
      await prisma.user.deleteMany({ where: { companyId: companyBId } });
    });
    // Company is not a scoped model — no bypass needed.
    await prisma.company.delete({ where: { id: companyBId } });
    await testApp.close();
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
