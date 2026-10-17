/**
 * U3a — what the customer sees and is chased for.
 *
 * - GET /me/installments leaves out the rows a reschedule cancelled (the app
 *   showed them as pending); asking for status=CANCELLED still lists them.
 * - A reschedule and a price change tell the customer.
 * - The overdue sweep, the late fees and the reminders skip a deactivated
 *   customer and a blocked company.
 * - A customer with a live contract cannot be deactivated or deleted.
 * - The reminder's installment number counts the schedule's own payments,
 *   not cancelled rows or fees.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, InstallmentStatus, PlanPaymentType, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { LATE_FEE_SETTING_DEFAULTS } from '../../src/modules/installments/late-fee';

const DAY = 86_400_000;

describe('U3a — customer schedule, notices and chasing (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let customerId: string;
  let unitId: string;
  let unitStatus: UnitStatus;
  let contractId: string;
  let planId: string;
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const row = (dueInDays: number, status: InstallmentStatus, type: PlanPaymentType = PlanPaymentType.INSTALLMENT) =>
    testApp.rawPrisma.installment.create({
      data: {
        companyId,
        planId,
        amount: 10_000,
        status,
        type,
        dueDate: new Date(Date.now() + dueInDays * DAY),
        ...(status === InstallmentStatus.PAID ? { paidAt: new Date() } : {}),
      },
      select: { id: true },
    });
  const statusOf = async (id: string) =>
    (await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U3a Customer', phone: `+2015${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    customerToken = await testApp.signAccessToken(customerId, UserRole.CUSTOMER);
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
          signedAt: new Date(), contractNumber: `U3A-${stamp}`,
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
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const { key, value } of LATE_FEE_SETTING_DEFAULTS) {
      await raw.setting.updateMany({ where: { companyId, key }, data: { value } });
    }
    await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'ACTIVE' } });
    await raw.notification.deleteMany({ where: { userId: customerId } });
    await raw.installment.deleteMany({ where: { planId, feeForId: { not: null } } });
    await raw.installment.deleteMany({ where: { planId } });
    await raw.installmentPlan.deleteMany({ where: { id: planId } });
    await raw.contractAmendment.deleteMany({ where: { contractId } });
    await raw.auditLog.deleteMany({ where: { entityId: contractId, createdAt: { gte: startedAt } } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.unit.update({ where: { id: unitId }, data: { status: unitStatus } });
    await raw.refreshToken.deleteMany({ where: { userId: customerId } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('S-1: /me/installments leaves out rows a reschedule cancelled', async () => {
    const open = await row(20, InstallmentStatus.PENDING);
    const cancelled = await row(25, InstallmentStatus.CANCELLED);
    const res = await http().get('/v1/me/installments').set('Authorization', bearer(customerToken)).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(cancelled.id);
    const asked = await http()
      .get('/v1/me/installments')
      .query({ status: 'CANCELLED' })
      .set('Authorization', bearer(customerToken))
      .expect(200);
    expect((asked.body.data as Array<{ id: string }>).map((i) => i.id)).toEqual([cancelled.id]);
  });

  it('S-2: a price change and a reschedule tell the customer', async () => {
    await asAdmin(http().post(`/v1/contracts/${contractId}/price`))
      .send({ totalAmount: 101_000, reason: 'U3a price' })
      .expect(201);
    const startsAt = new Date(Date.now() + 40 * DAY).toISOString().slice(0, 10);
    await asAdmin(http().post(`/v1/contracts/${contractId}/reschedule`))
      .send({ months: 2, startsAt, reason: 'U3a reschedule' })
      .expect(201);
    const notes = await testApp.rawPrisma.notification.findMany({
      where: { userId: customerId, templateCode: { in: ['contract_price_changed', 'contract_rescheduled'] } },
      select: { templateCode: true },
    });
    expect(notes.map((n) => n.templateCode).sort()).toEqual(['contract_price_changed', 'contract_rescheduled']);
  });

  it('S-3: a deactivated customer and a blocked company are not chased', async () => {
    const raw = testApp.rawPrisma;
    await raw.installment.updateMany({ where: { planId, status: { in: ['PENDING', 'OVERDUE'] } }, data: { status: 'CANCELLED' } });
    const late = await row(-5, InstallmentStatus.PENDING);
    const lateForFee = await row(-30, InstallmentStatus.OVERDUE);
    await asAdmin(http().patch('/v1/settings/lateFee.enabled')).send({ value: true }).expect(200);

    // A customer deactivated before this rule (the account is off).
    await raw.user.update({ where: { id: customerId }, data: { active: false } });
    await testApp.runCronJob('installment-overdue');
    await testApp.runCronJob('late-fee');
    expect(await statusOf(late.id)).toBe(InstallmentStatus.PENDING);
    expect(await raw.installment.count({ where: { feeForId: lateForFee.id } })).toBe(0);
    await raw.user.update({ where: { id: customerId }, data: { active: true } });

    // The company is blocked.
    await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'SUSPENDED' } });
    try {
      await testApp.runCronJob('installment-overdue');
      await testApp.runCronJob('late-fee');
      expect(await statusOf(late.id)).toBe(InstallmentStatus.PENDING);
      expect(await raw.installment.count({ where: { feeForId: lateForFee.id } })).toBe(0);
    } finally {
      await raw.company.update({ where: { id: companyId }, data: { lifecycleStatus: 'ACTIVE' } });
    }

    // Active again: chased as before.
    await testApp.runCronJob('installment-overdue');
    expect(await statusOf(late.id)).toBe(InstallmentStatus.OVERDUE);
    await raw.installment.updateMany({ where: { id: { in: [late.id, lateForFee.id] } }, data: { status: 'CANCELLED' } });
  });

  it('S-4: a customer with a live contract cannot be deactivated or deleted', async () => {
    const off = await asAdmin(http().patch(`/v1/users/${customerId}/deactivate`));
    expect(off.status).toBe(409);
    expect(off.body.code ?? off.body.message?.code).toBe('CUSTOMER_HAS_LIVE_CONTRACT');
    expect((await asAdmin(http().delete(`/v1/users/${customerId}`))).status).toBe(409);
    const user = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(user.active).toBe(true);
    expect(user.deletedAt).toBeNull();
  });

  it('S-5: the reminder number counts the schedule’s own payments only', async () => {
    const raw = testApp.rawPrisma;
    // Every earlier row is paid or cancelled by now; one paid instalment before
    // the reminded one, plus a cancelled row and a fee that must not count.
    await raw.installment.deleteMany({ where: { planId, status: 'CANCELLED', feeForId: null, type: PlanPaymentType.INSTALLMENT } });
    await raw.installment.deleteMany({ where: { planId, status: { not: 'CANCELLED' } } });
    await row(-60, InstallmentStatus.PAID);
    await row(-30, InstallmentStatus.CANCELLED);
    await row(-10, InstallmentStatus.CANCELLED, PlanPaymentType.LATE_FEE);
    const soon = await row(1, InstallmentStatus.PENDING);
    await testApp.runCronJob('installment-due-soon');
    const note = await raw.notification.findFirstOrThrow({
      where: { userId: customerId, templateCode: 'installment_due_soon' },
      select: { payload: true },
    });
    const payload = note.payload as { installmentId: string; installmentNumber: number };
    expect(payload.installmentId).toBe(soon.id);
    expect(payload.installmentNumber).toBe(2);
  });
});
