/**
 * MT-Test-02B — Multi-tenant domain isolation, Phase 7B (e2e, real DB).
 *
 * Extends MT-Test-02 (mt-tenant-isolation.e2e-spec.ts) beyond Projects.
 * Proves that the Prisma middleware + TenantContextInterceptor enforce
 * strict companyId boundaries across three more scoped domains:
 *
 *   Settings (ISO-5..ISO-8)  — validates MT-Schema-04 compound PK:
 *     ISO-5: Admin B cannot read Admin A's setting by key (404).
 *     ISO-6: Admin B setting list does not include Admin A's key.
 *     ISO-7: Admin A can still read their own setting (regression).
 *     ISO-8: Admin B can create a setting with the same key as Admin A's
 *             without conflict (compound PK allows it).
 *
 *   Leads (ISO-9..ISO-12)
 *     ISO-9:  Admin B cannot read Admin A's lead by ID (404).
 *     ISO-10: Admin B lead list does not include Admin A's lead.
 *     ISO-11: Admin A can still read their own lead (regression).
 *     ISO-12: Admin A lead list does not include Admin B's lead.
 *
 *   Units (ISO-13..ISO-15)
 *     ISO-13: Admin B cannot read Admin A's unit by ID (404).
 *     ISO-14: Admin A cannot read Admin B's unit by ID (404).
 *     ISO-15: Admin A can still read their own unit (regression).
 *
 * Data setup:
 *   Company A = the default company already present after e2e globalSetup.
 *   Company B = created inline in beforeAll; fully torn down in afterAll.
 *
 *   Settings: created via HTTP PUT /v1/settings/:key.
 *   Leads:    created via HTTP POST /v1/leads.
 *   Units:    created directly in rawPrisma (bypass context) — tests the
 *             read-path middleware filter, not the write-path.
 */

import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';

const SLUG_B = 'mt-7b-company-b';
const EMAIL_B = 'admin-7b@mt-test.local';
const PASS_B = 'Admin7B-123!';

// Keys and phones must be unique enough that they don't collide across
// parallel runs or leftover data from a killed test session.
const SETTING_KEY_A = 'mt7b.isolation.alpha';
const SETTING_KEY_B = 'mt7b.isolation.beta';
const LEAD_PHONE_A = '+966501117700';
const LEAD_PHONE_B = '+966501117701';

