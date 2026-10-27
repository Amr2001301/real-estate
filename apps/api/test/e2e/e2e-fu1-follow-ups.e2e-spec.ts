/**
 * FU1 — following up on leads.
 *
 * - An activity records what happened (call / meeting / WhatsApp / note),
 *   how a call went, and the lead's next follow-up.
 * - Notes take replies, one level deep, text only.
 * - The follow-up lists (overdue / today / upcoming) hold open leads in the
 *   caller's scope: a rep sees their own, an admin everyone's.
 * - A lost lead has nothing left to follow up.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('FU1 — lead follow-ups (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let outsiderId: string;
  const stamp = Date.now().toString().slice(-7);
  const leadIds: string[] = [];
  const DAY = 86_400_000;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newLead = async (assignedSalesId: string, phoneTail: string) => {
    const phone = `+2012${phoneTail.slice(-1)}${stamp}`;
    const client = await testApp.rawPrisma.user.create({
      data: { companyId, fullName: `FU1 ${phoneTail}`, phone, role: UserRole.CLIENT, active: true },
    });
    const lead = await testApp.rawPrisma.lead.create({
      data: { companyId, clientId: client.id, fullName: `FU1 ${phoneTail}`, phone, assignedSalesId, stage: LeadStage.INTERESTED },
    });
    leadIds.push(lead.id);
    return lead;
  };
  const ids = (body: { data: Array<{ id: string }> }) => body.data.map((l) => l.id);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { companyId: true },
    });
    companyId = admin.companyId!;
    outsiderId = (
      await testApp.rawPrisma.user.create({
        data: { companyId, fullName: 'FU1 Other rep', phone: `+20118${stamp}`, role: UserRole.SALES, active: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadNote.deleteMany({ where: { leadId: { in: leadIds }, parentId: { not: null } } });
    await raw.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { phone: { endsWith: stamp }, role: UserRole.CLIENT } });
    await raw.user.delete({ where: { id: outsiderId } });
  });

  it('FU1-1: a call, how it went and the next follow-up are logged together', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '1');
    const next = new Date(Date.now() + 2 * DAY).toISOString();
    const res = await as(salesToken, http().post(`/v1/leads/${lead.id}/notes`))
      .send({ body: 'لم يرد', kind: 'CALL', callResult: 'NO_ANSWER', nextActionAt: next, nextActionType: 'CALL', nextActionNote: 'اتصل مساءً' })
      .expect(201);
    expect(res.body).toMatchObject({ kind: 'CALL', callResult: 'NO_ANSWER', nextActionType: 'CALL' });

    const after = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.nextActionAt?.toISOString()).toBe(next);
    expect(after.nextActionType).toBe('CALL');
    expect(after.nextActionNote).toBe('اتصل مساءً');

    // Leaving the follow-up out keeps it; null clears it.
    await as(salesToken, http().post(`/v1/leads/${lead.id}/notes`)).send({ body: 'ملاحظة' }).expect(201);
    expect((await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).nextActionAt?.toISOString()).toBe(next);
    await as(salesToken, http().post(`/v1/leads/${lead.id}/notes`)).send({ body: 'تم', kind: 'MEETING', nextActionAt: null }).expect(201);
    expect((await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).nextActionAt).toBeNull();
  });

  it('FU1-2: a call result is for calls, and a follow-up is in the future', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '2');
    const url = `/v1/leads/${lead.id}/notes`;
    await as(salesToken, http().post(url)).send({ body: 'x', kind: 'MEETING', callResult: 'ANSWERED' }).expect(400);
    await as(salesToken, http().post(url)).send({ body: 'x', callResult: 'ANSWERED' }).expect(400);
    await as(salesToken, http().post(url)).send({ body: 'x', nextActionAt: new Date(Date.now() - DAY).toISOString() }).expect(400);
    await as(salesToken, http().post(url)).send({ body: 'x', kind: 'EMAIL' }).expect(400);
    await as(salesToken, http().post(url)).send({ body: '   ' }).expect(400);
  });

  it('FU1-3: notes take text replies, one level deep, on the same lead', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '3');
    const other = await newLead(fixtures.userIds.salesId, '4');
    const url = `/v1/leads/${lead.id}/notes`;
    const note = (await as(salesToken, http().post(url)).send({ body: 'العميل طلب عرض سعر', kind: 'WHATSAPP' }).expect(201)).body;

    const reply = (await as(adminToken, http().post(url)).send({ body: 'أرسلته', parentId: note.id }).expect(201)).body;
    expect(reply).toMatchObject({ parentId: note.id, kind: 'NOTE' });
    // Text only, never a reply to a reply, never across leads.
    await as(adminToken, http().post(url)).send({ body: 'x', parentId: note.id, nextActionAt: new Date(Date.now() + DAY).toISOString() }).expect(400);
    await as(adminToken, http().post(url)).send({ body: 'x', parentId: note.id, kind: 'CALL' }).expect(400);
    await as(adminToken, http().post(url)).send({ body: 'x', parentId: reply.id }).expect(400);
    await as(adminToken, http().post(`/v1/leads/${other.id}/notes`)).send({ body: 'x', parentId: note.id }).expect(404);

    // The timeline holds the note with its reply under it.
    const detail = (await as(salesToken, http().get(`/v1/leads/${lead.id}`)).expect(200)).body;
    expect(detail.notes).toHaveLength(1);
    expect(detail.notes[0]).toMatchObject({ id: note.id, kind: 'WHATSAPP' });
    expect(detail.notes[0].replies.map((r: { id: string }) => r.id)).toEqual([reply.id]);
  });

  it('FU1-4: overdue, today and upcoming lists, in the caller’s scope, open leads only', async () => {
    const raw = testApp.rawPrisma;
    const mine = await newLead(fixtures.userIds.salesId, '5');
    const theirs = await newLead(outsiderId, '6');
    const later = await newLead(fixtures.userIds.salesId, '7');
    const lost = await newLead(fixtures.userIds.salesId, '8');
    const past = new Date(Date.now() - 3 * 3_600_000);
    await raw.lead.updateMany({ where: { id: { in: [mine.id, theirs.id, lost.id] } }, data: { nextActionAt: past, nextActionType: 'CALL' } });
    await raw.lead.update({ where: { id: lost.id }, data: { stage: LeadStage.LOST } });
    await raw.lead.update({ where: { id: later.id }, data: { nextActionAt: new Date(Date.now() + 5 * DAY), nextActionType: 'MEETING' } });

    const repOverdue = (await as(salesToken, http().get('/v1/leads/follow-ups?bucket=overdue&pageSize=100')).expect(200)).body;
    expect(ids(repOverdue)).toContain(mine.id);
    expect(ids(repOverdue)).not.toContain(theirs.id);
    expect(ids(repOverdue)).not.toContain(lost.id);
    expect(ids(repOverdue)).not.toContain(later.id);

    const adminOverdue = (await as(adminToken, http().get('/v1/leads/follow-ups?bucket=overdue&pageSize=100')).expect(200)).body;
    expect(ids(adminOverdue)).toEqual(expect.arrayContaining([mine.id, theirs.id]));

    const upcoming = (await as(salesToken, http().get('/v1/leads/follow-ups?bucket=upcoming&pageSize=100')).expect(200)).body;
    expect(ids(upcoming)).toContain(later.id);
    expect(upcoming.data.find((l: { id: string }) => l.id === later.id)).toMatchObject({ nextActionType: 'MEETING' });

    const summary = (await as(salesToken, http().get('/v1/leads/follow-ups/summary')).expect(200)).body;
    expect(summary.overdue).toBeGreaterThanOrEqual(1);
    expect(summary.upcoming).toBeGreaterThanOrEqual(1);
    expect(summary).toHaveProperty('today');

    await as(salesToken, http().get('/v1/leads/follow-ups?bucket=someday')).expect(400);
  });

  it('FU1-5: a lead marked lost drops its follow-up, and takes no new one', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '9');
    const next = new Date(Date.now() + DAY).toISOString();
    await as(salesToken, http().post(`/v1/leads/${lead.id}/notes`)).send({ body: 'متابعة', nextActionAt: next }).expect(201);
    await as(salesToken, http().patch(`/v1/leads/${lead.id}/stage`)).send({ stage: 'LOST' }).expect(200);
    const after = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ nextActionAt: null, nextActionType: null, nextActionNote: null });
    await as(salesToken, http().post(`/v1/leads/${lead.id}/notes`)).send({ body: 'x', nextActionAt: next }).expect(400);
  });
});
