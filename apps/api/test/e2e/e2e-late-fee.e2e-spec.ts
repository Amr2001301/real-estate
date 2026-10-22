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
  let contractId: string;
  let contractCreatedAt: Date;
  let contractSignedAt: Date | null;
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
      select: { id: true, contractId: true, contract: { select: { createdAt: true, signedAt: true } } },
    });
    contractId = plan.contractId;
    // The rows below are due 3 and 10 days ago: the contract was in the
    // system before then (a row due before it was entered earns no fee).
    contractCreatedAt = plan.contract.createdAt;
    contractSignedAt = plan.contract.signedAt;
    // Signed then too: the fee clock runs from the signing day at the earliest.
    await raw.contract.update({
      where: { id: contractId },
      data: { createdAt: new Date(Date.now() - 30 * DAY), signedAt: new Date(Date.now() - 30 * DAY) },
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
    await raw.deposit.deleteMany({ where: { installment: { feeForId: { in: [overdueId, freshId] } } } });
    await raw.installment.deleteMany({ where: { type: PlanPaymentType.LATE_FEE, createdAt: { gte: startedAt } } });
    await raw.auditLog.deleteMany({ where: { action: 'installment.late-fee-waived', createdAt: { gte: startedAt } } });
    await raw.installment.deleteMany({ where: { id: { in: [overdueId, freshId] } } });
    await raw.contract.update({
      where: { id: contractId },
      data: { createdAt: contractCreatedAt, signedAt: contractSignedAt, lateFeesApply: false },
    });
  });

  it('LF-1: a contract without a late-fee clause (the default) is charged nothing', async () => {
    await testApp.runCronJob('late-fee');
    expect(await feesOn(overdueId)).toHaveLength(0);
  });

  it('LF-2: invalid settings are refused', async () => {
    await setSetting('lateFee.mode', 'DAILY').expect(400);
    await setSetting('lateFee.graceDays', -3).expect(400);
  });

  it('LF-3: with a late-fee clause, a fee is charged past the grace period — once', async () => {
    // The contract decides; the company sets the rate.
    await testApp.rawPrisma.contract.update({ where: { id: contractId }, data: { lateFeesApply: true } });
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

  it('LF-5: paying a fee is recorded as a fee, not as an instalment of the price', async () => {
    const raw = testApp.rawPrisma;
    const fee = await raw.installment.create({
      data: {
        planId: (await raw.installment.findUniqueOrThrow({ where: { id: freshId }, select: { planId: true } })).planId,
        companyId,
        dueDate: new Date(),
        amount: 150,
        status: InstallmentStatus.PENDING,
        type: PlanPaymentType.LATE_FEE,
        feeForId: freshId,
      },
    });
    const res = await asAdmin(http().post('/v1/deposits'))
      .send({ contractId, installmentId: fee.id, amount: 150, paymentMethod: 'CASH' })
      .expect(201);
    const deposit = await raw.deposit.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(deposit.type).toBe('FEE');

    const list = await asAdmin(http().get('/v1/deposits').query({ type: 'FEE', contractId })).expect(200);
    expect(list.body.data.map((d: { id: string }) => d.id)).toContain(deposit.id);
    expect(Number(list.body.totals.fees)).toBeGreaterThanOrEqual(150);
  });

  it('LF-6: a row due before the contract was entered earns no fee (a back-dated contract)', async () => {
    const raw = testApp.rawPrisma;
    // The contract is entered today; its row was due 10 days ago (e.g. a
    // contract signed in July, entered in October).
    await raw.contract.update({ where: { id: contractId }, data: { createdAt: new Date() } });
    const planId = (await raw.installment.findUniqueOrThrow({ where: { id: freshId }, select: { planId: true } }))
      .planId;
    const older = await raw.installment.create({
      data: {
        planId,
        companyId,
        dueDate: new Date(Date.now() - 10 * DAY),
        amount: 20_000,
        status: InstallmentStatus.OVERDUE,
        type: PlanPaymentType.INSTALLMENT,
      },
      select: { id: true },
    });
    try {
      await testApp.runCronJob('late-fee');
      expect(await feesOn(older.id)).toHaveLength(0);
      // It is still overdue — only the fee is not charged.
      expect((await raw.installment.findUniqueOrThrow({ where: { id: older.id } })).status).toBe(
        InstallmentStatus.OVERDUE,
      );
    } finally {
      await raw.installment.deleteMany({ where: { feeForId: older.id } });
      await raw.installment.deleteMany({ where: { id: older.id } });
      await raw.contract.update({
        where: { id: contractId },
        data: { createdAt: new Date(Date.now() - 30 * DAY) },
      });
    }
  });

  it('LF-7: a contract without a late-fee clause is not charged; turning it on charges it', async () => {
    const raw = testApp.rawPrisma;
    // The overdue row's fee from LF-3 was waived in LF-4 and recharged; start clean.
    await raw.installment.deleteMany({ where: { feeForId: overdueId } });
    await asAdmin(http().patch(`/v1/contracts/${contractId}/late-fee-clause`))
      .send({ lateFeesApply: false })
      .expect(200);
    try {
      await testApp.runCronJob('late-fee');
      expect(await feesOn(overdueId)).toHaveLength(0);

      await asAdmin(http().patch(`/v1/contracts/${contractId}/late-fee-clause`))
        .send({ lateFeesApply: true })
        .expect(200);
      await testApp.runCronJob('late-fee');
      expect(await feesOn(overdueId)).toHaveLength(1);
      const audit = await raw.auditLog.findFirst({
        where: { action: 'contract.late-fee-clause', entityId: contractId, createdAt: { gte: startedAt } },
      });
      expect(audit).not.toBeNull();
    } finally {
      await raw.contract.update({ where: { id: contractId }, data: { lateFeesApply: true } });
      await raw.auditLog.deleteMany({ where: { action: 'contract.late-fee-clause', createdAt: { gte: startedAt } } });
    }
  });

  it('LF-8: a new contract takes the company setting unless the admin chooses', async () => {
    const raw = testApp.rawPrisma;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId, status: 'AVAILABLE' }, select: { id: true } });
    const made: string[] = [];
    try {
      // The company's default for new contracts: a clause.
      await setSetting('lateFee.enabled', true).expect(200);
      const a = await asAdmin(http().post('/v1/contracts'))
        .send({ customerId: fixtures.userIds.customer1UserId, unitId: unit.id, totalAmount: 1_000_000 })
        .expect(201);
      made.push(a.body.id);
      expect((await raw.contract.findUniqueOrThrow({ where: { id: a.body.id } })).lateFeesApply).toBe(true);
      // The admin says this one has no clause.
      await asAdmin(http().delete(`/v1/contracts/${a.body.id}`)).expect(200);
      const b = await asAdmin(http().post('/v1/contracts'))
        .send({
          customerId: fixtures.userIds.customer1UserId,
          unitId: unit.id,
          totalAmount: 1_000_000,
          lateFeesApply: false,
        })
        .expect(201);
      made.push(b.body.id);
      expect((await raw.contract.findUniqueOrThrow({ where: { id: b.body.id } })).lateFeesApply).toBe(false);
    } finally {
      await raw.auditLog.deleteMany({ where: { entityId: { in: [...made, unit.id] }, createdAt: { gte: startedAt } } });
      await raw.contract.deleteMany({ where: { id: { in: made } } });
      await raw.unitStatusHistory.deleteMany({ where: { unitId: unit.id, changedAt: { gte: startedAt } } });
      await raw.unit.update({ where: { id: unit.id }, data: { status: 'AVAILABLE' } });
    }
  });
});
