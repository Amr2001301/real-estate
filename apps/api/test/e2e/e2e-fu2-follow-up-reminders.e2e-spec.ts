/**
 * FU2 — follow-ups that reach the rep.
 *
 * - 15 minutes before a lead's next action its rep is reminded; 30 minutes
 *   after it, if nothing moved it, the rep is told it is overdue. Each is
 *   sent once per follow-up time; a new time is reminded again.
 * - Each morning every rep gets today's and the overdue count, and every
 *   sales manager their team's.
 * - The leads list carries each lead's latest activity (the customer page).
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const MIN = 60_000;

describe('FU2 — follow-up reminders (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let salesToken: string;
  let companyId: string;
  let salesId: string;
  let managerId: string;
  let previousManagerId: string | null;
  const stamp = Date.now().toString().slice(-7);
  const leadIds: string[] = [];
  const clientIds: string[] = [];
  const started = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const newLead = async (n: number, nextActionAt: Date | null, stage: LeadStage = LeadStage.INTERESTED) => {
    const raw = testApp.rawPrisma;
    const phone = `+2017${n}${stamp}`;
    const client = await raw.user.create({ data: { companyId, fullName: `FU2 ${n}`, phone, role: UserRole.CLIENT, active: true } });
    clientIds.push(client.id);
    const lead = await raw.lead.create({
      data: { companyId, clientId: client.id, fullName: `FU2 Lead ${n}`, phone, assignedSalesId: salesId, stage, nextActionAt, nextActionType: 'CALL' },
    });
    leadIds.push(lead.id);
    return lead.id;
  };
  const sent = async (userId: string, code: string, leadId?: string) => {
    const rows = await testApp.rawPrisma.notification.findMany({
      where: { userId, templateCode: code, createdAt: { gte: started } },
      select: { payload: true },
    });
    return leadId ? rows.filter((r) => (r.payload as { entityId?: string }).entityId === leadId).length : rows.length;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    salesToken = await loginAs(testApp.app, 'sales@example.com', 'SalesPass123!');
    const raw = testApp.rawPrisma;
    salesId = fixtures.userIds.salesId;
    managerId = fixtures.userIds.managerId;
    const sales = await raw.user.findUniqueOrThrow({ where: { id: salesId }, select: { companyId: true, managerId: true } });
    companyId = sales.companyId!;
    previousManagerId = sales.managerId;
    await raw.user.update({ where: { id: salesId }, data: { managerId } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { id: { in: clientIds }, role: UserRole.CLIENT } });
    await raw.user.update({ where: { id: salesId }, data: { managerId: previousManagerId } });
  });

  it('FU2-1: reminded before, alerted after, once per follow-up time', async () => {
    const now = Date.now();
    const soon = await newLead(1, new Date(now + 10 * MIN));
    const late = await newLead(2, new Date(now - 40 * MIN));
    const notYetLate = await newLead(3, new Date(now - 10 * MIN));
    const farOff = await newLead(4, new Date(now + 3 * 60 * MIN));
    const closed = await newLead(5, new Date(now + 10 * MIN), LeadStage.LOST);

    await testApp.runCronJob('follow-up-reminders');
    expect(await sent(salesId, 'follow_up_due_soon', soon)).toBe(1);
    expect(await sent(salesId, 'follow_up_overdue', late)).toBe(1);
    expect(await sent(salesId, 'follow_up_overdue', notYetLate)).toBe(0);
    expect(await sent(salesId, 'follow_up_due_soon', farOff)).toBe(0);
    expect(await sent(salesId, 'follow_up_due_soon', closed)).toBe(0);
    const row = (await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: salesId, templateCode: 'follow_up_due_soon', createdAt: { gte: started } },
      orderBy: { createdAt: 'desc' },
    })).payload as Record<string, unknown>;
    expect(row).toMatchObject({ entityType: 'lead', customerName: 'FU2 Lead 1', actionAr: 'مكالمة' });
    expect(row.time).toMatch(/^\d{2}:\d{2}$/);

    // Run again: nothing new.
    await testApp.runCronJob('follow-up-reminders');
    expect(await sent(salesId, 'follow_up_due_soon', soon)).toBe(1);
    expect(await sent(salesId, 'follow_up_overdue', late)).toBe(1);

    // Moved to a new time: reminded again.
    await testApp.rawPrisma.lead.update({ where: { id: soon }, data: { nextActionAt: new Date(Date.now() + 12 * MIN) } });
    await testApp.runCronJob('follow-up-reminders');
    expect(await sent(salesId, 'follow_up_due_soon', soon)).toBe(2);
  });

  it('FU2-2: the morning list for the rep, and the team for the manager', async () => {
    await testApp.runCronJob('follow-up-daily');
    const mine = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: salesId, templateCode: 'follow_up_daily', createdAt: { gte: started } },
      orderBy: { createdAt: 'desc' },
    });
    const p = mine.payload as { today: number; overdue: number };
    expect(p.overdue).toBeGreaterThanOrEqual(2);
    expect(p.today + p.overdue).toBeGreaterThanOrEqual(3);
    const team = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: managerId, templateCode: 'follow_up_team_daily', createdAt: { gte: started } },
      orderBy: { createdAt: 'desc' },
    });
    const t = team.payload as { today: number; overdue: number; lateReps: number };
    expect(t.overdue).toBeGreaterThanOrEqual(p.overdue);
    expect(t.lateReps).toBeGreaterThanOrEqual(1);
  });

  it('FU2-3: the leads list carries the latest activity, for the customer page', async () => {
    const leadId = leadIds[0]!;
    await request(testApp.app.getHttpServer())
      .post(`/v1/leads/${leadId}/notes`)
      .set('Authorization', bearer(salesToken))
      .send({ body: 'رد وطلب يتصل بعد يومين', kind: 'CALL', callResult: 'ANSWERED' })
      .expect(201);
    const clientId = clientIds[0]!;
    const list = (await http().get(`/v1/leads?clientId=${clientId}`).set('Authorization', bearer(salesToken)).expect(200)).body;
    expect(list.data).toHaveLength(1);
    expect(list.data[0].lastNote).toMatchObject({ kind: 'CALL', callResult: 'ANSWERED', body: 'رد وطلب يتصل بعد يومين' });
    expect(list.data[0].lastNote.by).toBeTruthy();
  });
});
