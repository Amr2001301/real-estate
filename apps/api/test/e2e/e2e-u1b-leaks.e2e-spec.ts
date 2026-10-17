/**
 * U1b — what customers and broker agents may see.
 *
 * - GET /me/contracts carries no broker firm, broker-agent contact or locked
 *   commission (it reused the staff list).
 * - The broker portal never shows the company's own counts; money only to
 *   agents with canViewCommissions (performance, firm terms, project rates);
 *   an agent who is not a manager sees their own rows and no firm payouts.
 * - canViewCommissions is granted by the company, never from the portal.
 * - A project grant outside its startsAt / endsAt window gives no access.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('U1b — customer & broker data leaks (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let brokerToken: string;
  let brokerId: string;
  let brokerUser: { id: string; isPrimaryContact: boolean; canManageBrokerUsers: boolean; canViewCommissions: boolean };
  const createdUserIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asBroker = <T extends request.Test>(r: T) => r.set('Authorization', bearer(brokerToken));
  const setFlags = (data: Partial<typeof brokerUser>) =>
    testApp.rawPrisma.brokerUser.update({ where: { id: brokerUser.id }, data });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    brokerToken = await loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password);
    brokerId = (await testApp.rawPrisma.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 }, select: { id: true } })).id;
    brokerUser = await testApp.rawPrisma.brokerUser.findFirstOrThrow({
      where: { userId: fixtures.userIds.broker1UserId, brokerId },
      select: { id: true, isPrimaryContact: true, canManageBrokerUsers: true, canViewCommissions: true },
    });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await setFlags({
      isPrimaryContact: brokerUser.isPrimaryContact,
      canManageBrokerUsers: brokerUser.canManageBrokerUsers,
      canViewCommissions: brokerUser.canViewCommissions,
    });
    await raw.brokerProjectAccess.updateMany({ where: { brokerId, projectId: fixtures.projects.p1Id }, data: { startsAt: null, endsAt: null } });
    await raw.brokerUser.deleteMany({ where: { userId: { in: createdUserIds } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await raw.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('L-1: /contracts/me/contracts shows no broker firm, agent contact or commission', async () => {
    const token = await loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer');
    const res = await http().get('/v1/contracts/me/contracts').set('Authorization', bearer(token)).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const row of res.body.data) {
      expect(row).not.toHaveProperty('broker');
      expect(row).not.toHaveProperty('brokerAgent');
      expect(row).not.toHaveProperty('brokerId');
      expect(row.reservation ?? {}).not.toHaveProperty('commissionLockedPct');
      expect(row.reservation ?? {}).not.toHaveProperty('commissionLockedAmount');
      expect(row).toHaveProperty('unit');
    }
  });

  it('L-2: without canViewCommissions the portal shows no money — and never the company\'s counts', async () => {
    await setFlags({ isPrimaryContact: true, canViewCommissions: false });
    const perf = await asBroker(http().get('/v1/portal/performance')).expect(200);
    expect(perf.body.summary.totalBrokers).toBeNull();
    expect(perf.body.summary.totalBrokerAgents).toBeNull();
    expect(perf.body.summary.commissionsNet).toBeNull();
    expect(perf.body.summary.payoutsTotalNet).toBeNull();
    expect(perf.body.broker.defaultCommissionPct).toBeNull();
    expect(perf.body.recent.commissions).toEqual([]);
    const me = await asBroker(http().get('/v1/portal/me')).expect(200);
    expect(me.body.broker.defaultCommissionPct).toBeNull();
    const projects = await asBroker(http().get('/v1/portal/projects')).expect(200);
    expect(projects.body.length).toBeGreaterThan(0);
    for (const p of projects.body) expect(p.access.commissionPct).toBeNull();

    await setFlags({ canViewCommissions: true });
    const withMoney = await asBroker(http().get('/v1/portal/performance')).expect(200);
    expect(withMoney.body.summary.commissionsNet).not.toBeNull();
    expect(withMoney.body.summary.totalBrokers).toBeNull();
  });

  it('L-3: an agent who is not a manager sees their own rows and no firm payouts', async () => {
    await setFlags({ isPrimaryContact: false, canManageBrokerUsers: false, canViewCommissions: true });
    const perf = await asBroker(http().get('/v1/portal/performance')).expect(200);
    expect(perf.body.canSeeAllAgents).toBe(false);
    for (const a of perf.body.agentBreakdown) expect(a.brokerAgentId).toBe(fixtures.userIds.broker1UserId);
    expect(perf.body.summary.payoutsTotalNet).toBeNull();
    expect(perf.body.recent.payouts).toEqual([]);
    for (const m of perf.body.monthlyTrend) expect(m.payoutsNet).toBeNull();
  });

  it('L-4: a firm manager cannot grant canViewCommissions from the portal', async () => {
    await setFlags({ isPrimaryContact: true, canViewCommissions: true });
    const created = await asBroker(http().post('/v1/portal/team')).send({
      fullName: `U1b Agent ${stamp}`,
      email: `u1b-agent-${stamp}@example.com`,
      password: 'ChangeMe123!',
      canViewCommissions: true,
    });
    expect(created.status).toBe(201);
    createdUserIds.push(created.body.userId ?? created.body.user?.id);
    expect(created.body.canViewCommissions).toBe(false);
    const patched = await asBroker(http().patch(`/v1/portal/team/${created.body.id}`)).send({ canViewCommissions: true });
    expect(patched.status).toBe(200);
    const row = await testApp.rawPrisma.brokerUser.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.canViewCommissions).toBe(false);
  });

  it('L-5: a project grant outside its dates gives no access', async () => {
    await setFlags({ isPrimaryContact: true, canViewCommissions: true });
    const p1 = fixtures.projects.p1Id;
    const listed = async () =>
      ((await asBroker(http().get('/v1/portal/projects')).expect(200)).body as Array<{ project: { id: string } }>).map(
        (g) => g.project.id,
      );
    expect(await listed()).toContain(p1);
    await testApp.rawPrisma.brokerProjectAccess.updateMany({
      where: { brokerId, projectId: p1 },
      data: { endsAt: new Date(Date.now() - 86_400_000) },
    });
    expect(await listed()).not.toContain(p1);
    await testApp.rawPrisma.brokerProjectAccess.updateMany({
      where: { brokerId, projectId: p1 },
      data: { endsAt: null, startsAt: new Date(Date.now() + 86_400_000) },
    });
    expect(await listed()).not.toContain(p1);
  });
});
