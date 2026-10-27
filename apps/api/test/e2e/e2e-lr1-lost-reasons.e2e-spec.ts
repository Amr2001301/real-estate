/**
 * LR1 — why leads are lost.
 *
 * - Each company keeps its own list of lost reasons (defaults to start);
 *   the admin adds, renames and switches them off, reps only pick.
 * - Marking a lead LOST records the reason, a note and when; bringing it
 *   back clears them. Only the company's active reasons are accepted.
 * - The lost report counts by reason, rep, source and month, against the
 *   deals won, in the caller's scope; the leads list filters by reason.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('LR1 — lost reasons and report (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let managerToken: string;
  let companyId: string;
  let otherCompanyId: string;
  let otherReasonId: string;
  const stamp = Date.now().toString().slice(-7);
  const leadIds: string[] = [];
  const reasonIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newLead = async (phoneTail: string, stage: LeadStage = LeadStage.INTERESTED) => {
    const phone = `+2015${phoneTail.slice(-1)}${stamp}`;
    const client = await testApp.rawPrisma.user.create({
      data: { companyId, fullName: `LR1 ${phoneTail}`, phone, role: UserRole.CLIENT, active: true },
    });
    const lead = await testApp.rawPrisma.lead.create({
      data: { companyId, clientId: client.id, fullName: `LR1 ${phoneTail}`, phone, assignedSalesId: fixtures.userIds.salesId, stage },
    });
    leadIds.push(lead.id);
    return lead;
  };
  const addReason = async (ar: string, en: string) => {
    const res = await as(adminToken, http().post('/v1/lost-reasons')).send({ ar, en }).expect(201);
    reasonIds.push(res.body.id);
    return res.body as { id: string; sortOrder: number };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken, managerToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!'),
    ]);
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } })
    ).companyId!;
    otherCompanyId = (
      await testApp.rawPrisma.company.create({ data: { name: `LR1 Other ${stamp}`, slug: `lr1-other-${stamp}` } })
    ).id;
    otherReasonId = (
      await testApp.rawPrisma.lostReason.create({ data: { companyId: otherCompanyId, name: { ar: 'سبب آخر', en: 'Other co' } } })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { phone: { endsWith: stamp }, role: UserRole.CLIENT } });
    await raw.lostReason.deleteMany({ where: { id: { in: reasonIds } } });
    await raw.lostReason.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('LR1-1: the company starts with reasons; the admin keeps the list, reps only pick', async () => {
    // Names come flattened to the request's language.
    const list = (await as(salesToken, http().get('/v1/lost-reasons')).set('Accept-Language', 'en').expect(200)).body as Array<{ id: string; name: string }>;
    expect(list.map((r) => r.name)).toEqual(expect.arrayContaining(['Price too high', 'Other']));
    expect(list.map((r) => r.id)).not.toContain(otherReasonId);

    await as(salesToken, http().post('/v1/lost-reasons')).send({ ar: 'س', en: 's' }).expect(403);
    const reason = await addReason(`سبب ${stamp}`, `Reason ${stamp}`);
    expect(reason.sortOrder).toBeGreaterThan(0);
    await as(adminToken, http().post('/v1/lost-reasons')).send({ ar: `سبب ${stamp}`, en: 'different' }).expect(409);

    // Switched off: gone from the reps' list, kept on the admin's.
    await as(adminToken, http().patch(`/v1/lost-reasons/${reason.id}`)).send({ active: false }).expect(200);
    const repIds = ((await as(salesToken, http().get('/v1/lost-reasons')).expect(200)).body as Array<{ id: string }>).map((r) => r.id);
    expect(repIds).not.toContain(reason.id);
    const adminIds = ((await as(adminToken, http().get('/v1/lost-reasons?all=1')).expect(200)).body as Array<{ id: string }>).map((r) => r.id);
    expect(adminIds).toContain(reason.id);
    // Another company's reason is not ours to change.
    await as(adminToken, http().patch(`/v1/lost-reasons/${otherReasonId}`)).send({ active: false }).expect(404);
  });

  it('LR1-2: a lost lead says why and when; only active reasons of the company; reopening clears it', async () => {
    const reason = await addReason(`سعر ${stamp}`, `Price ${stamp}`);
    const off = await addReason(`موقوف ${stamp}`, `Off ${stamp}`);
    await as(adminToken, http().patch(`/v1/lost-reasons/${off.id}`)).send({ active: false }).expect(200);
    const lead = await newLead('1');
    const url = `/v1/leads/${lead.id}/stage`;

    await as(salesToken, http().patch(url)).send({ stage: 'LOST', lostReasonId: off.id }).expect(400);
    await as(salesToken, http().patch(url)).send({ stage: 'LOST', lostReasonId: otherReasonId }).expect(400);
    await as(salesToken, http().patch(url)).send({ stage: 'VISIT', lostReasonId: reason.id }).expect(400);

    await as(salesToken, http().patch(url)).send({ stage: 'LOST', lostReasonId: reason.id, lostNote: 'وجد أرخص' }).expect(200);
    const lost = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(lost).toMatchObject({ stage: 'LOST', lostReasonId: reason.id, lostNote: 'وجد أرخص' });
    expect(lost.lostAt).toBeInstanceOf(Date);
    const detail = (await as(salesToken, http().get(`/v1/leads/${lead.id}`)).expect(200)).body;
    expect(detail.lostReason).toMatchObject({ id: reason.id });

    await as(salesToken, http().patch(url)).send({ stage: 'INTERESTED' }).expect(200);
    const back = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(back).toMatchObject({ lostReasonId: null, lostNote: null, lostAt: null });
  });

  it('LR1-3: the report counts by reason, rep, source and month in the caller’s scope', async () => {
    const reason = await addReason(`تقرير ${stamp}`, `Report ${stamp}`);
    const a = await newLead('2');
    const b = await newLead('3');
    for (const l of [a, b]) {
      await as(salesToken, http().patch(`/v1/leads/${l.id}/stage`)).send({ stage: 'LOST', lostReasonId: reason.id }).expect(200);
    }
    const today = new Date().toISOString().slice(0, 10);
    const report = (await as(adminToken, http().get(`/v1/leads/lost-report?from=2000-01-01&to=2100-01-01`)).expect(200)).body;
    const row = report.byReason.find((r: { reasonId: string }) => r.reasonId === reason.id);
    expect(row).toMatchObject({ count: 2 });
    expect(report.totals.lost).toBeGreaterThanOrEqual(2);
    expect(report.bySales.find((r: { salesId: string }) => r.salesId === fixtures.userIds.salesId)).toBeTruthy();
    expect(report.trend.length).toBeGreaterThan(0);
    expect(report.recent.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([a.id, b.id]));

    // A period before today leaves them out.
    const before = (await as(adminToken, http().get('/v1/leads/lost-report?from=2000-01-01&to=2000-12-31')).expect(200)).body;
    expect(before.byReason.find((r: { reasonId: string }) => r.reasonId === reason.id)).toBeUndefined();
    await as(adminToken, http().get(`/v1/leads/lost-report?from=${today}T00:00`)).expect(400);

    // A rep has no report; a manager gets one.
    await as(salesToken, http().get('/v1/leads/lost-report')).expect(403);
    await as(managerToken, http().get('/v1/leads/lost-report')).expect(200);

    // From the report to the leads lost for that reason.
    const list = (await as(adminToken, http().get(`/v1/leads?lostReasonId=${reason.id}&pageSize=50`)).expect(200)).body;
    expect(list.data.map((l: { id: string }) => l.id).sort()).toEqual([a.id, b.id].sort());
  });
});
