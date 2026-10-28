/**
 * MP1 — customers' numbers stay with their reps.
 *
 * - A call / WhatsApp button gets the number when pressed, from a lead the
 *   caller may see; each press is logged on the lead (who, which).
 * - In the website inquiries queue a rep sees full contact details only on
 *   their own leads; the rest are masked. Admins see everything.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MP1 — contact privacy (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let otherRepId: string;
  const stamp = Date.now().toString().slice(-7);
  const clientIds: string[] = [];
  const leadIds: string[] = [];
  const requestIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newLead = async (n: number, assignedSalesId: string) => {
    const raw = testApp.rawPrisma;
    const phone = `+2018${n}${stamp}`;
    const client = await raw.user.create({ data: { companyId, fullName: `MP1 ${n}`, phone, role: UserRole.CLIENT, active: true } });
    clientIds.push(client.id);
    const lead = await raw.lead.create({ data: { companyId, clientId: client.id, fullName: `MP1 ${n}`, phone, assignedSalesId } });
    leadIds.push(lead.id);
    const ask = await raw.infoRequest.create({ data: { companyId, leadId: lead.id, userId: client.id, message: `MP1 ${stamp}` } });
    requestIds.push(ask.id);
    return { leadId: lead.id, phone, requestId: ask.id };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { companyId: true } })).companyId!;
    otherRepId = (await raw.user.create({ data: { companyId, fullName: 'MP1 Other Rep', phone: `+20129${stamp}`, role: UserRole.SALES, active: true } })).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.infoRequest.deleteMany({ where: { id: { in: requestIds } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { id: { in: [...clientIds, otherRepId] } } });
  });

  it('MP1-1: the number is handed over on a press, and the press is logged', async () => {
    const mine = await newLead(1, fixtures.userIds.salesId);
    const theirs = await newLead(2, otherRepId);

    const res = (await as(salesToken, http().post(`/v1/leads/${mine.leadId}/contact`)).send({ kind: 'WHATSAPP' }).expect(200)).body;
    expect(res).toEqual({ phone: mine.phone });
    const logged = await testApp.rawPrisma.leadActivity.findFirstOrThrow({ where: { leadId: mine.leadId, type: 'contact_opened' } });
    expect(logged.payload).toMatchObject({ kind: 'WHATSAPP', byId: fixtures.userIds.salesId });

    // Another rep's lead: not this rep's to call.
    const denied = await as(salesToken, http().post(`/v1/leads/${theirs.leadId}/contact`)).send({ kind: 'CALL' });
    expect([403, 404]).toContain(denied.status);
    await as(salesToken, http().post(`/v1/leads/${mine.leadId}/contact`)).send({ kind: 'SMS' }).expect(400);
    // An admin may call anyone's.
    await as(adminToken, http().post(`/v1/leads/${theirs.leadId}/contact`)).send({ kind: 'CALL' }).expect(200);
  });

  it('MP1-2: in the inquiries queue a rep sees full numbers only on their own leads', async () => {
    const mine = await newLead(3, fixtures.userIds.salesId);
    const theirs = await newLead(4, otherRepId);
    const row = (body: { data: Array<{ id: string; lead: { phone: string } | null; user: { phone: string } | null }> }, id: string) =>
      body.data.find((r) => r.id === id)!;

    const asRep = (await as(salesToken, http().get('/v1/info-requests?pageSize=100')).expect(200)).body;
    expect(row(asRep, mine.requestId).lead!.phone).toBe(mine.phone);
    const masked = row(asRep, theirs.requestId);
    expect(masked.lead!.phone).not.toBe(theirs.phone);
    expect(masked.lead!.phone).toContain('•');
    expect(masked.lead!.phone.slice(-4)).toBe(theirs.phone.slice(-4));
    expect(masked.user!.phone).toContain('•');

    const asAdmin = (await as(adminToken, http().get('/v1/info-requests?pageSize=100')).expect(200)).body;
    expect(row(asAdmin, theirs.requestId).lead!.phone).toBe(theirs.phone);
  });
});
