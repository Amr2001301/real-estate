/**
 * Contract transfer (تنازل) and unit swap (تبديل).
 *
 * A transfer moves the contract — payments, schedule and booking — to the new
 * customer and cuts the old one off. A swap moves it to another unit: money
 * already paid stays, the unpaid installments absorb the price change, the old
 * unit goes back on sale. Neither runs while a payment is still waiting.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  ContractStatus,
  DepositReviewStatus,
  InstallmentStatus,
  PlanPaymentType,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Contract transfer and unit swap (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let aId: string;
  let bId: string;
  let unit1: { id: string; status: UnitStatus };
  let unit2: { id: string; status: UnitStatus };
  let soldUnitId: string;
  let contractId: string;
  let openIds: string[];
  const stamp = Date.now().toString().slice(-8);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    companyId = admin.companyId!;

    const client = (n: string, role: UserRole) =>
      raw.user.create({
        data: { companyId, role, fullName: `Amend ${n}`, phone: `+2012${n}${stamp}`, locale: 'ar' },
        select: { id: true },
      });
    aId = (await client('1', UserRole.CUSTOMER)).id;
    bId = (await client('2', UserRole.CLIENT)).id;

    const free = await raw.unit.findMany({
      where: {
        companyId,
        status: UnitStatus.AVAILABLE,
        contracts: { none: {} },
        reservations: { none: {} },
      },
      select: { id: true, status: true },
      take: 2,
    });
    expect(free).toHaveLength(2);
    [unit1, unit2] = free as [typeof unit1, typeof unit2];
    soldUnitId = (
      await raw.contract.findFirstOrThrow({
        where: { companyId, deletedAt: null, status: { not: ContractStatus.CANCELLED } },
        select: { unitId: true },
      })
    ).unitId;

    await raw.unit.update({ where: { id: unit1.id }, data: { status: UnitStatus.SOLD } });
    const contract = await raw.contract.create({
      data: {
        companyId,
        customerId: aId,
        unitId: unit1.id,
        totalAmount: 1_000_000,
        status: ContractStatus.ACTIVE,
        signedAt: new Date(),
        contractNumber: `AMD-${stamp}`,
      },
      select: { id: true },
    });
    contractId = contract.id;
    const plan = await raw.installmentPlan.create({
      data: { companyId, contractId, totalMonths: 2, monthlyAmount: 400_000, startsAt: new Date() },
      select: { id: true },
    });
    const row = (amount: number, status: InstallmentStatus, months: number) =>
      raw.installment.create({
        data: {
          companyId,
          planId: plan.id,
          amount,
          status,
          type: PlanPaymentType.INSTALLMENT,
          dueDate: new Date(Date.now() + months * 30 * 86_400_000),
          ...(status === InstallmentStatus.PAID ? { paidAt: new Date() } : {}),
        },
        select: { id: true },
      });
    await row(200_000, InstallmentStatus.PAID, -1);
    openIds = [(await row(400_000, InstallmentStatus.PENDING, 1)).id, (await row(400_000, InstallmentStatus.PENDING, 2)).id];
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.contractAmendment.deleteMany({ where: { contractId } });
    await raw.deposit.deleteMany({ where: { installment: { plan: { contractId } } } });
    await raw.installment.deleteMany({ where: { plan: { contractId } } });
    await raw.installmentPlan.deleteMany({ where: { contractId } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    for (const u of [unit1, unit2]) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: [unit1.id, unit2.id] } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: [aId, bId] } } });
    await raw.notification.deleteMany({ where: { userId: { in: [aId, bId] } } });
    await raw.user.deleteMany({ where: { id: { in: [aId, bId] } } });
  });

  it('CA-1: nothing changes while a payment waits for review', async () => {
    const raw = testApp.rawPrisma;
    const waiting = await raw.deposit.create({
      data: {
        companyId,
        installmentId: openIds[0]!,
        amount: 400_000,
        paidAt: new Date(),
        recordedById: fixtures.userIds.adminId,
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      },
      select: { id: true },
    });
    try {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`)).send({ toCustomerId: bId, reason: 'test' }).expect(409);
      await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
        .send({ unitId: unit2.id, totalAmount: 1_100_000, reason: 'test' })
        .expect(409);
    } finally {
      await raw.deposit.delete({ where: { id: waiting.id } });
    }
  });

  it('CA-2: transfer moves the contract to the new customer and cuts the old one off', async () => {
    await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`)).send({ toCustomerId: aId, reason: 'same' }).expect(400);

    const res = await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`)).send({ toCustomerId: bId, reason: 'تنازل رسمي' });
    expect(res.status).toBe(201);
    const raw = testApp.rawPrisma;
    expect((await raw.contract.findUniqueOrThrow({ where: { id: contractId } })).customerId).toBe(bId);
    // The new owner gets the customer app; the old one, with nothing left, loses it.
    expect((await raw.user.findUniqueOrThrow({ where: { id: bId } })).role).toBe(UserRole.CUSTOMER);
    expect((await raw.user.findUniqueOrThrow({ where: { id: aId } })).role).toBe(UserRole.CLIENT);

    const bToken = await testApp.signAccessToken(bId, 'CUSTOMER');
    const mine = await http().get('/v1/me/installments').set('Authorization', bearer(bToken));
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).toContain(contractId);
  });

  it('CA-3: a swap onto a sold unit, or below what was paid, is refused', async () => {
    await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
      .send({ unitId: soldUnitId, totalAmount: 1_000_000, reason: 'test' })
      .expect(409);
    await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
      .send({ unitId: unit2.id, totalAmount: 150_000, reason: 'test' })
      .expect(400);
    const raw = testApp.rawPrisma;
    expect((await raw.contract.findUniqueOrThrow({ where: { id: contractId } })).unitId).toBe(unit1.id);
    expect((await raw.unit.findUniqueOrThrow({ where: { id: unit2.id } })).status).toBe(UnitStatus.AVAILABLE);
  });

  it('CA-4: a swap moves the contract, rescales the unpaid rows and frees the old unit', async () => {
    const res = await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`)).send({
      unitId: unit2.id,
      totalAmount: 1_100_000,
      reason: 'العميل طلب دور أعلى',
    });
    expect(res.status).toBe(201);
    const raw = testApp.rawPrisma;
    const contract = await raw.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect(contract.unitId).toBe(unit2.id);
    expect(Number(contract.totalAmount)).toBe(1_100_000);

    const rows = await raw.installment.findMany({ where: { plan: { contractId } }, orderBy: { dueDate: 'asc' } });
    expect(rows.map((r) => [r.status, Number(r.amount)])).toEqual([
      [InstallmentStatus.PAID, 200_000],
      [InstallmentStatus.PENDING, 450_000],
      [InstallmentStatus.PENDING, 450_000],
    ]);
    expect((await raw.unit.findUniqueOrThrow({ where: { id: unit1.id } })).status).toBe(UnitStatus.AVAILABLE);
    expect((await raw.unit.findUniqueOrThrow({ where: { id: unit2.id } })).status).toBe(UnitStatus.SOLD);

    const history = await asAdmin(http().get(`/v1/contracts/${contractId}/amendments`)).expect(200);
    expect(history.body.map((a: { type: string }) => a.type)).toEqual(['UNIT_SWAP', 'TRANSFER']);
  });
});
