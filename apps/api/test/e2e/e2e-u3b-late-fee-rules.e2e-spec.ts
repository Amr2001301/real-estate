/**
 * U3b — late-fee decisions (round-4 decision 7) and one "should be chased" rule.
 *
 * - A reschedule waives the unpaid late fees on the rows it cancels; a paid
 *   fee stays paid.
 * - The late-fee clock stops while a payment for the row is waiting or the
 *   company is blocked, and the stopped time does not count.
 * - A transfer needs the overdue rows and late fees settled first.
 * - The customer's home banner follows the overdue sweep: a row whose
 *   payment is on its way is not overdue.
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
import { LATE_FEE_SETTING_DEFAULTS } from '../../src/modules/installments/late-fee';

const DAY = 86_400_000;

describe('U3b — late-fee rules and the chase rule (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let customerId: string;
  let otherId: string;
  let unitId: string;
  let unitStatus: UnitStatus;
  let contractId: string;
  let planId: string;
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const row = (
    dueInDays: number,
    status: InstallmentStatus,
    type: PlanPaymentType = PlanPaymentType.INSTALLMENT,
    feeForId?: string,
  ) =>
    testApp.rawPrisma.installment.create({
      data: {
        companyId, planId, amount: 10_000, status, type, feeForId,
        dueDate: new Date(Date.now() + dueInDays * DAY),
        ...(status === InstallmentStatus.PAID ? { paidAt: new Date() } : {}),
      },
      select: { id: true },
    });
  const settle = () =>
    testApp.rawPrisma.installment.updateMany({
      where: { planId, status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] } },
      data: { status: InstallmentStatus.CANCELLED },
    });
  const feesOn = (id: string) => testApp.rawPrisma.installment.count({ where: { feeForId: id } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    const person = (n: string, role: UserRole) =>
      raw.user.create({
        data: { companyId, role, fullName: `U3b ${n}`, phone: `+2016${n}${stamp}`, locale: 'ar' },
        select: { id: true },
      });
    customerId = (await person('1', UserRole.CUSTOMER)).id;
    otherId = (await person('2', UserRole.CLIENT)).id;
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
    });
    unitId = unit.id;
    unitStatus = unit.status;
    await raw.unit.update({ where: { id: unitId }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId, totalAmount: 100_000, status: ContractStatus.ACTIVE,
          signedAt: new Date(), contractNumber: `U3B-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
    planId = (
      await raw.installmentPlan.create({
        data: { companyId, contractId, totalMonths: 6, monthlyAmount: 10_000, startsAt: new Date() },
        select: { id: true },
      })
    ).id;
    await asAdmin(http().patch('/v1/settings/lateFee.enabled')).send({ value: true }).expect(200);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const { key, value } of LATE_FEE_SETTING_DEFAULTS) {
      await raw.setting.updateMany({ where: { companyId, key }, data: { value } });
    }
    await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'ACTIVE' } });
    await raw.deposit.deleteMany({ where: { contractId } });
    await raw.notification.deleteMany({ where: { userId: { in: [customerId, otherId] } } });
    await raw.installment.deleteMany({ where: { planId, feeForId: { not: null } } });
    await raw.installment.deleteMany({ where: { planId } });
    await raw.installmentPlan.deleteMany({ where: { id: planId } });
    await raw.contractAmendment.deleteMany({ where: { contractId } });
    await raw.auditLog.deleteMany({ where: { entityId: contractId, createdAt: { gte: startedAt } } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.unit.update({ where: { id: unitId }, data: { status: unitStatus } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: [customerId, otherId] } } });
    await raw.user.deleteMany({ where: { id: { in: [customerId, otherId] } } });
  });

  it('R-1: a reschedule waives the unpaid late fees on the rows it cancels', async () => {
    const raw = testApp.rawPrisma;
    const late = await row(-40, InstallmentStatus.OVERDUE);
    const unpaidFee = await row(-5, InstallmentStatus.PENDING, PlanPaymentType.LATE_FEE, late.id);
    const paidFee = await row(-20, InstallmentStatus.PAID, PlanPaymentType.LATE_FEE, late.id);
    await row(20, InstallmentStatus.PENDING);
    const startsAt = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
    await asAdmin(http().post(`/v1/contracts/${contractId}/reschedule`))
      .send({ months: 3, startsAt, reason: 'U3b reschedule' })
      .expect(201);
    const fee = await raw.installment.findUniqueOrThrow({ where: { id: unpaidFee.id } });
    expect(fee.status).toBe(InstallmentStatus.CANCELLED);
    expect(fee.waivedAt).not.toBeNull();
    expect((await raw.installment.findUniqueOrThrow({ where: { id: paidFee.id } })).status).toBe(InstallmentStatus.PAID);
    await settle();
  });

  it('R-2: the late-fee clock stops while a payment waits, and the stopped time does not count', async () => {
    const raw = testApp.rawPrisma;
    // 10 days late, 7 days' grace: a fee is due — but a proof is under review.
    const late = await row(-10, InstallmentStatus.OVERDUE);
    const proof = await raw.deposit.create({
      data: {
        companyId, contractId, installmentId: late.id, type: DepositType.INSTALLMENT, amount: 10_000,
        paidAt: new Date(), recordedById: customerId, reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      },
      select: { id: true },
    });
    await testApp.runCronJob('late-fee');
    expect(await feesOn(late.id)).toBe(0);
    expect((await raw.installment.findUniqueOrThrow({ where: { id: late.id } })).lateFeePausedSince).not.toBeNull();

    // The proof is rejected after 5 days under review: the clock runs again,
    // and those 5 days do not count — 5 days late, inside the grace period.
    await raw.deposit.update({ where: { id: proof.id }, data: { reviewStatus: DepositReviewStatus.REJECTED } });
    await raw.installment.update({ where: { id: late.id }, data: { lateFeePausedSince: new Date(Date.now() - 5 * DAY) } });
    await testApp.runCronJob('late-fee');
    const after = await raw.installment.findUniqueOrThrow({ where: { id: late.id } });
    expect(after.lateFeePausedSince).toBeNull();
    expect(after.lateFeePausedSeconds).toBeGreaterThanOrEqual(5 * 86_400 - 60);
    expect(await feesOn(late.id)).toBe(0);
    await settle();
  });

  it('R-3: the clock stops while the company is blocked', async () => {
    const raw = testApp.rawPrisma;
    const late = await row(-10, InstallmentStatus.OVERDUE);
    await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'SUSPENDED' } });
    try {
      await testApp.runCronJob('late-fee');
    } finally {
      await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'ACTIVE' } });
    }
    expect((await raw.installment.findUniqueOrThrow({ where: { id: late.id } })).lateFeePausedSince).not.toBeNull();
    // Blocked for 4 of those 10 days: 6 days late, inside the grace period.
    await raw.installment.update({ where: { id: late.id }, data: { lateFeePausedSince: new Date(Date.now() - 4 * DAY) } });
    await testApp.runCronJob('late-fee');
    expect(await feesOn(late.id)).toBe(0);
    await settle();
  });

  it('R-4: a transfer needs the overdue rows and late fees settled first', async () => {
    const late = await row(-3, InstallmentStatus.OVERDUE);
    const transfer = () =>
      asAdmin(http().post(`/v1/contracts/${contractId}/transfer`)).send({ toCustomerId: otherId, reason: 'U3b transfer', feeAmount: 0 });
    let res = await transfer();
    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.message?.code).toBe('TRANSFER_NEEDS_ARREARS_SETTLED');
    // The row paid, its fee still open: still refused.
    await testApp.rawPrisma.installment.update({ where: { id: late.id }, data: { status: InstallmentStatus.PAID, paidAt: new Date() } });
    await row(5, InstallmentStatus.PENDING, PlanPaymentType.LATE_FEE, late.id);
    res = await transfer();
    expect(res.status).toBe(409);
    expect((await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: contractId } })).customerId).toBe(customerId);
    await settle();
  });

  it('R-5: the home banner does not call a row overdue while its payment is on its way', async () => {
    const raw = testApp.rawPrisma;
    const token = await testApp.signAccessToken(customerId, UserRole.CUSTOMER);
    const late = await row(-3, InstallmentStatus.PENDING);
    await raw.deposit.create({
      data: {
        companyId, contractId, installmentId: late.id, type: DepositType.INSTALLMENT, amount: 10_000,
        paidAt: new Date(), recordedById: customerId, reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      },
    });
    const res = await http().get('/v1/me/home-summary').set('Authorization', bearer(token)).expect(200);
    expect(res.body.primaryAction.type).not.toBe('OVERDUE_INSTALLMENT');
    expect(res.body.installments.nextDue?.status).toBe('PENDING');
    await settle();
  });
});
