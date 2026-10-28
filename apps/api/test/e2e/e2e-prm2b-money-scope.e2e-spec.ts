/**
 * PRM phase 2b — contracts and their payments: own records, or the whole
 * company with a «whole company» code (owner's decision, 2026-10-28).
 *
 * - A rep sees the contracts and payments of their own sales (the
 *   reservation's salesId), a manager their own and their team's. Another
 *   rep's contract, statement or plan is 404.
 * - contracts:read:all / deposits:read:all open the whole company's, as the
 *   admin sees them. They are in no role's starting set.
 * - Approving a payment stays with the admin.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ReservationStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2b — contracts and payments: own, or the whole company (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  let companyId: string;
  let saleReservationId: string;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`))
      .send(remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes })
      .expect(200);
  const total = async (token: string, path: string) =>
    (await as(token, http().get(path)).expect(200)).body.meta.total as number;

  const ownedContracts = (salesIds: string[]) =>
    testApp.rawPrisma.contract.count({
      where: { companyId: companyId, deletedAt: null, reservation: { salesId: { in: salesIds } } },
    });
  const ownedDeposits = (salesIds: string[]) =>
    testApp.rawPrisma.deposit.count({
      where: {
        companyId: companyId,
        deletedAt: null,
        OR: [
          { contract: { reservation: { salesId: { in: salesIds } } } },
          { reservation: { salesId: { in: salesIds } } },
        ],
      },
    });

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
        fullName: 'PRM2b Rep',
        email: `prm2b-rep-${stamp}@example.com`,
        password: 'Prm2bRepPass123!',
      })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');

    // The seeded contracts have no reservation (no rep). Make customer1's —
    // the one with a payment — a sale by sales@ for this file; put it back after.
    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
      where: { id: fixtures.flowE.customer1ContractId },
      select: { unitId: true, customerId: true },
    });
    saleReservationId = (
      await testApp.rawPrisma.reservation.create({
        data: {
          companyId,
          unitId: contract.unitId,
          salesId: fixtures.userIds.salesId,
          clientId: contract.customerId,
          status: ReservationStatus.CONVERTED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `PRM2B-${stamp}`,
          bookingAmount: 0,
        },
        select: { id: true },
      })
    ).id;
    await testApp.rawPrisma.contract.update({
      where: { id: fixtures.flowE.customer1ContractId },
      data: { reservationId: saleReservationId },
    });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.contract.update({
      where: { id: fixtures.flowE.customer1ContractId },
      data: { reservationId: null },
    });
    await raw.reservation.deleteMany({ where: { id: saleReservationId } });
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM2b-1: a rep with no sales sees no contracts or payments; another rep’s contract is 404', async () => {
    const mine = (await as(repToken, http().get('/v1/me/permissions')).expect(200)).body
      .codes as string[];
    expect(mine).toEqual(expect.arrayContaining(['contracts:read', 'deposits:read']));
    expect(mine).not.toContain('contracts:read:all');
    expect(mine).not.toContain('deposits:read:all');

    expect(await total(repToken, '/v1/contracts?pageSize=1')).toBe(0);
    expect(await total(repToken, '/v1/deposits?pageSize=1')).toBe(0);
    const contractId = fixtures.flowE.customer1ContractId;
    await as(repToken, http().get(`/v1/contracts/${contractId}`)).expect(404);
    await as(repToken, http().get(`/v1/contracts/${contractId}/statement`)).expect(404);
    await as(repToken, http().get(`/v1/contracts/${contractId}/installment-plan`)).expect(404);
  });

  it('PRM2b-2: the rep who made a sale sees its contract and payments — only theirs', async () => {
    const salesId = fixtures.userIds.salesId;
    const token = await testApp.signAccessToken(salesId, 'SALES');
    const contractId = fixtures.flowE.customer1ContractId;
    expect(await ownedContracts([salesId])).toBeGreaterThanOrEqual(1);
    expect(await ownedDeposits([salesId])).toBeGreaterThanOrEqual(1);
    expect(await total(token, '/v1/contracts?pageSize=1')).toBe(await ownedContracts([salesId]));
    expect(await total(token, '/v1/deposits?pageSize=1')).toBe(await ownedDeposits([salesId]));
    await as(token, http().get(`/v1/contracts/${contractId}`)).expect(200);
    await as(token, http().get(`/v1/contracts/${contractId}/statement`)).expect(200);
    await as(token, http().get(`/v1/contracts/${contractId}/installment-plan`)).expect(200);
    // A contract with no rep behind it is not theirs.
    await as(token, http().get(`/v1/contracts/${fixtures.flowE.customer2ContractId}`)).expect(404);
  });

  it('PRM2b-3: a manager sees their own and their team’s sales', async () => {
    const managerId = fixtures.userIds.managerId;
    const token = await testApp.signAccessToken(managerId, 'SALES_MANAGER');
    const team = await testApp.rawPrisma.user.findMany({
      where: { companyId, role: UserRole.SALES, managerId },
      select: { id: true },
    });
    const ids = [managerId, ...team.map((u) => u.id)];
    expect(await total(token, '/v1/contracts?pageSize=1')).toBe(await ownedContracts(ids));
    expect(await total(token, '/v1/deposits?pageSize=1')).toBe(await ownedDeposits(ids));
    expect(await total(token, '/v1/deposits/review-queue?pageSize=1')).toBeLessThanOrEqual(
      await ownedDeposits(ids),
    );
  });

  it('PRM2b-4: the «whole company» codes open the admin’s view, one at a time', async () => {
    const contractId = fixtures.flowE.customer1ContractId;
    const depositId = fixtures.flowE.customer1DepositId;

    await grant(['contracts:read:all']);
    expect(await total(repToken, '/v1/contracts?pageSize=1')).toBe(
      await total(adminToken, '/v1/contracts?pageSize=1'),
    );
    await as(repToken, http().get(`/v1/contracts/${contractId}`)).expect(200);
    await as(repToken, http().get(`/v1/contracts/${contractId}/installment-plan`)).expect(200);
    // Payments are their own code.
    expect(await total(repToken, '/v1/deposits?pageSize=1')).toBe(0);
    await as(repToken, http().get(`/v1/deposits/${depositId}`)).expect(403);

    await grant(['deposits:read:all']);
    expect(await total(repToken, '/v1/deposits?pageSize=1')).toBe(
      await total(adminToken, '/v1/deposits?pageSize=1'),
    );
    await as(repToken, http().get(`/v1/deposits/${depositId}`)).expect(200);
    await as(repToken, http().get('/v1/deposits/review-queue?pageSize=1')).expect(200);
    // Approving a payment stays with the admin.
    await as(repToken, http().post(`/v1/deposits/${depositId}/approve`))
      .send({})
      .expect(403);

    await grant(['contracts:read:all', 'deposits:read:all'], true);
    expect(await total(repToken, '/v1/contracts?pageSize=1')).toBe(0);
  });

  it('PRM2b-5: the admin still sees everything', async () => {
    const all = await testApp.rawPrisma.contract.count({
      where: { companyId: companyId, deletedAt: null },
    });
    expect(await total(adminToken, '/v1/contracts?pageSize=1')).toBe(all);
  });
});
