/**
 * Late-payment fee — a company setting, off by default.
 *
 * Once switched on, the daily sweep adds a LATE_FEE row to an installment
 * still unpaid after the grace period, never twice for the same period, and
 * the admin can waive it (it stays as a cancelled, waived row).
 */
import 'reflect-metadata';
import request from 'supertest';
import { InstallmentStatus, PlanPaymentType } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { LATE_FEE_SETTING_DEFAULTS } from '../../src/modules/installments/late-fee';

const DAY = 24 * 60 * 60 * 1000;

describe('Late-payment fee (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let overdueId: string;
  let freshId: string;
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const setSetting = (key: string, value: unknown) => asAdmin(http().patch(`/v1/settings/${key}`)).send({ value });
  const feesOn = (id: string) =>
    testApp.rawPrisma.installment.findMany({ where: { feeForId: id }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    companyId = admin.companyId!;
    const plan = await raw.installmentPlan.findFirstOrThrow({
      where: { contract: { companyId, deletedAt: null, status: { not: 'CANCELLED' } } },
      select: { id: true },
    });
    const row = (dueDate: Date, status: InstallmentStatus) =>
      raw.installment.create({
        data: { planId: plan.id, companyId, dueDate, amount: 20_000, status, type: PlanPaymentType.INSTALLMENT },
        select: { id: true },
      });
    overdueId = (await row(new Date(Date.now() - 10 * DAY), InstallmentStatus.OVERDUE)).id;
    freshId = (await row(new Date(Date.now() - 3 * DAY), InstallmentStatus.OVERDUE)).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const { key, value } of LATE_FEE_SETTING_DEFAULTS) {
      await raw.setting.updateMany({ where: { companyId, key }, data: { value } });
    }
    await raw.installment.deleteMany({ where: { type: PlanPaymentType.LATE_FEE, createdAt: { gte: startedAt } } });
    await raw.auditLog.deleteMany({ where: { action: 'installment.late-fee-waived', createdAt: { gte: startedAt } } });
    await raw.installment.deleteMany({ where: { id: { in: [overdueId, freshId] } } });
  });

  it('LF-1: switched off (the default), the sweep charges nothing', async () => {
    await testApp.runCronJob('late-fee');
    expect(await feesOn(overdueId)).toHaveLength(0);
  });

  it('LF-2: invalid settings are refused', async () => {
    await setSetting('lateFee.mode', 'DAILY').expect(400);
    await setSetting('lateFee.graceDays', -3).expect(400);
  });

  it('LF-3: switched on, a fee is charged past the grace period — once', async () => {
    await setSetting('lateFee.enabled', true).expect(200);
    await setSetting('lateFee.value', 2).expect(200);
    await testApp.runCronJob('late-fee');
    await testApp.runCronJob('late-fee');

    const fees = await feesOn(overdueId);
    expect(fees).toHaveLength(1);
    expect(Number(fees[0]!.amount)).toBe(400); // 2% of 20,000
    expect(fees[0]).toMatchObject({ type: PlanPaymentType.LATE_FEE, status: InstallmentStatus.PENDING });
    // Still inside its 7-day grace period.
    expect(await feesOn(freshId)).toHaveLength(0);
  });

  it('LF-4: the admin waives the fee; it is not charged again', async () => {
    const fee = (await feesOn(overdueId))[0]!;
    await asAdmin(http().post(`/v1/installments/${fee.id}/waive-late-fee`)).send({ reason: 'goodwill' }).expect(201);
    const waived = await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id: fee.id } });
    expect(waived.status).toBe(InstallmentStatus.CANCELLED);
    expect(waived.waivedAt).not.toBeNull();

    await asAdmin(http().post(`/v1/installments/${fee.id}/waive-late-fee`)).send({}).expect(409);
    // A regular installment is not a fee.
    await asAdmin(http().post(`/v1/installments/${overdueId}/waive-late-fee`)).send({}).expect(404);

    await testApp.runCronJob('late-fee');
    expect(await feesOn(overdueId)).toHaveLength(1);
  });
});
