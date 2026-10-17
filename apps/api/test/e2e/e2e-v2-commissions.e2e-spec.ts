/**
 * V2 — a cancelled deal's commission and bonus (numbers audit, 2026-10-17).
 *
 * - MANUAL: an approved commission leaves a payout not sent yet — it can't be
 *   paid while the admin decides.
 * - CLAWBACK: price-change adjustments not paid yet are dropped; the clawback
 *   recovers what was actually paid (the net plus paid adjustments).
 * - A bonus adjustment follows the bonus it adjusts: cancelled with CLAWBACK,
 *   not approvable on a deal left MANUAL.
 * - The leaderboard leaves out a clawed-back commission.
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

describe('V2 — commissions on a cancelled deal (e2e)', () => {
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
          code: `V2-U${n}-${stamp}`,
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
      name: `V2 plan ${n}`,
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
          code: `V2-${stamp}`,
          name: { ar: 'مشروع', en: 'V2 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `V2-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `V2-B-${stamp}`, name: 'B' } })).id;
    // Exactly one active auto-apply rule drives the sales bonus: ours, 1%.
    const others = await raw.bonusRule.findMany({
      where: { companyId, active: true, autoApplyOnSignedContract: true },
      select: { id: true },
    });
    pausedRuleIds = others.map((r) => r.id);
    await raw.bonusRule.updateMany({ where: { id: { in: pausedRuleIds } }, data: { active: false } });
    ruleId = (
      await asAdmin(http().post('/v1/bonus-rules'))
        .send({ name: `V2 auto ${stamp}`, percentage: 1, active: true, autoApplyOnSignedContract: true })
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

  const cancel = (s: Sale, commissionAction: string, bonusAction = commissionAction) =>
    asAdmin(http().post(`/v1/contracts/${s.contractId}/cancel`))
      .send({
        reason: 'V2 cancel',
        retainedAmount: 0,
        refundAmount: 0,
        commissionActionOverride: commissionAction,
        bonusActionOverride: bonusAction,
      })
      .expect(201);
  /** Commission and bonus paid out in full. */
  const payBoth = async (s: Sale) => {
    const commission = await commissionOf(s);
    await asAdmin(http().patch(`/v1/broker-commissions/${commission.id}/approve`)).send({}).expect(200);
    const payout = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [commission.id] }).expect(201);
    payoutIds.push(payout.body.id);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/approve`)).send({}).expect(200);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/process`)).send({}).expect(200);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/mark-paid`)).send({ paymentMethod: 'BANK_TRANSFER' }).expect(200);
    const bonus = await bonusOf(s);
    await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/pay`)).send({}).expect(201);
    return payout.body.id as string;
  };
  const leaderboardFor = async () => {
    const res = await asAdmin(http().get('/v1/reports/broker-leaderboard')).expect(200);
    const rows = (res.body.data ?? res.body) as Array<{ brokerId: string; commissionAmount: number }>;
    return rows.find((r) => r.brokerId === brokerId)?.commissionAmount ?? 0;
  };

  it('V2-1: MANUAL — an approved commission leaves the payout not sent yet', async () => {
    const sale = await makeSale(1);
    await sign(sale);
    const commission = await commissionOf(sale);
    await asAdmin(http().patch(`/v1/broker-commissions/${commission.id}/approve`)).send({}).expect(200);
    const payout = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [commission.id] }).expect(201);
    payoutIds.push(payout.body.id);

    await cancel(sale, 'MANUAL');
    const after = await commissionOf(sale);
    expect(after.status).toBe('APPROVED'); // the admin still decides
    expect(after.payoutId).toBeNull();
    const p = await testApp.rawPrisma.brokerPayout.findUniqueOrThrow({ where: { id: payout.body.id } });
    expect(p.status).toBe('CANCELLED');
  });

  it('V2-2: CLAWBACK — an open top-up is dropped; the clawback is what was paid; off the leaderboard', async () => {
    const raw = testApp.rawPrisma;
    const sale = await makeSale(2);
    await sign(sale);
    await payBoth(sale);
    await changePrice(sale, 1_115_000); // price 1,030,000: +750 commission top-up, +300 bonus
    const commission = await commissionOf(sale);
    const bonus = await bonusOf(sale);
    expect(await raw.brokerCommissionAdjustment.count({ where: { commissionId: commission.id, kind: 'TOP_UP' } })).toBe(1);
    const before = await leaderboardFor();

    await cancel(sale, 'CLAWBACK');
    const adjustments = await raw.brokerCommissionAdjustment.findMany({ where: { commissionId: commission.id } });
    // The top-up was never paid: gone. One clawback of what the broker got.
    expect(adjustments.map((a) => [a.kind, money(a.amount), a.settlesClawback])).toEqual([['CLAWBACK', '25000.00', true]]);
    expect(money((await commissionOf(sale)).clawbackAmount)).toBe('25000.00');
    const bonusAdjustments = await raw.bonusEntry.findMany({ where: { adjustsEntryId: bonus.id } });
    expect(bonusAdjustments.map((b) => b.status)).toEqual(['CANCELLED']);
    expect(money((await bonusOf(sale)).clawbackAmount)).toBe('10000.00');
    // 25,000 + the 750 top-up came off.
    expect(Math.round((before - (await leaderboardFor())) * 100)).toBe(2_575_000);
  });

  it('V2-3: CLAWBACK — a price-change clawback already netted out of a sent payout is not recovered twice', async () => {
    const raw = testApp.rawPrisma;
    const sale = await makeSale(3);
    await sign(sale);
    const paidPayoutId = await payBoth(sale);
    const commission = await commissionOf(sale);
    // A 1,000 clawback from a price change, already taken out of a paid payout.
    await raw.brokerCommissionAdjustment.create({
      data: { brokerId, commissionId: commission.id, kind: 'CLAWBACK', amount: 1_000, reason: 'V2 earlier price change', payoutId: paidPayoutId, companyId },
    });

    await cancel(sale, 'CLAWBACK');
    expect(money((await commissionOf(sale)).clawbackAmount)).toBe('24000.00');
    const settles = await raw.brokerCommissionAdjustment.findMany({ where: { commissionId: commission.id, settlesClawback: true } });
    expect(settles.map((a) => money(a.amount))).toEqual(['24000.00']);
  });

  it('V2-4: MANUAL — a bonus adjustment on the cancelled deal cannot be approved', async () => {
    const sale = await makeSale(4);
    await sign(sale);
    await payBoth(sale);
    await changePrice(sale, 1_115_000);
    const bonus = await bonusOf(sale);
    const adjustment = await testApp.rawPrisma.bonusEntry.findFirstOrThrow({ where: { adjustsEntryId: bonus.id } });

    await cancel(sale, 'MANUAL');
    await asAdmin(http().post(`/v1/bonus-entries/${adjustment.id}/approve`)).send({}).expect(409);
  });
});
