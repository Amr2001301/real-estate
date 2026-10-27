/**
 * MC3 — campaign reports.
 *
 * - Each campaign shows what was spent in the period, the leads it brought,
 *   the sales (signed, live contracts) and their revenue, with cost per lead,
 *   cost per sale, return on spend and conversion.
 * - A sale goes to the campaign of the buyer's first campaign lead (first
 *   touch); a cancelled contract, or a lead that came after the signing,
 *   brings nothing.
 * - Filters by period, channel and project; channel and project comparisons;
 *   an Excel copy. Admins and sales managers read it; reps do not.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const HOUR = 60 * 60 * 1000;
const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

describe('MC3 — campaign reports (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let managerToken: string;
  let companyId: string;
  let a: string;
  let b: string;
  let units: Array<{ id: string; status: UnitStatus }>;
  const stamp = Date.now().toString().slice(-7);
  const today = cairoToday();
  const clientIds: string[] = [];
  const leadIds: string[] = [];
  const contractIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const report = async (query: Record<string, string>, token = adminToken) =>
    (await as(token, http().get('/v1/campaigns/report').query(query)).expect(200)).body;
  const row = (r: { campaigns: Array<{ id: string }> }, id: string) => r.campaigns.find((c) => c.id === id) as Record<string, unknown> | undefined;

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
    a = (await raw.campaign.create({ data: { companyId, name: `MC3 A ${stamp}`, code: `mc3-a-${stamp}`, channel: 'FACEBOOK', projectId: fixtures.projects.p1Id } })).id;
    b = (await raw.campaign.create({ data: { companyId, name: `MC3 B ${stamp}`, code: `mc3-b-${stamp}`, channel: 'GOOGLE' } })).id;
    await raw.campaignSpend.createMany({
      data: [
        { companyId, campaignId: a, amount: 2000, spentOn: new Date(`${today}T00:00:00.000Z`) },
        { companyId, campaignId: a, amount: 500, spentOn: new Date('2020-01-15T00:00:00.000Z') },
        { companyId, campaignId: b, amount: 1000, spentOn: new Date(`${today}T00:00:00.000Z`) },
      ],
    });

    const client = async (n: number) => {
      const c = await raw.user.create({ data: { companyId, fullName: `MC3 Client ${n}`, phone: `+2013${n}${stamp}`, role: UserRole.CLIENT, active: true } });
      clientIds.push(c.id);
      return c.id;
    };
    const lead = async (clientId: string, campaignId: string, agoHours: number) => {
      const l = await raw.lead.create({
        data: { companyId, clientId, fullName: 'MC3', phone: `+2014${leadIds.length}${stamp}`, campaignId, createdAt: new Date(Date.now() - agoHours * HOUR) },
      });
      leadIds.push(l.id);
    };
    const [c1, c2, c3, c4] = [await client(1), await client(2), await client(3), await client(4)];
    await lead(c1, a, 3); // c1: from A
    await lead(c2, a, 3); // c2: first from A…
    await lead(c2, b, 2); // …then from B — the sale stays A's
    await lead(c3, b, 2); // c3: from B, but the contract is cancelled
    await lead(c4, b, 0); // c4: from B only after signing yesterday

    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 4,
    });
    expect(units).toHaveLength(4);
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.SOLD } });
    const contract = async (i: number, customerId: string, totalAmount: number, status: ContractStatus, signedAt: Date) => {
      const c = await raw.contract.create({
        data: { companyId, customerId, unitId: units[i]!.id, totalAmount, status, signedAt, contractNumber: `MC3-${i}-${stamp}` },
      });
      contractIds.push(c.id);
    };
    await contract(0, c1, 100_000, ContractStatus.ACTIVE, new Date());
    await contract(1, c2, 50_000, ContractStatus.ACTIVE, new Date());
    await contract(2, c3, 70_000, ContractStatus.CANCELLED, new Date());
    await contract(3, c4, 40_000, ContractStatus.ACTIVE, new Date(Date.now() - 24 * HOUR));
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.AVAILABLE } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { id: { in: clientIds }, role: UserRole.CLIENT } });
    await raw.campaignSpend.deleteMany({ where: { campaignId: { in: [a, b] } } });
    await raw.campaign.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it('MC3-1: each campaign shows its spend, leads, sales and return for the period, credited to the first touch', async () => {
    const r = await report({ from: today, to: today });
    expect(row(r, a)).toMatchObject({ spend: 2000, leads: 2, sales: 2, revenue: 150_000, cpl: 1000, cpa: 1000, roi: 7400, conversion: 100 });
    // The cancelled contract and the lead after the signing bring B nothing.
    expect(row(r, b)).toMatchObject({ spend: 1000, leads: 3, sales: 0, revenue: 0, cpl: 333.33, cpa: null, roi: -100 });
    expect(r.totals.spend).toBeGreaterThanOrEqual(3000);
    expect(r.totals.sales).toBeGreaterThanOrEqual(2);
    const facebook = r.byChannel.find((c: { channel: string }) => c.channel === 'FACEBOOK');
    expect(facebook.revenue).toBeGreaterThanOrEqual(150_000);
    expect(r.byProject.find((p: { projectId: string | null }) => p.projectId === fixtures.projects.p1Id)).toBeTruthy();
    expect(r.trend.find((m: { month: string }) => m.month === today.slice(0, 7))).toBeTruthy();

    // All time: A's older spend too; c4's sale stays uncredited.
    const all = await report({});
    expect(row(all, a)).toMatchObject({ spend: 2500, sales: 2 });
    expect(row(all, b)).toMatchObject({ sales: 0 });
    // A period before any of it.
    const old = await report({ from: '2020-01-01', to: '2020-01-31' });
    expect(row(old, a)).toMatchObject({ spend: 500, leads: 0, sales: 0 });
  });

  it('MC3-2: filters by channel and project; managers read it, reps do not; Excel copy', async () => {
    const google = await report({ from: today, to: today, channel: 'GOOGLE' });
    expect(row(google, b)).toBeTruthy();
    expect(row(google, a)).toBeUndefined();
    const p1 = await report({ from: today, to: today, projectId: fixtures.projects.p1Id }, managerToken);
    expect(row(p1, a)).toBeTruthy();
    expect(row(p1, b)).toBeUndefined();

    await as(salesToken, http().get('/v1/campaigns/report')).expect(403);
    await as(adminToken, http().get('/v1/campaigns/report').query({ from: `${today}T00:00` })).expect(400);
    await as(adminToken, http().get('/v1/campaigns/report').query({ channel: 'constructor' })).expect(400);

    const xlsx = await as(adminToken, http().get('/v1/campaigns/report/export.xlsx').query({ from: today, to: today }))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    await as(salesToken, http().get('/v1/campaigns/report/export.xlsx')).expect(403);
  });
});