describe('MT-Test-02B — multi-tenant domain isolation Phase 7B (e2e)', () => {
  let testApp: TestApp;

  let companyAId: string;
  let companyBId: string;

  let adminAToken: string;
  let adminBToken: string;

  let leadAId: string;
  let leadBId: string;

  let unitAId: string;
  let unitBId: string;

  // IDs of Company B entities created in rawPrisma for teardown.
  let projectBRawId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const raw = testApp.rawPrisma;

    // ── Company A ─────────────────────────────────────────────────────────
    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    // ── Company B — pre-clean + create ────────────────────────────────────
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

    // ── Auth ──────────────────────────────────────────────────────────────
    [adminAToken, adminBToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, EMAIL_B, PASS_B),
    ]);

    const http = request(testApp.app.getHttpServer());

    // ── Settings: create one per company via HTTP ─────────────────────────
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

    // ── Leads: create one per company via HTTP ────────────────────────────
    // Pre-clean stale phone users to avoid "phone already taken" collisions.
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

    // ── Units: one for each company, created directly in rawPrisma ────────
    // Company A: pick any existing unit from the seeded data.
    const unitA = await raw.unit.findFirstOrThrow({
      where: { companyId: companyAId },
      select: { id: true },
    });
    unitAId = unitA.id;

    // Company B: full hierarchy created inline.
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
      data: {
        phaseId: phaseB.id,
        name: 'B1',
        totalFloors: 5,
        order: 1,
        companyId: companyBId,
      },
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

    // Delete in FK order.
    await raw.unit.deleteMany({ where: { companyId: companyBId } });
    await raw.building.deleteMany({ where: { companyId: companyBId } });
    await raw.phase.deleteMany({ where: { companyId: companyBId } });
    await raw.project.deleteMany({ where: { id: projectBRawId } });

    // Leads — delete associated client users first if they have no other data.
    const leadBRow = await raw.lead.findUnique({ where: { id: leadBId }, select: { clientId: true } });
    await raw.lead.deleteMany({ where: { companyId: companyBId } });
    if (leadBRow?.clientId) {
      // Only delete if the client user was created solely for this lead.
      const otherLeads = await raw.lead.count({ where: { clientId: leadBRow.clientId } });
      if (otherLeads === 0) await raw.user.deleteMany({ where: { id: leadBRow.clientId } });
    }
    // Lead A cleanup — remove phone user created for this test.
    const leadARow = await raw.lead.findUnique({ where: { id: leadAId }, select: { clientId: true } });
    await raw.lead.delete({ where: { id: leadAId } }).catch(() => void 0);
    if (leadARow?.clientId) {
      await raw.user.deleteMany({ where: { id: leadARow.clientId, companyId: null } }).catch(() => void 0);
    }

    await raw.setting.deleteMany({ where: { companyId: companyBId } });
    await raw.setting.deleteMany({ where: { companyId: companyAId, key: SETTING_KEY_A } });

    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });

    await testApp.close();
  }, 30_000);

  const http = () => request(testApp.app.getHttpServer());

  // ── Settings (ISO-5..ISO-8) ───────────────────────────────────────────────

  describe('Settings isolation (MT-Schema-04 compound PK)', () => {
    it('ISO-5: Admin B cannot read Company A setting by key (404)', async () => {
      const res = await http()
        .get(`/v1/settings/${SETTING_KEY_A}`)
        .set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(404);
    });

    it('ISO-6: Admin B settings list does not include Company A key', async () => {
      const res = await http()
        .get('/v1/settings')
        .set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(200);
      const keys = (res.body as Array<{ key: string }>).map((s) => s.key);
      expect(keys).not.toContain(SETTING_KEY_A);
    });

    it('ISO-7: Admin A can read their own setting (regression)', async () => {
      const res = await http()
        .get(`/v1/settings/${SETTING_KEY_A}`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { key: string }).key).toBe(SETTING_KEY_A);
    });

    it('ISO-8: Admin B can create setting with the same key as Admin A (compound PK allows it)', async () => {
      // Same key, different company — should return 200, not 409.
      const res = await http()
        .put(`/v1/settings/${SETTING_KEY_A}`)
        .set('Authorization', bearer(adminBToken))
        .send({ value: { source: 'company-b-same-key' } });
      expect(res.status).toBe(200);
      // The value stored for Admin B must not overwrite Admin A's setting.
      const resA = await http()
        .get(`/v1/settings/${SETTING_KEY_A}`)
        .set('Authorization', bearer(adminAToken));
      expect(resA.status).toBe(200);
      expect((resA.body as { value: { source: string } }).value).toEqual({ source: 'company-a' });
    });
  });

  // ── Leads (ISO-9..ISO-12) ─────────────────────────────────────────────────

  describe('Leads isolation', () => {
    it('ISO-9: Admin B cannot read Company A lead by ID (404)', async () => {
      const res = await http()
        .get(`/v1/leads/${leadAId}`)
        .set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(404);
    });

    it('ISO-10: Admin B lead list does not include Company A lead', async () => {
      const res = await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(200);
      const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((l) => l.id);
      expect(ids).not.toContain(leadAId);
    });

    it('ISO-11: Admin A can read their own lead (regression)', async () => {
      const res = await http()
        .get(`/v1/leads/${leadAId}`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(leadAId);
    });

    it('ISO-12: Admin A lead list does not include Company B lead', async () => {
      const res = await http()
        .get('/v1/leads')
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      const ids = ((res.body?.data ?? res.body) as Array<{ id: string }>).map((l) => l.id);
      expect(ids).not.toContain(leadBId);
    });
  });

  // ── Units (ISO-13..ISO-15) ────────────────────────────────────────────────

  describe('Units isolation', () => {
    it('ISO-13: Admin B cannot read Company A unit by ID (404)', async () => {
      const res = await http()
        .get(`/v1/units/${unitAId}`)
        .set('Authorization', bearer(adminBToken));
      expect(res.status).toBe(404);
    });

    it('ISO-14: Admin A cannot read Company B unit by ID (404)', async () => {
      const res = await http()
        .get(`/v1/units/${unitBId}`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(404);
    });

    it('ISO-15: Admin A can read their own unit (regression)', async () => {
      const res = await http()
        .get(`/v1/units/${unitAId}`)
        .set('Authorization', bearer(adminAToken));
      expect(res.status).toBe(200);
      expect((res.body as { id: string }).id).toBe(unitAId);
    });
  });
});
