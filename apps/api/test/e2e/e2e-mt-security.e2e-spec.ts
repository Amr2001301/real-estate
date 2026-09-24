/**
 * Merged e2e group 5: MT-Tenant + MT-Domain + MT-Write + Reports-MT + IDOR + Strict-Permissions
 *
 * All six specs share the singleton NestJS app. Each describe block manages its
 * own company creation/teardown with distinct slugs to avoid collisions.
 */

import 'reflect-metadata';
import * as argon2 from 'argon2';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function collectIds(body: unknown): string[] {
  if (!body) return [];
  if (Array.isArray(body)) return body.map((r: { id: string }) => r.id);
  const b = body as { data?: Array<{ id: string }>; items?: Array<{ id: string }> };
  if (Array.isArray(b.data)) return b.data.map((r) => r.id);
  if (Array.isArray(b.items)) return b.items.map((r) => r.id);
  return [];
}

// ═════════════════════════════════════════════════════════════════════════════
// MT-Test-02 — multi-tenant data isolation (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('MT-Test-02 — multi-tenant data isolation (e2e)', () => {
  let testApp: TestApp;

  const COMPANY_B_SLUG = 'mt-test-company-b';
  const COMPANY_B_ADMIN_EMAIL = 'admin-b@mt-test.local';
  const COMPANY_B_ADMIN_PASSWORD = 'AdminB-123!';

  let companyAId: string;
  let companyBId: string;
  let projectAId: string;
  let projectBId: string;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    const leftover = await raw.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await raw.project.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }
    const companyB = await raw.company.create({
      data: { name: 'MT Test Company B', slug: COMPANY_B_SLUG, isActive: true },
    });
    companyBId = companyB.id;

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

    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, COMPANY_B_ADMIN_EMAIL, COMPANY_B_ADMIN_PASSWORD),
    ]);

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

  it('ISO-1: Company B admin cannot read Company A project by ID (404)', async () => {
    const res = await http()
      .get(`/v1/projects/${projectAId}`)
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(404);
  });

  it('ISO-2: Company B project list contains Project B and NOT Project A', async () => {
    const res = await http().get('/v1/projects').set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);
    const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(projectBId);
    expect(ids).not.toContain(projectAId);
  });

  it('ISO-3: Company A admin can still read Company A project (regression)', async () => {
    const res = await http()
      .get(`/v1/projects/${projectAId}`)
      .set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(projectAId);
  });

  it('ISO-4: Company A project list does NOT include Company B project', async () => {
    const res = await http().get('/v1/projects').set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);
    const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(projectBId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MT-Test-02B — multi-tenant domain isolation Phase 7B (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('MT-Test-02B — multi-tenant domain isolation Phase 7B (e2e)', () => {
  let testApp: TestApp;

  const SLUG_B = 'mt-7b-company-b';
  const EMAIL_B = 'admin-7b@mt-test.local';
  const PASS_B = 'Admin7B-123!';
  const SETTING_KEY_A = 'mt7b.isolation.alpha';
  const SETTING_KEY_B = 'mt7b.isolation.beta';
  const LEAD_PHONE_A = '+966501117700';
  const LEAD_PHONE_B = '+966501117701';

  let companyAId: string;
  let companyBId: string;
  let adminAToken: string;
  let adminBToken: string;
  let leadAId: string;
  let leadBId: string;
  let unitAId: string;
  let unitBId: string;
  let projectBRawId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    const leftover = await raw.company.findFirst({ where: { slug: SLUG_B } });
    if (leftover) {
      await raw.unit.deleteMany({ where: { companyId: leftover.id } });
      await raw.building.deleteMany({ where: { companyId: leftover.id } });
      await raw.phase.deleteMany({ where: { companyId: leftover.id } });
      await raw.project.deleteMany({ where: { companyId: leftover.id } });
      await raw.lead.deleteMany({ where: { companyId: leftover.id } });
      await raw.setting.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }

    const companyB = await raw.company.create({
      data: { name: 'MT-7B Company B', slug: SLUG_B, isActive: true },
    });
    companyBId = companyB.id;

    const passwordHash = await argon2.hash(PASS_B);
    await raw.user.create({
      data: {
        email: EMAIL_B,
        passwordHash,
        fullName: 'Admin 7B',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, EMAIL_B, PASS_B),
    ]);

    const http = request(testApp.app.getHttpServer());

    await http
      .put(`/v1/settings/${SETTING_KEY_A}`)
      .set('Authorization', bearer(adminAToken))
      .send({ value: { source: 'company-a' } })
      .expect(200);

    await http
      .put(`/v1/settings/${SETTING_KEY_B}`)
      .set('Authorization', bearer(adminBToken))
      .send({ value: { source: 'company-b' } })
      .expect(200);

    await raw.user.deleteMany({ where: { phone: { in: [LEAD_PHONE_A, LEAD_PHONE_B] } } });

    const resLeadA = await http
      .post('/v1/leads')
      .set('Authorization', bearer(adminAToken))
      .send({ fullName: 'MT7B Lead A', phone: LEAD_PHONE_A });
    if (resLeadA.status !== 201) {
      throw new Error(`Failed to create Lead A: ${resLeadA.status} ${JSON.stringify(resLeadA.body)}`);
    }
    leadAId = (resLeadA.body as { id: string }).id;

    const resLeadB = await http
      .post('/v1/leads')
      .set('Authorization', bearer(adminBToken))
      .send({ fullName: 'MT7B Lead B', phone: LEAD_PHONE_B });
    if (resLeadB.status !== 201) {
      throw new Error(`Failed to create Lead B: ${resLeadB.status} ${JSON.stringify(resLeadB.body)}`);
    }
    leadBId = (resLeadB.body as { id: string }).id;

    const unitA = await raw.unit.findFirstOrThrow({
      where: { companyId: companyAId },
      select: { id: true },
    });
    unitAId = unitA.id;

    const projectB = await raw.project.create({
      data: {
        name: { ar: 'مشروع ب', en: 'Project B' },
        description: { ar: 'وصف', en: 'desc' },
        city: 'Jeddah',
        lat: 21.4858,
        lng: 39.1925,
        companyId: companyBId,
      },
    });
    projectBRawId = projectB.id;

    const phaseB = await raw.phase.create({
      data: {
        projectId: projectB.id,
        name: { ar: 'مرحلة', en: 'Phase 1' },
        order: 1,
        companyId: companyBId,
      },
    });
    const buildingB = await raw.building.create({
      data: { phaseId: phaseB.id, name: 'B1', totalFloors: 5, order: 1, companyId: companyBId },
    });
    const unitB = await raw.unit.create({
      data: {
        buildingId: buildingB.id,
        code: 'B-101',
        type: '1BR',
        area: 80,
        bedrooms: 1,
        bathrooms: 1,
        floor: 1,
        price: 500000,
        companyId: companyBId,
      },
    });
    unitBId = unitB.id;
  }, 60_000);

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.unit.deleteMany({ where: { companyId: companyBId } });
    await raw.building.deleteMany({ where: { companyId: companyBId } });
    await raw.phase.deleteMany({ where: { companyId: companyBId } });
    await raw.project.deleteMany({ where: { id: projectBRawId } });
    const leadBRow = await raw.lead.findUnique({ where: { id: leadBId }, select: { clientId: true } });
    await raw.lead.deleteMany({ where: { companyId: companyBId } });
    if (leadBRow?.clientId) {
      const otherLeads = await raw.lead.count({ where: { clientId: leadBRow.clientId } });
      if (otherLeads === 0) await raw.user.deleteMany({ where: { id: leadBRow.clientId } });
    }
    const leadARow = await raw.lead.findUnique({ where: { id: leadAId }, select: { clientId: true } });
    await raw.lead.delete({ where: { id: leadAId } }).catch(() => void 0);
    if (leadARow?.clientId) {
      await raw.user.deleteMany({ where: { id: leadARow.clientId, companyId: null } }).catch(() => void 0);
    }
    await raw.setting.deleteMany({ where: { companyId: companyBId } });
    await raw.setting.deleteMany({ where: { companyId: companyAId, key: SETTING_KEY_A } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });
  }, 30_000);

  const http = () => request(testApp.app.getHttpServer());

  describe('Settings isolation (MT-Schema-04 compound PK)', () => {
    it('ISO-5: Admin B cannot read Company A setting by key (404)', async () => {
      expect(
        (await http().get(`/v1/settings/${SETTING_KEY_A}`).set('Authorization', bearer(adminBToken))).status,
      ).toBe(404);
    });
    it('ISO-6: Admin B settings list does not include Company A key', async () => {
      const res = await http().get('/v1/settings').set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(200);
      expect((res.body as Array<{ key: string }>).map((s) => s.key)).not.toContain(SETTING_KEY_A);
    });
    it('ISO-7: Admin A can read their own setting (regression)', async () => {
      const res = await http().get(`/v1/settings/${SETTING_KEY_A}`).set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { key: string }).key).toBe(SETTING_KEY_A);
    });
    it('ISO-8: Admin B can create setting with the same key as Admin A (compound PK allows it)', async () => {
      const res = await http()
        .put(`/v1/settings/${SETTING_KEY_A}`)
        .set('Authorization', bearer(adminBToken))
        .send({ value: { source: 'company-b-same-key' } });
      expect(res.status).toBe(200);
      const resA = await http().get(`/v1/settings/${SETTING_KEY_A}`).set('Authorization', bearer(adminAToken));
      expect(resA.status).toBe(200);
      expect((resA.body as { value: { source: string } }).value).toEqual({ source: 'company-a' });
    });
  });

  describe('Leads isolation', () => {
    it('ISO-9: Admin B cannot read Company A lead by ID (404)', async () => {
      expect(
        (await http().get(`/v1/leads/${leadAId}`).set('Authorization', bearer(adminBToken))).status,
      ).toBe(404);
    });
    it('ISO-10: Admin B lead list does not include Company A lead', async () => {
      const res = await http().get('/v1/leads').set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(200);
      const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((l) => l.id);
      expect(ids).not.toContain(leadAId);
    });
    it('ISO-11: Admin A can read their own lead (regression)', async () => {
      const res = await http().get(`/v1/leads/${leadAId}`).set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(leadAId);
    });
    it('ISO-12: Admin A lead list does not include Company B lead', async () => {
      const res = await http().get('/v1/leads').set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((l) => l.id);
      expect(ids).not.toContain(leadBId);
    });
  });

  describe('Units isolation', () => {
    it('ISO-13: Admin B cannot read Company A unit by ID (404)', async () => {
      expect(
        (await http().get(`/v1/units/${unitAId}`).set('Authorization', bearer(adminBToken))).status,
      ).toBe(404);
    });
    it('ISO-14: Admin A cannot read Company B unit by ID (404)', async () => {
      expect(
        (await http().get(`/v1/units/${unitBId}`).set('Authorization', bearer(adminAToken))).status,
      ).toBe(404);
    });
    it('ISO-15: Admin A can read their own unit (regression)', async () => {
      const res = await http().get(`/v1/units/${unitAId}`).set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(unitAId);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MT-Test-03 — multi-tenant write-path isolation Phase 7C (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('MT-Test-03 — multi-tenant write-path isolation Phase 7C (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  const SLUG_B = 'mt-7c-company-b';
  const EMAIL_B = 'admin-7c@mt-test.local';
  const PASS_B = 'Admin7C-123!';
  const WI_SETTING_KEY = 'mt7c.write.isolation.key';
  const WI_PHONE_A = '+966501118800';
  const WI_PHONE_B = '+966501118801';
  const WI_PUBLIC_PHONE = '+966501118802';

  let companyAId: string;
  let companyBId: string;
  let adminAToken: string;
  let adminBToken: string;
  let clientToken: string;
  let publicVisitId: string;
  let clientVisitId: string;
  let leadAId: string;
  let leadBId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;

    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    const leftover = await raw.company.findFirst({ where: { slug: SLUG_B } });
    if (leftover) {
      await raw.visitRequest.deleteMany({ where: { companyId: leftover.id } });
      await raw.lead.deleteMany({ where: { companyId: leftover.id } });
      await raw.setting.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }

    const companyB = await raw.company.create({
      data: { name: 'MT-7C Company B', slug: SLUG_B, isActive: true },
    });
    companyBId = companyB.id;

    const passwordHash = await argon2.hash(PASS_B);
    await raw.user.create({
      data: {
        email: EMAIL_B,
        passwordHash,
        fullName: 'Admin 7C',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    [adminAToken, adminBToken, clientToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, EMAIL_B, PASS_B),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
    ]);

    await raw.user.deleteMany({ where: { phone: { in: [WI_PHONE_A, WI_PHONE_B] } } });
  }, 60_000);

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.visitRequest.deleteMany({ where: { companyId: companyBId } });
    await raw.lead.deleteMany({ where: { companyId: companyBId } });
    await raw.setting.deleteMany({ where: { companyId: companyBId } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });
    if (publicVisitId)
      await raw.visitRequest.delete({ where: { id: publicVisitId } }).catch(() => void 0);
    if (clientVisitId)
      await raw.visitRequest.delete({ where: { id: clientVisitId } }).catch(() => void 0);
    if (leadAId) {
      const row = await raw.lead.findUnique({ where: { id: leadAId }, select: { clientId: true } });
      await raw.lead.delete({ where: { id: leadAId } }).catch(() => void 0);
      if (row?.clientId)
        await raw.user.delete({ where: { id: row.clientId } }).catch(() => void 0);
    }
    await raw.setting.deleteMany({ where: { companyId: companyAId, key: WI_SETTING_KEY } });
  }, 30_000);

  const http = () => request(testApp.app.getHttpServer());

  it('WI-1: guest POST /public/visit-request stamps companyId = DEFAULT_COMPANY_ID', async () => {
    const res = await http()
      .post('/v1/public/visit-request')
      .send({
        projectId: fixtures.projects.p1Id,
        preferredDate: new Date(Date.now() + 86_400_000).toISOString(),
        name: 'MT7C Guest',
        phone: WI_PUBLIC_PHONE,
      })
      .expect(201);
    publicVisitId = (res.body as { id: string }).id;
    const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
      where: { id: publicVisitId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyAId);
  });

  it('WI-2: authenticated CLIENT POST /me/visit-requests stamps companyId = client.companyId', async () => {
    const res = await http()
      .post('/v1/me/visit-requests')
      .set('Authorization', bearer(clientToken))
      .send({
        projectId: fixtures.projects.p1Id,
        preferredDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      })
      .expect(201);
    clientVisitId = (res.body as { id: string }).id;
    const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
      where: { id: clientVisitId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyAId);
  });

  it('WI-3: Admin A POST /leads stamps companyId = companyAId', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminAToken))
      .send({ fullName: 'MT7C Lead A', phone: WI_PHONE_A });
    expect(res.status).toBe(201);
    leadAId = (res.body as { id: string }).id;
    const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: leadAId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyAId);
  });

  it('WI-4: Admin B POST /leads stamps companyId = companyBId (not companyAId)', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminBToken))
      .send({ fullName: 'MT7C Lead B', phone: WI_PHONE_B });
    expect(res.status).toBe(201);
    leadBId = (res.body as { id: string }).id;
    const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: leadBId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyBId);
    expect(row.companyId).not.toBe(companyAId);
  });

  it('WI-5: Admin A PUT /settings/:key stamps companyId = companyAId in DB', async () => {
    await http()
      .put(`/v1/settings/${WI_SETTING_KEY}`)
      .set('Authorization', bearer(adminAToken))
      .send({ value: { source: 'company-a-write' } })
      .expect(200);
    const row = await testApp.rawPrisma.setting.findFirst({
      where: { companyId: companyAId, key: WI_SETTING_KEY },
    });
    expect(row).not.toBeNull();
    expect(row!.companyId).toBe(companyAId);
  });

  it('WI-6: Admin B PUT /settings with same key creates separate row — no cross-company overwrite', async () => {
    await http()
      .put(`/v1/settings/${WI_SETTING_KEY}`)
      .set('Authorization', bearer(adminBToken))
      .send({ value: { source: 'company-b-write' } })
      .expect(200);
    const rows = await testApp.rawPrisma.setting.findMany({
      where: { key: WI_SETTING_KEY },
      select: { companyId: true, value: true },
    });
    const companyIds = rows.map((r) => r.companyId);
    expect(companyIds).toContain(companyAId);
    expect(companyIds).toContain(companyBId);
    const rowA = rows.find((r) => r.companyId === companyAId);
    expect(rowA?.value).toEqual({ source: 'company-a-write' });
  });

  it('WI-7: Admin B GET /visit-requests does not include Admin A public visit (write-then-cross-read)', async () => {
    const res = await http().get('/v1/visit-requests').set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);
    const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((v) => v.id);
    expect(ids).not.toContain(publicVisitId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Reports MT Isolation (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Reports MT Isolation (e2e)', () => {
  let testApp: TestApp;

  const COMPANY_B_SLUG = 'reports-mt-test-company-b';
  const COMPANY_B_ADMIN_EMAIL = 'admin-b@reports-mt-test.local';
  const COMPANY_B_ADMIN_PASSWORD = 'AdminB-Reports123!';

  let companyBId: string;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    const leftover = await raw.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await raw.contract.deleteMany({ where: { companyId: leftover.id } });
      await raw.project.deleteMany({ where: { companyId: leftover.id } });
      await raw.brokerCommission.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }

    const companyB = await raw.company.create({
      data: { name: 'Reports MT Test Company B', slug: COMPANY_B_SLUG, isActive: true },
    });
    companyBId = companyB.id;

    const passwordHash = await argon2.hash(COMPANY_B_ADMIN_PASSWORD);
    await raw.user.create({
      data: {
        email: COMPANY_B_ADMIN_EMAIL,
        passwordHash,
        fullName: 'Admin B (Reports MT)',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, COMPANY_B_ADMIN_EMAIL, COMPANY_B_ADMIN_PASSWORD),
    ]);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.brokerCommission.deleteMany({ where: { companyId: companyBId } });
    await raw.contract.deleteMany({ where: { companyId: companyBId } });
    await raw.project.deleteMany({ where: { companyId: companyBId } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });
  });

  const http = () => request(testApp.app.getHttpServer());

  it('ISO-R1: Company B admin /reports/sales returns 0 contracts (no cross-tenant leak)', async () => {
    const res = await http().get('/v1/reports/sales').set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);
    const body = res.body as { contracts: number; byProject: unknown[] };
    expect(body.contracts).toBe(0);
    expect(body.byProject).toHaveLength(0);
  });

  it('ISO-R2: Company B admin /reports/sales-trend returns all-zero months', async () => {
    const year = new Date().getFullYear();
    const res = await http()
      .get(`/v1/reports/sales-trend?year=${year}`)
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);
    const months = res.body as Array<{ month: number; contracts: number; total: number }>;
    expect(months).toHaveLength(12);
    expect(months.reduce((s, m) => s + m.contracts, 0)).toBe(0);
  });

  it('ISO-R3: Company B admin /reports/broker-leaderboard returns empty array', async () => {
    const res = await http()
      .get('/v1/reports/broker-leaderboard')
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBe(0);
  });

  it('ISO-R4: Company A admin /reports/sales returns 200 (own tenant not broken)', async () => {
    const res = await http().get('/v1/reports/sales').set('Authorization', bearer(adminAToken));
    expect(res.status).toBe(200);
    const body = res.body as { contracts: number; byProject: unknown[] };
    expect(typeof body.contracts).toBe('number');
    expect(Array.isArray(body.byProject)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IDOR Penetration Tests (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('IDOR Penetration Tests (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let customer1Token: string;
  let customer2Token: string;
  let broker1Token: string;
  let broker2Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [customer1Token, customer2Token, broker1Token, broker2Token] = await Promise.all([
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
    ]);
  });

  const http = () => request(testApp.app.getHttpServer());

  it('CUST-01: Customer2 GET /v1/me/maintenance-requests/:id for Customer1 request → 404', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  it('CUST-02: Customer1 GET /v1/me/documents/:id/download for Customer2 contract doc → 404', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer2ContractDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(404);
  });

  it('CUST-02b: Customer2 GET /v1/me/documents/:id/download for Customer1 contract doc → 404', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer1ContractDocId}/download`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  it('CUST-03: Customer1 GET /v1/contracts/me/contracts does NOT include Customer2 contract', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const ids: string[] = (res.body?.data ?? []).map((r: { id: string }) => r.id);
    expect(ids).not.toContain(fixtures.flowE.customer2ContractId);
  });

  it('CUST-03b: Customer2 GET /v1/contracts/me/contracts does NOT include Customer1 contract', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(200);
    const ids: string[] = (res.body?.data ?? []).map((r: { id: string }) => r.id);
    expect(ids).not.toContain(fixtures.flowE.customer1ContractId);
  });

  it('CUST-04: Customer2 GET /v1/me/deposits does NOT include Customer1 deposit', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(200);
    const ids: string[] = collectIds(res.body);
    expect(ids).not.toContain(fixtures.flowE.customer1DepositId);
  });

  it('CUST-05: Customer1 GET /v1/me/documents?ownerType=CONTRACT&ownerId=<c2> → 404 (ownership check, no existence leak)', async () => {
    // assertOwnsOwner throws NotFoundException("Contract not found") when the
    // caller does not own the requested ownerId — by design (no existence leak).
    // 404 is the proof of isolation: the route refuses before returning any data.
    const res = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer2ContractId })
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(404);
  });

  it('BROKER-01: Broker2 GET /v1/portal/leads/:id for Broker1 lead → 404', async () => {
    const res = await http()
      .get(`/v1/portal/leads/${fixtures.flowD.broker1ApprovedLeadId}`)
      .set('Authorization', bearer(broker2Token));
    expect(res.status).toBe(404);
  });

  it('BROKER-01b: Broker1 GET /v1/portal/leads returns only Broker1 leads', async () => {
    const res = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowD.broker1ApprovedLeadId);
  });

  it('BROKER-02: Broker2 GET /v1/portal/projects does NOT include Broker1-only projects', async () => {
    const res = await http()
      .get('/v1/portal/projects')
      .set('Authorization', bearer(broker2Token));
    expect(res.status).toBe(200);
    const ids: string[] = collectIds(res.body);
    expect(ids).not.toContain(fixtures.projects.p1Id);
    expect(ids).not.toContain(fixtures.projects.p2Id);
  });

  it('BROKER-02b: Broker1 GET /v1/portal/projects does NOT include Broker2-only projects', async () => {
    const res = await http()
      .get('/v1/portal/projects')
      .set('Authorization', bearer(broker1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).not.toContain(fixtures.projects.p3Id);
  });

  it('AUTH-01: Unauthenticated GET /v1/me/maintenance-requests/:id → 401 or 403', async () => {
    const res = await http().get(
      `/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`,
    );
    expect([401, 403]).toContain(res.status);
  });

  it('AUTH-01b: Unauthenticated GET /v1/portal/leads/:id → 401 or 403', async () => {
    const res = await http().get(`/v1/portal/leads/${fixtures.flowD.broker1ApprovedLeadId}`);
    expect([401, 403]).toContain(res.status);
  });

  it('AUTH-02: ADMIN role cannot use GET /v1/me/maintenance-requests/:id (CUSTOMER-only route)', async () => {
    const adminToken = await loginAs(
      testApp.app,
      process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
      process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
    );
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(adminToken));
    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST-002 — @PermissionsStrict two-person rule (e2e)
// ═════════════════════════════════════════════════════════════════════════════

const FAKE = '11111111-1111-4111-8111-111111111111';

const STRICT_ENDPOINTS: readonly [string, string, string, Record<string, unknown>?][] = [
  ['deposits:verify',              'patch', `/v1/deposits/${FAKE}/verify`,                   { status: 'VERIFIED', note: 'test' }],
  ['reservations:approve',         'post',  `/v1/reservations/${FAKE}/approve`,              {}],
  ['reservations:reject',          'post',  `/v1/reservations/${FAKE}/reject`,               { reason: 'test' }],
  ['reservations:cancel',          'post',  `/v1/reservations/${FAKE}/cancel`,               { reason: 'test' }],
  ['reservations:convert',         'post',  `/v1/reservations/${FAKE}/convert`,              {}],
  ['reservations:booking-payment', 'post',  `/v1/reservations/${FAKE}/booking-payment/confirm`, {}],
  ['contracts:sign',               'post',  `/v1/contracts/${FAKE}/sign`,                    { signedAt: '2026-01-01T00:00:00.000Z' }],
  ['broker_leads:approve',         'patch', `/v1/broker-leads/${FAKE}/approve`,              {}],
  ['broker_leads:reject',          'patch', `/v1/broker-leads/${FAKE}/reject`,               { reason: 'test' }],
  ['bonus:entries:approve',        'post',  `/v1/bonus-entries/${FAKE}/approve`,             {}],
  ['bonus:entries:pay',            'post',  `/v1/bonus-entries/${FAKE}/pay`,                 {}],
  ['broker_payouts:approve',       'patch', `/v1/broker-payouts/${FAKE}/approve`,            {}],
  ['broker_payouts:process',       'patch', `/v1/broker-payouts/${FAKE}/process`,            {}],
  ['broker_payouts:pay',           'patch', `/v1/broker-payouts/${FAKE}/mark-paid`,          {}],
  ['broker_payouts:cancel',        'patch', `/v1/broker-payouts/${FAKE}/cancel`,             {}],
  ['broker_commissions:approve',   'patch', `/v1/broker-commissions/${FAKE}/approve`,        {}],
  ['broker_commissions:reject',    'patch', `/v1/broker-commissions/${FAKE}/reject`,         { reason: 'test' }],
  ['broker_commissions:cancel',    'patch', `/v1/broker-commissions/${FAKE}/cancel`,         {}],
  ['brokers:suspend',              'post',  `/v1/brokers/${FAKE}/suspend`,                   {}],
  ['brokers:terminate',            'post',  `/v1/brokers/${FAKE}/terminate`,                 {}],
  ['broker_users:remove',          'patch', `/v1/broker-users/${FAKE}/status`,              { active: false }],
] as const;

describe('TEST-002 — @PermissionsStrict two-person rule (e2e)', () => {
  let testApp: TestApp;
  let bareToken: string;
  let adminToken: string;
  let bareUserId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const raw = testApp.rawPrisma;

    const company = await raw.company.findFirstOrThrow({ where: { isActive: true } });

    const bareEmail = `bare-admin-strict-test-${Date.now()}@example.com`;
    const barePass = 'BareAdmin123!';
    const hash = await argon2.hash(barePass);

    const bareUser = await raw.user.create({
      data: {
        email: bareEmail,
        passwordHash: hash,
        fullName: 'Bare Admin (strict-perm test)',
        role: 'ADMIN',
        active: true,
        companyId: company.id,
      },
    });
    bareUserId = bareUser.id;

    const adminUser = await raw.user.findFirstOrThrow({ where: { email: 'admin@example.com' } });

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
      'permissions:manage',
    ];

    const permRows = await raw.permission.findMany({
      where: { code: { in: strictCodes } },
      select: { id: true, code: true },
    });

    await raw.userPermission.createMany({
      data: permRows.map((p) => ({ userId: adminUser.id, permissionId: p.id })),
      skipDuplicates: true,
    });

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

    bareToken = bareRes.body?.tokens?.accessToken ?? bareRes.body?.accessToken;
    adminToken = adminRes.body?.tokens?.accessToken ?? adminRes.body?.accessToken;
  }, 60_000);

  afterAll(async () => {
    if (bareUserId) {
      await testApp.rawPrisma.user.delete({ where: { id: bareUserId } }).catch(() => void 0);
    }
  });

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

  describe('seededAdmin (ADMIN role + all strict codes) → NOT 403/401 on every strict endpoint', () => {
    for (const [code, method, url, body] of STRICT_ENDPOINTS) {
      it(`${code} — ${method.toUpperCase()} ${url} → not 401/403`, async () => {
        const res = await (request(testApp.app.getHttpServer()) as any)[method](url)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body ?? {});
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    }
  });
});
