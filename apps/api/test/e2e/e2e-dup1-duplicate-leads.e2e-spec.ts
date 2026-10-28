/**
 * DUP1 — the same customer with more than one open lead.
 *
 * - The duplicates list groups a customer's open leads; admins and sales
 *   managers see it, reps do not.
 * - Merging keeps one lead: the others' notes and activity move to it, its
 *   blanks are filled from them (the campaign among them), it takes the
 *   furthest stage, and the others are removed. A lead with a broker's
 *   credit (or a reservation) is never merged away.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('DUP1 — duplicate leads (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let clientId: string;
  let campaignId: string;
  const stamp = Date.now().toString().slice(-7);
  const leadIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newLead = async (data: Record<string, unknown>) => {
    const lead = await testApp.rawPrisma.lead.create({
      data: { companyId, clientId, fullName: `DUP1 ${stamp}`, phone: `+2019${stamp}1`, ...data },
    });
    leadIds.push(lead.id);
    return lead.id;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } })).companyId!;
    clientId = (await raw.user.create({ data: { companyId, fullName: `DUP1 ${stamp}`, phone: `+2019${stamp}1`, role: UserRole.CLIENT, active: true } })).id;
    campaignId = (await raw.campaign.create({ data: { companyId, name: `DUP1 ${stamp}`, code: `dup1-${stamp}`, channel: 'FACEBOOK' } })).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.campaign.deleteMany({ where: { id: campaignId } });
    await raw.user.deleteMany({ where: { id: clientId } });
  });

  it('DUP1-1: a customer’s open leads are listed together; reps do not see the list', async () => {
    const a = await newLead({ assignedSalesId: fixtures.userIds.salesId, stage: LeadStage.NEW });
    const b = await newLead({ stage: LeadStage.NEGOTIATION, campaignId });
    const broker = await testApp.rawPrisma.broker.findFirst({ where: { companyId }, select: { id: true } });
    const c = broker ? await newLead({ stage: LeadStage.INTERESTED, brokerId: broker.id }) : null;
    // A lost lead of the same customer is not a duplicate.
    await newLead({ stage: LeadStage.LOST });

    const body = (await as(adminToken, http().get('/v1/leads/duplicates')).expect(200)).body;
    const group = body.groups.find((g: { client: { id: string } }) => g.client.id === clientId);
    expect(group.leads.map((l: { id: string }) => l.id).sort()).toEqual([a, b, ...(c ? [c] : [])].sort());
    if (c) expect(group.leads.find((l: { id: string }) => l.id === c).mergeable).toBe(false);
    expect(group.leads.find((l: { id: string }) => l.id === b).mergeable).toBe(true);

    await as(salesToken, http().get('/v1/leads/duplicates')).expect(403);
  });

  it('DUP1-2: merging keeps one lead, moves the rest onto it and removes them', async () => {
    const [a, b, c] = leadIds as [string, string, string | undefined];
    await testApp.rawPrisma.leadNote.create({ data: { companyId, leadId: b, salesId: fixtures.userIds.adminId, body: `DUP1 note ${stamp}` } });

    if (c) {
      await as(adminToken, http().post(`/v1/leads/${a}/merge`)).send({ duplicateIds: [c] }).expect(400);
    }
    await as(salesToken, http().post(`/v1/leads/${a}/merge`)).send({ duplicateIds: [b] }).expect(403);
    await as(adminToken, http().post(`/v1/leads/${a}/merge`)).send({ duplicateIds: [b] }).expect(200);

    const raw = testApp.rawPrisma;
    expect(await raw.lead.count({ where: { id: b } })).toBe(0);
    const kept = await raw.lead.findUniqueOrThrow({ where: { id: a } });
    expect(kept).toMatchObject({ campaignId, stage: LeadStage.NEGOTIATION, assignedSalesId: fixtures.userIds.salesId });
    expect(await raw.leadNote.count({ where: { leadId: a, body: `DUP1 note ${stamp}` } })).toBe(1);
    const merged = await raw.leadActivity.findFirstOrThrow({ where: { leadId: a, type: 'merged' } });
    expect(merged.payload).toMatchObject({ count: 1, mergedIds: [b], byId: fixtures.userIds.adminId });
    leadIds.splice(leadIds.indexOf(b), 1);

    // Another customer's lead cannot be folded in.
    const otherClient = await raw.user.create({ data: { companyId, fullName: 'DUP1 X', phone: `+2019${stamp}2`, role: UserRole.CLIENT, active: true } });
    const other = (await raw.lead.create({ data: { companyId, clientId: otherClient.id, fullName: 'DUP1 X', phone: `+2019${stamp}2` } })).id;
    await as(adminToken, http().post(`/v1/leads/${a}/merge`)).send({ duplicateIds: [other] }).expect(400);
    await raw.lead.delete({ where: { id: other } });
    await raw.user.delete({ where: { id: otherClient.id } });
  });
});
