/**
 * MC2 — leads that arrive on their own.
 *
 * - The admin makes intake keys (the key is shown once; only a hash is kept)
 *   for a source to post leads to POST /v1/intake/:slug/leads.
 * - A posted lead is filed under the key's (or the post's) campaign and
 *   project, handed to the sales reps in turn and given a first call.
 * - The same person again stays on their open lead, noted as returned.
 * - Wrong, switched-off or missing keys are refused; another company's slug
 *   never reaches this company.
 * - Website leads are handed out the same way.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MC2 — automatic lead intake (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let slug: string;
  let campaignId: string;
  let repId: string;
  let key: string;
  let keyId: string;
  const stamp = Date.now().toString().slice(-7);
  const phones: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const phone = (n: number) => {
    const p = `+2011${n}${stamp}`;
    phones.push(p);
    return p;
  };
  const post = (body: Record<string, unknown>, k: string | null = key, s = slug) => {
    const r = http().post(`/v1/intake/${s}/leads`);
    return (k ? r.set('X-Intake-Key', k) : r).send(body);
  };
  const lead = (p: string) => testApp.rawPrisma.lead.findFirstOrThrow({ where: { phone: p } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { company: { select: { id: true, slug: true } } } });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    // A second rep, so turns can be seen.
    repId = (await raw.user.create({ data: { companyId, fullName: 'MC2 Rep', phone: `+20128${stamp}`, role: UserRole.SALES, active: true } })).id;
    campaignId = (await raw.campaign.create({ data: { companyId, name: `MC2 ${stamp}`, code: `mc2-${stamp}`, channel: 'FACEBOOK', projectId: fixtures.projects.p1Id } })).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const leads = await raw.lead.findMany({ where: { phone: { in: phones } }, select: { id: true, clientId: true } });
    const ids = leads.map((l) => l.id);
    await raw.infoRequest.deleteMany({ where: { leadId: { in: ids } } });
    await raw.leadNote.deleteMany({ where: { leadId: { in: ids } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await raw.lead.deleteMany({ where: { id: { in: ids } } });
    await raw.user.deleteMany({ where: { id: { in: leads.map((l) => l.clientId) }, role: UserRole.CLIENT } });
    await raw.leadIntakeKey.deleteMany({ where: { companyId, name: { startsWith: 'MC2' } } });
    await raw.campaign.deleteMany({ where: { id: campaignId } });
    await raw.setting.deleteMany({ where: { companyId, key: { in: ['leads.autoAssign', 'leads.firstCallMinutes'] } } });
    await raw.user.delete({ where: { id: repId } });
  });

  it('MC2-1: the admin makes a key, shown once; reps cannot', async () => {
    const res = (await as(adminToken, http().post('/v1/lead-intake/keys')).send({ name: 'MC2 Zapier', campaignId }).expect(201)).body;
    expect(res.key).toMatch(/^lk_/);
    key = res.key;
    keyId = res.id;
    const list = (await as(adminToken, http().get('/v1/lead-intake/keys')).expect(200)).body as Array<Record<string, unknown>>;
    const row = list.find((k) => k.id === keyId)!;
    expect(row.tokenPrefix).toBe(key.slice(0, 9));
    expect(JSON.stringify(list)).not.toContain(key);
    await as(salesToken, http().post('/v1/lead-intake/keys')).send({ name: 'x' }).expect(403);
    await as(salesToken, http().get('/v1/lead-intake/keys')).expect(403);
  });

  it('MC2-2: a posted lead is filed under the key’s campaign, handed out in turn, with a first call', async () => {
    const before = Date.now();
    const a = await post({ name: 'MC2 One', phone: phone(1), message: 'أريد شقة 3 غرف' }).expect(200);
    expect(a.body.status).toBe('created');
    const l1 = await lead(phones[0]!);
    expect(l1).toMatchObject({ campaignId, projectInterestId: fixtures.projects.p1Id, nextActionType: 'CALL' });
    expect(l1.assignedSalesId).not.toBeNull();
    const due = l1.nextActionAt!.getTime() - before;
    expect(due).toBeGreaterThan(55 * 60_000);
    expect(due).toBeLessThan(65 * 60_000);

    // The next one goes to someone else.
    await post({ name: 'MC2 Two', phone: phone(2) }).expect(200);
    const l2 = await lead(phones[1]!);
    expect(l2.assignedSalesId).not.toBeNull();
    expect(l2.assignedSalesId).not.toBe(l1.assignedSalesId);
  });

  it('MC2-3: the same person again stays on their lead; bad keys and slugs are refused', async () => {
    const again = await post({ name: 'MC2 One', phone: phones[0]!.replace('+20', '0') }).expect(200);
    expect(again.body.status).toBe('existing');
    const l1 = await lead(phones[0]!);
    expect(await testApp.rawPrisma.lead.count({ where: { phone: phones[0]! } })).toBe(1);
    expect(await testApp.rawPrisma.leadActivity.count({ where: { leadId: l1.id, type: 'returned' } })).toBe(1);

    await post({ name: 'MC2 X', phone: phone(3) }, null).expect(401);
    await post({ name: 'MC2 X', phone: phones[2]! }, 'lk_wrong').expect(401);
    await post({ name: 'MC2 X', phone: phones[2]! }, key, `nope-${stamp}`).expect(404);
    await post({ name: 'MC2 X', phone: 'abc' }).expect(400);
    await post({ name: 'MC2 X', phone: phones[2]!, extra: 1 }).expect(400);

    await as(adminToken, http().patch(`/v1/lead-intake/keys/${keyId}`)).send({ active: false }).expect(200);
    await post({ name: 'MC2 X', phone: phones[2]! }).expect(401);
    await as(adminToken, http().patch(`/v1/lead-intake/keys/${keyId}`)).send({ active: true }).expect(200);

    // A new key for the same source: the old one stops working.
    const rotated = (await as(adminToken, http().post(`/v1/lead-intake/keys/${keyId}/rotate`)).expect(201)).body;
    await post({ name: 'MC2 X', phone: phones[2]! }).expect(401);
    key = rotated.key;
    await post({ name: 'MC2 Three', phone: phones[2]! }).expect(200);
  });

  it('MC2-4: with turns off and no first call, leads wait for a manager', async () => {
    await as(adminToken, http().put('/v1/lead-intake/settings')).send({ autoAssign: 'NONE', firstCallMinutes: 0 }).expect(200);
    const s = (await as(adminToken, http().get('/v1/lead-intake/settings')).expect(200)).body;
    expect(s).toEqual({ autoAssign: 'NONE', firstCallMinutes: 0, companySlug: slug });
    await post({ name: 'MC2 Four', phone: phone(4) }).expect(200);
    const l4 = await lead(phones[3]!);
    expect(l4.assignedSalesId).toBeNull();
    expect(l4.nextActionAt).toBeNull();
    await as(adminToken, http().put('/v1/lead-intake/settings')).send({ autoAssign: 'ROUND_ROBIN', firstCallMinutes: 30 }).expect(200);
  });

  it('MC2-5: a website lead is handed out in turn too', async () => {
    const p = phone(5);
    await http().post('/v1/public/info-request').send({ message: 'أريد تفاصيل', name: 'MC2 Web', phone: p }).expect(201);
    const l = await lead(p);
    expect(l.assignedSalesId).not.toBeNull();
    expect(l.nextActionType).toBe('CALL');
  });
});
