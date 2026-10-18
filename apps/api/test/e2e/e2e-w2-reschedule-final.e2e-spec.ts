/**
 * W2 — a reschedule moves an unpaid final (balloon) payment to a month after
 * the last new monthly row (decided 2026-10-18). It stayed on its old date,
 * ahead of the monthly payments, and was chased — with late fees — early.
 */
import 'reflect-metadata';
import request from 'supertest';
import { BrokerStatus, InstallmentStatus, PlanPaymentType, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('W2 — reschedule moves the final payment (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  let brokerId: string;
  let ruleId: string;
  let pausedRuleIds: string[] = [];
  const sales: Sale[] = [];
  const payoutIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const money = (v: unknown) => Number(v).toFixed(2);

  /** A signed-or-not sale of a fresh 1,000,000 unit on a 12-month plan with a 10% markup. */
  const makeSale = async (n: number, pct = 2.5): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `W2-U${n}-${stamp}`,
          type: 'APARTMENT',
          area: 100,
          bedrooms: 2,
          bathrooms: 1,
          floor: 1,
          price: 1_000_000,
          status: UnitStatus.AVAILABLE,
        },
      })
    ).id;
    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: `W2 plan ${n}`,
      projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      finalPaymentAmount: 200_000,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 10 }],
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    const option = await raw.installmentPlanDurationOption.findFirstOrThrow({ where: { planId: tpl.body.id } });
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: tpl.body.id,
        installmentPlanDurationOptionId: option.id,
        expiresInHours: 72,
      })
      .expect(201);
    const reservationId = created.body.id ?? created.body.reservation?.id;
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({ startsAt: '2027-01-15' }).expect(201);
    const contract = await raw.contract.findFirstOrThrow({ where: { reservationId }, select: { id: true } });
    // A broker sale (2.5% unless said otherwise).
    await raw.reservation.update({ where: { id: reservationId }, data: { brokerId, commissionLockedPct: pct } });
    await raw.contract.update({ where: { id: contract.id }, data: { brokerId } });
    const sale = { unitId, templateId: tpl.body.id, reservationId, contractId: contract.id };
    sales.push(sale);
    return sale;
  };
  const sign = (s: Sale) =>
    asAdmin(http().post(`/v1/contracts/${s.contractId}/sign`)).send({ signedAt: new Date().toISOString() }).expect(201);
  const changePrice = (s: Sale, totalAmount: number) =>
    asAdmin(http().post(`/v1/contracts/${s.contractId}/price`)).send({ totalAmount, reason: 'U2b price change' }).expect(201);
  const commissionOf = (s: Sale) => testApp.rawPrisma.brokerCommission.findUniqueOrThrow({ where: { contractId: s.contractId } });
  const bonusOf = (s: Sale) => testApp.rawPrisma.bonusEntry.findUniqueOrThrow({ where: { contractId: s.contractId } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    brokerId = (await raw.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 }, select: { id: true } })).id;
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `W2-${stamp}`,
          name: { ar: 'مشروع', en: 'W2 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `W2-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `W2-B-${stamp}`, name: 'B' } })).id;
    // Exactly one active auto-apply rule drives the sales bonus: ours, 1%.
    const others = await raw.bonusRule.findMany({
      where: { companyId, active: true, autoApplyOnSignedContract: true },
      select: { id: true },
    });
    pausedRuleIds = others.map((r) => r.id);
    await raw.bonusRule.updateMany({ where: { id: { in: pausedRuleIds } }, data: { active: false } });
    ruleId = (
      await asAdmin(http().post('/v1/bonus-rules'))
        .send({ name: `W2 auto ${stamp}`, percentage: 1, active: true, autoApplyOnSignedContract: true })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.broker.update({ where: { id: brokerId }, data: { status: BrokerStatus.ACTIVE, suspendedAt: null } });
    const contractIds = sales.map((s) => s.contractId);
    const commissions = await raw.brokerCommission.findMany({ where: { contractId: { in: contractIds } }, select: { id: true, payoutId: true } });
    const allPayouts = [...new Set([...payoutIds, ...commissions.map((c) => c.payoutId).filter((x): x is string => !!x)])];
    await raw.brokerCommissionAdjustment.deleteMany({ where: { commissionId: { in: commissions.map((c) => c.id) } } });
    await raw.brokerCommission.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.brokerActivityLog.deleteMany({ where: { entityId: { in: allPayouts } } });
    await raw.brokerPayout.deleteMany({ where: { id: { in: allPayouts } } });
    const bonuses = await raw.bonusEntry.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } });
    await raw.bonusEntry.deleteMany({ where: { adjustsEntryId: { in: bonuses.map((b) => b.id) } } });
    await raw.bonusEntry.deleteMany({ where: { OR: [{ contractId: { in: contractIds } }, { ruleId }] } });
    await raw.bonusRule.deleteMany({ where: { id: ruleId } });
    await raw.bonusRule.updateMany({ where: { id: { in: pausedRuleIds } }, data: { active: true } });
    for (const s of sales) {
      const plan = await raw.installmentPlan.findFirst({ where: { contractId: s.contractId }, select: { id: true } });
      await raw.deposit.deleteMany({ where: { OR: [{ contractId: s.contractId }, { reservationId: s.reservationId }] } });
      await raw.contractAmendment.deleteMany({ where: { contractId: s.contractId } });
      await raw.contractCancellation.deleteMany({ where: { contractId: s.contractId } });
      if (plan) {
        await raw.installment.deleteMany({ where: { planId: plan.id } });
        await raw.installmentPlan.deleteMany({ where: { id: plan.id } });
      }
      await raw.contract.deleteMany({ where: { id: s.contractId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId: s.reservationId } });
      await raw.reservation.deleteMany({ where: { id: s.reservationId } });
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: s.templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: s.templateId } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: s.templateId } });
    }
    const ids = [...contractIds, ...sales.map((s) => s.unitId)];
    await raw.auditLog.deleteMany({ where: { entityId: { in: ids }, createdAt: { gte: startedAt } } });
    await raw.unitMaintenanceItem.deleteMany({ where: { unitId: { in: sales.map((s) => s.unitId) } } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: sales.map((s) => s.unitId) } } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('W2-1: the final payment moves after the new schedule; its unpaid late fee goes', async () => {
    const raw = testApp.rawPrisma;
    const sale = await makeSale(1);
    await sign(sale);
    const plan = await raw.installmentPlan.findUniqueOrThrow({ where: { contractId: sale.contractId }, select: { id: true } });
    const final = await raw.installment.findFirstOrThrow({ where: { planId: plan.id, type: PlanPaymentType.FINAL_PAYMENT } });
    // The balloon is overdue and drew a late fee.
    await raw.installment.update({ where: { id: final.id }, data: { status: InstallmentStatus.OVERDUE, dueDate: new Date(Date.now() - 10 * 86_400_000) } });
    const fee = await raw.installment.create({
      data: { planId: plan.id, type: PlanPaymentType.LATE_FEE, amount: 500, status: InstallmentStatus.PENDING, dueDate: new Date(), feeForId: final.id, companyId },
    });

    const startsAt = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/reschedule`))
      .send({ months: 24, startsAt, reason: 'W2 reschedule' })
      .expect(201);

    const lastMonthly = await raw.installment.findFirstOrThrow({
      where: { planId: plan.id, type: PlanPaymentType.INSTALLMENT, status: InstallmentStatus.PENDING },
      orderBy: { dueDate: 'desc' },
    });
    const moved = await raw.installment.findUniqueOrThrow({ where: { id: final.id } });
    expect(moved.status).toBe(InstallmentStatus.PENDING);
    expect(moved.dueDate.getTime()).toBeGreaterThan(lastMonthly.dueDate.getTime());
    expect(money(moved.amount)).toBe('200000.00');
    expect((await raw.installment.findUniqueOrThrow({ where: { id: fee.id } })).status).toBe(InstallmentStatus.CANCELLED);
  });
});
