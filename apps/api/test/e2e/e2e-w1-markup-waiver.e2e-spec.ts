/**
 * W1 — on early settlement the company waives instalment markup not paid yet
 * (decided 2026-10-18). The total and the markup come down together, so the
 * sale price stays: no discount on record, the commission and the sales
 * bonus don't move, sales reports keep the net price. More than the markup
 * left is refused (that is a price change).
 */
import 'reflect-metadata';
import request from 'supertest';
import { BrokerStatus, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('W1 — instalment markup waiver (e2e)', () => {
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
          code: `W1-U${n}-${stamp}`,
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
      name: `W1 plan ${n}`,
      projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
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
          code: `W1-${stamp}`,
          name: { ar: 'مشروع', en: 'W1 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `W1-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `W1-B-${stamp}`, name: 'B' } })).id;
    // Exactly one active auto-apply rule drives the sales bonus: ours, 1%.
    const others = await raw.bonusRule.findMany({
      where: { companyId, active: true, autoApplyOnSignedContract: true },
      select: { id: true },
    });
    pausedRuleIds = others.map((r) => r.id);
    await raw.bonusRule.updateMany({ where: { id: { in: pausedRuleIds } }, data: { active: false } });
    ruleId = (
      await asAdmin(http().post('/v1/bonus-rules'))
        .send({ name: `W1 auto ${stamp}`, percentage: 1, active: true, autoApplyOnSignedContract: true })
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

  const waive = (s: Sale, amount: number) =>
    asAdmin(http().post(`/v1/contracts/${s.contractId}/waive-markup`)).send({ amount, reason: 'W1 early settlement' });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
  const salesToday = async () =>
    Number((await asAdmin(http().get(`/v1/reports/sales?dateFrom=${day}&dateTo=${day}`)).expect(200)).body.total);

  it('W1-1: the waiver lowers the total and the unpaid rows; price, commission, bonus and sales stay', async () => {
    const raw = testApp.rawPrisma;
    const sale = await makeSale(1);
    await sign(sale);
    const openSum = async () =>
      (
        await raw.installment.findMany({
          where: { plan: { contractId: sale.contractId }, status: { in: ['PENDING', 'OVERDUE'] } },
          select: { amount: true },
        })
      ).reduce((a, r) => a + Math.round(Number(r.amount) * 100), 0);
    const before = { open: await openSum(), sales: await salesToday() };
    // 1,000,000 + 10% on the 850,000 financed: 85,000 of markup.
    expect(money((await raw.contract.findUniqueOrThrow({ where: { id: sale.contractId } })).totalAmount)).toBe('1085000.00');

    await waive(sale, 50_000).expect(201);
    const contract = await raw.contract.findUniqueOrThrow({ where: { id: sale.contractId } });
    expect(money(contract.totalAmount)).toBe('1035000.00');
    expect(money(contract.markupWaived)).toBe('50000.00');
    expect(before.open - (await openSum())).toBe(5_000_000);
    expect(money((await commissionOf(sale)).netAmount)).toBe('25000.00');
    expect(money((await commissionOf(sale)).basisAmount)).toBe('1000000.00');
    expect(money((await bonusOf(sale)).amount)).toBe('10000.00');
    expect(Math.round((await salesToday()) - before.sales)).toBe(0);
    // Not a discount: nothing went through the discount cap.
    expect(await raw.auditLog.count({ where: { entityId: sale.contractId, action: { startsWith: 'pricing.discount' } } })).toBe(0);
    expect(await raw.contractAmendment.count({ where: { contractId: sale.contractId, type: 'MARKUP_WAIVER' } })).toBe(1);
  });

  it('W1-2: more than the markup left is refused', async () => {
    const sale = await makeSale(2);
    await sign(sale);
    await waive(sale, 60_000).expect(201);
    // 25,000 left of the 85,000.
    await waive(sale, 30_000).expect(400);
    await waive(sale, 25_000).expect(201);
  });
});
