/**
 * BB2 — lead sources (F12). The dashboard had no screen for them and the API
 * could only add one, so a company created from the platform had no source
 * at all and every lead was filed under none. A new company now starts with
 * the default sources; the admin renames them, switches them off, and a
 * switched-off source is not offered for a new lead.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { DEFAULT_LEAD_SOURCES } from '../../src/modules/leads/lead-source-defaults';

describe('BB2 — lead sources (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let superId = '';
  let newCompanyId = '';
  const sourceIds: string[] = [];
  const leadPhones: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const addSource = async (ar: string, en: string) => {
    const res = await asAdmin(http().post('/v1/lead-sources')).send({ ar, en }).expect(201);
    sourceIds.push(res.body.id);
    return res.body.id as string;
  };
  const createLead = (sourceId: string, n: number) => {
    const phone = `+2010${stamp}${n}`.slice(0, 13);
    leadPhones.push(phone);
    return asAdmin(http().post('/v1/leads')).send({ fullName: `BB2 Lead ${n}`, phone, sourceId });
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const leads = await raw.lead.findMany({
      where: { phone: { in: leadPhones } },
      select: { id: true, clientId: true },
    });
    const leadIds = leads.map((l) => l.id);
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [...leadIds, ...sourceIds] } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { id: { in: leads.map((l) => l.clientId) } } });
    await raw.leadSource.deleteMany({ where: { id: { in: sourceIds } } });
    if (newCompanyId) {
      await raw.leadSource.deleteMany({ where: { companyId: newCompanyId } });
      await raw.setting.deleteMany({ where: { companyId: newCompanyId } });
      await raw.companyDomain.deleteMany({ where: { companyId: newCompanyId } });
      await raw.auditLog.deleteMany({ where: { companyId: newCompanyId } });
      await raw.company.deleteMany({ where: { id: newCompanyId } });
    }
    await raw.user.deleteMany({ where: { id: superId } });
  });

  it('BB2-1: a company created from the platform starts with the default sources', async () => {
    superId = (
      await testApp.rawPrisma.user.create({
        data: {
          role: UserRole.SUPER_ADMIN,
          fullName: 'BB2 Platform',
          email: `bb2-super-${stamp}@example.com`,
          locale: 'en',
        },
        select: { id: true },
      })
    ).id;
    const superToken = await testApp.signAccessToken(superId, 'SUPER_ADMIN');
    const created = await http()
      .post('/v1/super-admin/companies')
      .set('Authorization', bearer(superToken))
      .send({ name: `BB2 Co ${stamp}`, slug: `bb2-co-${stamp}`, country: 'EG' })
      .expect(201);
    newCompanyId = created.body.company.id;

    const sources = await testApp.rawPrisma.leadSource.findMany({
      where: { companyId: newCompanyId },
      select: { name: true, active: true },
    });
    expect(sources.map((s) => (s.name as { en: string }).en).sort()).toEqual(
      DEFAULT_LEAD_SOURCES.map((n) => n.en).sort(),
    );
    expect(sources.every((s) => s.active)).toBe(true);
  });

  it('BB2-2: the admin renames a source and two sources cannot share a name', async () => {
    const id = await addSource(`BB2 مصدر ${stamp}`, `BB2 Source ${stamp}`);
    const renamed = await asAdmin(http().patch(`/v1/lead-sources/${id}`))
      .set('X-Raw-Translatable', '1')
      .send({ ar: `BB2 معرض ${stamp}`, en: `BB2 Expo ${stamp}` })
      .expect(200);
    expect(renamed.body.name).toEqual({ ar: `BB2 معرض ${stamp}`, en: `BB2 Expo ${stamp}` });

    await asAdmin(http().post('/v1/lead-sources'))
      .send({ ar: `BB2 آخر ${stamp}`, en: `bb2 expo ${stamp}` })
      .expect(409);
  });

  it('BB2-3: a switched-off source is not offered for a new lead, and stays on its leads', async () => {
    const id = await addSource(`BB2 قديم ${stamp}`, `BB2 Old ${stamp}`);
    const lead = await createLead(id, 1);
    expect(lead.status).toBe(201);

    await asAdmin(http().patch(`/v1/lead-sources/${id}`))
      .send({ active: false })
      .expect(200);
    const refused = await createLead(id, 2);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('موقوف');

    const kept = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.body.id } });
    expect(kept.sourceId).toBe(id);
  });

  it("BB2-4: another company's source can be neither edited nor used", async () => {
    const theirs = await testApp.rawPrisma.leadSource.findFirstOrThrow({
      where: { companyId: newCompanyId },
      select: { id: true },
    });
    await asAdmin(http().patch(`/v1/lead-sources/${theirs.id}`))
      .send({ active: false })
      .expect(404);
    expect((await createLead(theirs.id, 3)).status).toBe(400);
  });
});
