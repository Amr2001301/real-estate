/**
 * U4b — collected as two figures, overdue as the sweep sees it, sales by signing.
 *
 * - The financial dashboard and the admin summary return collected towards the
 *   price and fees & penalties apart; a fee payment is not money towards the
 *   price (decision 2).
 * - Computed overdue and its aging leave out a row whose payment is on its way.
 * - A sale counts on its signing date; an unsigned contract is not a sale.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  ContractStatus,
  DepositReviewStatus,
  DepositType,
  InstallmentStatus,
  PlanPaymentType,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 86_400_000;
const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

describe('U4b — collected figures, overdue, sales by signing (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let units: Array<{ id: string; status: UnitStatus }>;
  let contractId: string;
  let planId: string;
  const contractIds: string[] = [];
  const stamp = Date.now().toString().slice(-8);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const dashboard = async () => (await asAdmin(http().get('/v1/reports/financial-dashboard')).expect(200)).body;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U4b Customer', phone: `+2021${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 2,
    });
    expect(units).toHaveLength(2);
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: units[0]!.id, totalAmount: 100_000, status: ContractStatus.ACTIVE,
          signedAt: new Date(), createdAt: new Date(Date.now() - 400 * DAY), contractNumber: `U4B-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
    contractIds.push(contractId);
    planId = (
      await raw.installmentPlan.create({
        data: { companyId, contractId, totalMonths: 2, monthlyAmount: 1000, startsAt: new Date() },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.installment.deleteMany({ where: { planId, feeForId: { not: null } } });
    await raw.installment.deleteMany({ where: { planId } });
    await raw.installmentPlan.deleteMany({ where: { id: planId } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('C-1: a fee payment is fees & penalties, not money towards the price', async () => {
    const raw = testApp.rawPrisma;
    const before = await dashboard();
    const late = await raw.installment.create({
      data: { companyId, planId, amount: 1000, status: InstallmentStatus.PAID, type: PlanPaymentType.INSTALLMENT, dueDate: new Date(), paidAt: new Date() },
      select: { id: true },
    });
    const fee = await raw.installment.create({
      data: {
        companyId, planId, amount: 50, status: InstallmentStatus.PAID, type: PlanPaymentType.LATE_FEE, feeForId: late.id,
        dueDate: new Date(), paidAt: new Date(),
      },
      select: { id: true },
    });
    await raw.deposit.create({
      data: { companyId, contractId, installmentId: late.id, type: DepositType.INSTALLMENT, amount: 1000, paidAt: new Date(), recordedById: fixtures.userIds.adminId },
    });
    await raw.deposit.create({
      data: { companyId, contractId, installmentId: fee.id, type: DepositType.FEE, amount: 50, paidAt: new Date(), recordedById: fixtures.userIds.adminId },
    });
    const after = await dashboard();
    expect(Number(after.summary.collectedTowardsPrice) - Number(before.summary.collectedTowardsPrice)).toBe(1000);
    expect(Number(after.summary.feesCollected) - Number(before.summary.feesCollected)).toBe(50);

    const admin = (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.financial;
    expect(admin.feesCollected).toBeGreaterThanOrEqual(50);
  });

  it('C-2: computed overdue and its aging leave out a row whose payment is on its way', async () => {
    const raw = testApp.rawPrisma;
    const before = await dashboard();
    const late = await raw.installment.create({
      data: { companyId, planId, amount: 333, status: InstallmentStatus.OVERDUE, type: PlanPaymentType.INSTALLMENT, dueDate: new Date(Date.now() - 10 * DAY) },
      select: { id: true },
    });
    await raw.deposit.create({
      data: {
        companyId, contractId, installmentId: late.id, type: DepositType.INSTALLMENT, amount: 333, paidAt: new Date(),
        recordedById: customerId, reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      },
    });
    const after = await dashboard();
    expect(Number(after.summary.overdueAmountComputed)).toBe(Number(before.summary.overdueAmountComputed));
    const agingSum = (d: { aging: Array<{ amount: string | number }> }) => d.aging.reduce((a, b) => a + Number(b.amount), 0);
    expect(agingSum(after)).toBe(agingSum(before));
  });

  it('C-3: a sale counts on its signing date; an unsigned contract is not a sale', async () => {
    const today = cairoToday();
    const salesToday = async () =>
      Number((await asAdmin(http().get('/v1/reports/sales').query({ dateFrom: today, dateTo: today })).expect(200)).body.contracts);
    // Created 400 days ago, signed today: one of today's sales.
    const withIt = await salesToday();
    await testApp.rawPrisma.contract.update({ where: { id: contractId }, data: { signedAt: new Date(Date.now() - 10 * DAY) } });
    expect(await salesToday()).toBe(withIt - 1);
    // Created today but not signed: not a sale.
    contractIds.push(
      (
        await testApp.rawPrisma.contract.create({
          data: { companyId, customerId, unitId: units[1]!.id, totalAmount: 5000, status: ContractStatus.UNSIGNED, contractNumber: `U4B-U-${stamp}` },
          select: { id: true },
        })
      ).id,
    );
    expect(await salesToday()).toBe(withIt - 1);
  });
});
