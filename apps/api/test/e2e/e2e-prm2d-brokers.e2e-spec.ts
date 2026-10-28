/**
 * PRM phase 2d — brokers.
 *
 * - Broker leads and reservations are sales data (rule 2): a rep sees the
 *   ones assigned to / handled by them, a manager their team's, whatever
 *   codes are held. Before, every rep and manager saw every broker lead,
 *   phones included, and a manager every broker reservation.
 * - A broker contract is a contract: own / team, or the whole company with
 *   contracts:read:all.
 * - The admin broker pages (brokers, access, broker users, payouts, reports,
 *   commissions) open by their codes; suspending, approving, paying and
 *   inviting broker users stay with the admin.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2d — brokers: sales data keeps its scope, admin pages open by code (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  let companyId: string;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`))
      .send(remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes })
      .expect(200);
  const total = async (token: string, path: string) =>
    (await as(token, http().get(path)).expect(200)).body.meta.total as number;
  const teamOf = async (managerId: string) => [
    managerId,
    ...(
      await testApp.rawPrisma.user.findMany({
        where: { companyId, role: UserRole.SALES, managerId },
        select: { id: true },
      })
    ).map((u) => u.id),
  ];

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const created = await as(adminToken, http().post('/v1/users'))
      .send({
        role: 'SALES',
        fullName: 'PRM2d Rep',
        email: `prm2d-rep-${stamp}@example.com`,
        password: 'Prm2dRepPass123!',
      })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM2d-1: a rep sees only the broker leads assigned to them; another rep’s is 404', async () => {
    const leadId = fixtures.flowD.broker1ApprovedLeadId;
    expect(await total(repToken, '/v1/broker-leads?pageSize=1')).toBe(0);
    await as(repToken, http().get(`/v1/broker-leads/${leadId}`)).expect(404);

    const salesId = fixtures.userIds.salesId;
    const salesToken = await testApp.signAccessToken(salesId, 'SALES');
    const assigned = await testApp.rawPrisma.lead.count({
      where: { companyId, NOT: { brokerId: null }, assignedSalesId: salesId },
    });
    expect(assigned).toBeGreaterThanOrEqual(1);
    expect(await total(salesToken, '/v1/broker-leads?pageSize=1')).toBe(assigned);
    await as(salesToken, http().get(`/v1/broker-leads/${leadId}`)).expect(200);
    // Asking for another rep's leads gives nothing.
    expect(await total(repToken, `/v1/broker-leads?pageSize=1&assignedSalesId=${salesId}`)).toBe(0);
    // The admin still sees every broker lead, the queue to approve included.
    const all = await testApp.rawPrisma.lead.count({
      where: { companyId, NOT: { brokerId: null } },
    });
    expect(await total(adminToken, '/v1/broker-leads?pageSize=1')).toBe(all);
  });

  it('PRM2d-2: a manager sees their team’s broker leads, reservations and contracts', async () => {
    const managerId = fixtures.userIds.managerId;
    const token = await testApp.signAccessToken(managerId, 'SALES_MANAGER');
    const ids = await teamOf(managerId);
    expect(await total(token, '/v1/broker-leads?pageSize=1')).toBe(
      await testApp.rawPrisma.lead.count({
        where: { companyId, NOT: { brokerId: null }, assignedSalesId: { in: ids } },
      }),
    );
    expect(await total(token, '/v1/broker-reservations?pageSize=1')).toBe(
      await testApp.rawPrisma.reservation.count({
        where: { companyId, NOT: { brokerId: null }, salesId: { in: ids } },
      }),
    );
    expect(await total(token, '/v1/broker-contracts?pageSize=1')).toBe(
      await testApp.rawPrisma.contract.count({
        where: { companyId, NOT: { brokerId: null }, reservation: { salesId: { in: ids } } },
      }),
    );
  });

  it('PRM2d-3: contracts:read:all opens the whole company’s broker contracts, not its leads', async () => {
    await grant(['contracts:read:all']);
    expect(await total(repToken, '/v1/broker-contracts?pageSize=1')).toBe(
      await total(adminToken, '/v1/broker-contracts?pageSize=1'),
    );
    expect(await total(repToken, '/v1/broker-leads?pageSize=1')).toBe(0);
    await grant(['contracts:read:all'], true);
  });

  it('PRM2d-4: the admin broker pages open by their codes; the strict actions stay with the admin', async () => {
    const brokerId = (
      await testApp.rawPrisma.broker.findFirstOrThrow({
        where: { companyId },
        select: { id: true },
      })
    ).id;
    for (const path of [
      '/v1/brokers',
      '/v1/broker-payouts',
      '/v1/broker-reports/summary',
      '/v1/broker-commissions',
    ]) {
      await as(repToken, http().get(path)).expect(403);
    }
    await grant([
      'brokers:read',
      'broker_payouts:read',
      'broker_reports:read',
      'broker_commissions:read',
      'brokers:suspend',
    ]);
    for (const path of [
      '/v1/brokers',
      '/v1/broker-payouts',
      '/v1/broker-reports/summary',
      '/v1/broker-commissions',
    ]) {
      await as(repToken, http().get(path)).expect(200);
    }
    await as(repToken, http().get(`/v1/brokers/${brokerId}`)).expect(200);
    await as(repToken, http().post(`/v1/brokers/${brokerId}/suspend`))
      .send({ reason: 'PRM2d' })
      .expect(403);
    await as(repToken, http().post(`/v1/brokers/${brokerId}/users`))
      .send({ fullName: 'X', email: `x-${stamp}@example.com` })
      .expect(403);

    // A manager is let in to the commissions by the code too.
    const managerToken = await testApp.signAccessToken(fixtures.userIds.managerId, 'SALES_MANAGER');
    await as(managerToken, http().get('/v1/broker-commissions')).expect(403);
    await grant(
      [
        'brokers:read',
        'broker_payouts:read',
        'broker_reports:read',
        'broker_commissions:read',
        'brokers:suspend',
      ],
      true,
    );
  });
});
