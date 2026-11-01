/**
 * DUP2 — adding a lead for a customer who already has an open lead says so.
 *
 * - The create is refused with 409 OPEN_LEAD_EXISTS, naming the open lead(s):
 *   stage, owner, date. Nothing is created.
 * - The caller may add anyway (allowDuplicate); the new lead records which
 *   leads it duplicates.
 * - A customer whose leads are all closed (won / lost), or a new customer,
 *   gets the lead with no question.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('DUP2 — open lead warning (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  const stamp = Date.now().toString().slice(-7);
  const clientIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const create = (body: Record<string, unknown>) =>
    http().post('/v1/leads').set('Authorization', bearer(adminToken)).send(body);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { companyId: true } })).companyId!;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const leads = await raw.lead.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } });
    const ids = leads.map((l) => l.id);
    await raw.leadNote.deleteMany({ where: { leadId: { in: ids } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await raw.lead.deleteMany({ where: { id: { in: ids } } });
    await raw.user.deleteMany({ where: { id: { in: clientIds }, role: UserRole.CLIENT } });
  });

  it('DUP2-1: a second open lead is refused with the open one named; add anyway records it', async () => {
    const phone = `+2015${stamp}1`;
    const first = (await create({ fullName: 'DUP2 Customer', phone, assignedSalesId: fixtures.userIds.salesId }).expect(201)).body;
    const lead = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: first.id }, select: { clientId: true } });
    clientIds.push(lead.clientId);

    // By phone and by the client picker alike.
    for (const body of [{ fullName: 'DUP2 Customer', phone }, { clientId: lead.clientId }]) {
      const refused = await create(body).expect(409);
      expect(refused.body).toMatchObject({ code: 'OPEN_LEAD_EXISTS' });
      expect(refused.body.leads).toEqual([
        expect.objectContaining({ id: first.id, stage: 'NEW', assignedSales: expect.objectContaining({ id: fixtures.userIds.salesId }) }),
      ]);
    }
    expect(await testApp.rawPrisma.lead.count({ where: { clientId: lead.clientId } })).toBe(1);

    const second = (await create({ clientId: lead.clientId, allowDuplicate: true }).expect(201)).body;
    const created = await testApp.rawPrisma.leadActivity.findFirstOrThrow({ where: { leadId: second.id, type: 'created' } });
    expect(created.payload).toEqual({ duplicateOf: [first.id] });
  });

  it('DUP2-2: no question for a new customer, or one whose leads are all closed', async () => {
    const phone = `+2015${stamp}2`;
    const first = (await create({ fullName: 'DUP2 Closed', phone }).expect(201)).body;
    const lead = await testApp.rawPrisma.lead.update({ where: { id: first.id }, data: { stage: LeadStage.LOST }, select: { clientId: true } });
    clientIds.push(lead.clientId);
    const again = (await create({ clientId: lead.clientId }).expect(201)).body;
    const created = await testApp.rawPrisma.leadActivity.findFirstOrThrow({ where: { leadId: again.id, type: 'created' } });
    expect(created.payload).toEqual({});
  });
});
