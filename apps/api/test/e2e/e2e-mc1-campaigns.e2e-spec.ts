/**
 * MC1 — marketing campaigns.
 *
 * - The admin creates a campaign (its utm code made from the name), records
 *   what was spent on which day, and the campaign shows its leads, spend,
 *   cost per lead and cost per sale. Sales managers read; reps only pick.
 * - A visitor who comes from a campaign link (utm_campaign = its code) and
 *   fills a form on the website becomes a lead of that campaign, under the
 *   campaign's source and project.
 * - A lead added by hand can be given a campaign; the leads list filters by it.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MC1 — marketing campaigns (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let managerToken: string;
  let companyId: string;
  let otherCompanyId: string;
  let otherCampaignId: string;
  let otherProjectId: string;
  let sourceId: string;
  const stamp = Date.now().toString().slice(-7);
  const campaignIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newCampaign = async (body: Record<string, unknown>) => {
    const res = await as(adminToken, http().post('/v1/campaigns')).send(body).expect(201);
    campaignIds.push(res.body.id);
    return res.body as { id: string; code: string };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken, managerToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } })).companyId!;
    sourceId = (await raw.leadSource.findFirstOrThrow({ where: { companyId }, select: { id: true } })).id;
    otherCompanyId = (await raw.company.create({ data: { name: `MC1 Other ${stamp}`, slug: `mc1-other-${stamp}` } })).id;
    otherCampaignId = (
      await raw.campaign.create({ data: { companyId: otherCompanyId, name: 'Other', code: `other-${stamp}`, channel: 'FACEBOOK' } })
    ).id;
    otherProjectId = (
      await raw.project.create({
        data: { companyId: otherCompanyId, name: { ar: 'م', en: 'P' }, description: { ar: '', en: '' }, city: 'Cairo', lat: 30, lng: 31 },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const leads = await raw.lead.findMany({ where: { campaignId: { in: campaignIds } }, select: { id: true, clientId: true } });
    const ids = leads.map((l) => l.id);
    await raw.infoRequest.deleteMany({ where: { leadId: { in: ids } } });
    await raw.leadNote.deleteMany({ where: { leadId: { in: ids } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await raw.lead.deleteMany({ where: { id: { in: ids } } });
    await raw.user.deleteMany({ where: { id: { in: leads.map((l) => l.clientId) }, role: UserRole.CLIENT } });
    await raw.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await raw.campaign.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.project.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('MC1-1: the admin runs campaigns, a manager reads them, a rep only picks', async () => {
    const a = await newCampaign({ name: `Summer Offer ${stamp}`, channel: 'FACEBOOK', budget: 50000 });
    expect(a.code).toBe(`summer-offer-${stamp}`);
    // An Arabic-only name still gets a code links can carry.
    const b = await newCampaign({ name: 'حملة الصيف', channel: 'INSTAGRAM' });
    expect(b.code).toMatch(/^campaign-\d+$/);
    await as(adminToken, http().post('/v1/campaigns')).send({ name: 'x', code: a.code, channel: 'GOOGLE' }).expect(409);
    await as(adminToken, http().post('/v1/campaigns')).send({ name: 'x', channel: 'GOOGLE', projectId: otherProjectId }).expect(400);
    await as(adminToken, http().post('/v1/campaigns')).send({ name: 'x', channel: 'GOOGLE', startDate: '2026-10-10', endDate: '2026-10-01' }).expect(400);

    await as(salesToken, http().post('/v1/campaigns')).send({ name: 'x', channel: 'GOOGLE' }).expect(403);
    await as(salesToken, http().get('/v1/campaigns')).expect(403);
    const options = (await as(salesToken, http().get('/v1/campaigns/options')).expect(200)).body as Array<{ id: string }>;
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(options.map((o) => o.id)).not.toContain(otherCampaignId);
    await as(managerToken, http().get('/v1/campaigns')).expect(200);
    await as(adminToken, http().get(`/v1/campaigns/${otherCampaignId}`)).expect(404);
  });

  it('MC1-2: spend is recorded by day and sums into the campaign; cost per lead and per sale follow', async () => {
    const c = await newCampaign({ name: `Spend ${stamp}`, channel: 'GOOGLE', sourceId, projectId: fixtures.projects.p1Id });
    const url = `/v1/campaigns/${c.id}/spend`;
    const first = (await as(adminToken, http().post(url)).send({ amount: 1500.5, spentOn: '2026-10-01', note: 'أسبوع 1' }).expect(201)).body;
    await as(adminToken, http().post(url)).send({ amount: 2499.5, spentOn: '2026-10-08' }).expect(201);
    await as(adminToken, http().post(url)).send({ amount: 0, spentOn: '2026-10-08' }).expect(400);
    await as(managerToken, http().post(url)).send({ amount: 10, spentOn: '2026-10-08' }).expect(403);
    await as(adminToken, http().post(`/v1/campaigns/${otherCampaignId}/spend`)).send({ amount: 10, spentOn: '2026-10-08' }).expect(404);

    // Two leads by hand, one of them sold.
    const lead = async (tail: string) =>
      (
        await as(adminToken, http().post('/v1/leads'))
          .send({ fullName: `MC1 ${tail}`, phone: `+2010${tail}${stamp}`, campaignId: c.id, assignedSalesId: fixtures.userIds.salesId })
          .expect(201)
      ).body as { id: string; sourceId: string; projectInterestId: string; campaignId: string };
    const l1 = await lead('1');
    expect(l1).toMatchObject({ campaignId: c.id, sourceId, projectInterestId: fixtures.projects.p1Id });
    const l2 = await lead('2');
    await testApp.rawPrisma.lead.update({ where: { id: l2.id }, data: { stage: LeadStage.WON } });

    const detail = (await as(adminToken, http().get(`/v1/campaigns/${c.id}`)).expect(200)).body;
    expect(detail.stats).toMatchObject({ leads: 2, won: 1, spend: 4000, cpl: 2000, cpa: 4000 });
    expect(detail.spend).toHaveLength(2);
    expect(detail.spend[0].spentOn.slice(0, 10)).toBe('2026-10-08');
    expect(typeof detail.siteUrl).toBe('string');

    await as(adminToken, http().delete(`${url}/${first.id}`)).expect(200);
    const after = (await as(adminToken, http().get(`/v1/campaigns/${c.id}`)).expect(200)).body;
    expect(after.stats.spend).toBe(2499.5);

    // The leads list filters by campaign.
    const list = (await as(adminToken, http().get(`/v1/leads?campaignId=${c.id}&pageSize=50`)).expect(200)).body;
    expect(list.data.map((l: { id: string }) => l.id).sort()).toEqual([l1.id, l2.id].sort());
    // Another company's campaign is refused on a lead.
    await as(adminToken, http().post('/v1/leads'))
      .send({ fullName: 'MC1 x', phone: `+20103${stamp}`, campaignId: otherCampaignId })
      .expect(400);
  });

  it('MC1-3: a visitor from a campaign link becomes that campaign’s lead, under its source and project', async () => {
    const c = await newCampaign({ name: `Web ${stamp}`, channel: 'INSTAGRAM', sourceId, projectId: fixtures.projects.p1Id });
    const phone = `+2012${stamp}9`;
    await http()
      .post('/v1/public/info-request')
      .send({ message: 'أريد تفاصيل المشروع', name: 'MC1 Visitor', phone, utmSource: 'instagram', utmCampaign: c.code.toUpperCase() })
      .expect(201);
    const lead = await testApp.rawPrisma.lead.findFirstOrThrow({ where: { phone }, select: { campaignId: true, sourceId: true, projectInterestId: true, utmCampaign: true } });
    expect(lead).toMatchObject({ campaignId: c.id, sourceId, projectInterestId: fixtures.projects.p1Id });

    // An unknown code keeps the website's own source and no campaign.
    const phone2 = `+2012${stamp}8`;
    await http()
      .post('/v1/public/info-request')
      .send({ message: 'أريد تفاصيل المشروع', name: 'MC1 Visitor 2', phone: phone2, utmCampaign: `nope-${stamp}` })
      .expect(201);
    const lead2 = await testApp.rawPrisma.lead.findFirstOrThrow({ where: { phone: phone2 }, select: { id: true, campaignId: true, clientId: true } });
    expect(lead2.campaignId).toBeNull();
    await testApp.rawPrisma.infoRequest.deleteMany({ where: { leadId: lead2.id } });
    await testApp.rawPrisma.lead.delete({ where: { id: lead2.id } });
    await testApp.rawPrisma.user.deleteMany({ where: { id: lead2.clientId, role: UserRole.CLIENT } });
  });
});
