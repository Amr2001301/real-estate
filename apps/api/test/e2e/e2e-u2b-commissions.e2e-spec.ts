/**
 * U2b — broker commissions and sales bonuses follow the deal (decisions of
 * 2026-10-16).
 *
 * - Both are computed on the price after discount, without the instalment
 *   markup.
 * - A price change sends an approved commission / bonus back for approval
 *   with its new amount.
 * - Once paid, a price change adds the difference: a CLAWBACK or TOP_UP
 *   adjustment netted into the broker's next payout, an ADJUSTMENT bonus
 *   entry for the sales rep.
 * - RETAIN on cancellation keeps the commission payable.
 * - A broker suspended before signing still earns a sale reserved while
 *   active; one reserved afterwards waits (failed sign follow-up) and is
 *   created when the broker is reactivated.
 * - A cancelled deal's paid commission comes back out of the broker's next
 *   payouts (decided 2026-10-17), split across them when it does not fit.
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

describe('U2b — commissions & bonuses follow the deal (e2e)', () => {
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
          code: `CB-U${n}-${stamp}`,
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
      name: `CB plan ${n}`,
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
          code: `CB-${stamp}`,
          name: { ar: 'مشروع', en: 'CB Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `CB-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `CB-B-${stamp}`, name: 'B' } })).id;
    // Exactly one active auto-apply rule drives the sales bonus: ours, 1%.
    const others = await raw.bonusRule.findMany({
      where: { companyId, active: true, autoApplyOnSignedContract: true },
      select: { id: true },
    });
    pausedRuleIds = others.map((r) => r.id);
    await raw.bonusRule.updateMany({ where: { id: { in: pausedRuleIds } }, data: { active: false } });
    ruleId = (
      await asAdmin(http().post('/v1/bonus-rules'))
        .send({ name: `CB auto ${stamp}`, percentage: 1, active: true, autoApplyOnSignedContract: true })
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

  describe('one sale through its price changes', () => {
    let sale: Sale;

    beforeAll(async () => {
      sale = await makeSale(1);
      await sign(sale);
    });

    it('CB-1: commission and bonus are on the price after discount, without the instalment markup', async () => {
      const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: sale.contractId } });
      expect(money(contract.totalAmount)).toBe('1085000.00'); // 1,000,000 + 10% on the 850,000 financed
      const commission = await commissionOf(sale);
      expect(money(commission.basisAmount)).toBe('1000000.00');
      expect(money(commission.netAmount)).toBe('25000.00');
      const bonus = await bonusOf(sale);
      expect(money(bonus.basisAmount)).toBe('1000000.00');
      expect(money(bonus.amount)).toBe('10000.00');
    });

    it('CB-2: an approved commission and bonus go back for approval at the new price', async () => {
      const commission = await commissionOf(sale);
      await asAdmin(http().patch(`/v1/broker-commissions/${commission.id}/approve`)).send({}).expect(200);
      const bonus = await bonusOf(sale);
      await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/approve`)).send({}).expect(201);

      await changePrice(sale, 1_075_000); // price 990,000
      const after = await commissionOf(sale);
      expect(after.status).toBe('PENDING');
      expect(money(after.netAmount)).toBe('24750.00');
      const bonusAfter = await bonusOf(sale);
      expect(bonusAfter.status).toBe('PENDING');
      expect(money(bonusAfter.amount)).toBe('9900.00');
    });

    it('CB-3: after payment the difference is a clawback / top-up, netted into the next payout', async () => {
      const raw = testApp.rawPrisma;
      const commission = await commissionOf(sale);
      await asAdmin(http().patch(`/v1/broker-commissions/${commission.id}/approve`)).send({}).expect(200);
      const payout = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [commission.id] }).expect(201);
      payoutIds.push(payout.body.id);
      await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/approve`)).send({}).expect(200);
      await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/process`)).send({}).expect(200);
      await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/mark-paid`)).send({ paymentMethod: 'BANK_TRANSFER' }).expect(200);
      const bonus = await bonusOf(sale);
      await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/approve`)).send({}).expect(201);
      await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/pay`)).send({}).expect(201);

      await changePrice(sale, 1_035_000); // price 950,000: commission 23,750, bonus 9,500
      const paid = await commissionOf(sale);
      expect(money(paid.netAmount)).toBe('24750.00'); // stays as paid
      const clawbacks = await raw.brokerCommissionAdjustment.findMany({ where: { commissionId: paid.id } });
      expect(clawbacks.map((a) => [a.kind, money(a.amount)])).toEqual([['CLAWBACK', '1000.00']]);
      const bonusDown = await raw.bonusEntry.findMany({ where: { adjustsEntryId: bonus.id } });
      expect(bonusDown.map((b) => [b.source, money(b.amount), b.status])).toEqual([['ADJUSTMENT', '-400.00', 'PENDING']]);

      await changePrice(sale, 1_115_000); // price 1,030,000: commission 25,750, bonus 10,300
      const adjustments = await raw.brokerCommissionAdjustment.findMany({ where: { commissionId: paid.id }, orderBy: { createdAt: 'asc' } });
      expect(adjustments.map((a) => [a.kind, money(a.amount)])).toEqual([
        ['CLAWBACK', '1000.00'],
        ['TOP_UP', '2000.00'],
      ]);
      const bonusUp = await raw.bonusEntry.findMany({ where: { adjustsEntryId: bonus.id }, orderBy: { createdAt: 'asc' } });
      expect(bonusUp.map((b) => money(b.amount))).toEqual(['-400.00', '800.00']);

      // The next payout nets them: +2,000 − 1,000.
      const next = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId }).expect(201);
      payoutIds.push(next.body.id);
      expect(money(next.body.totalNet)).toBe('1000.00');
      expect(next.body.adjustments).toHaveLength(2);
      // Cancelling it gives them back for the following payout.
      await asAdmin(http().patch(`/v1/broker-payouts/${next.body.id}/cancel`)).send({ reason: 'redo' }).expect(200);
      expect(await raw.brokerCommissionAdjustment.count({ where: { commissionId: paid.id, payoutId: null } })).toBe(2);
    });
  });

  it('CB-4: RETAIN on cancellation keeps the commission payable', async () => {
    const sale = await makeSale(2);
    await sign(sale);
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancel`))
      .send({ reason: 'customer withdrew', retainedAmount: 0, refundAmount: 0, commissionActionOverride: 'RETAIN', bonusActionOverride: 'RETAIN' })
      .expect(201);
    const commission = await commissionOf(sale);
    expect(commission.status).toBe('PENDING');
    expect(commission.retainedOnCancellation).toBe(true);
    await asAdmin(http().patch(`/v1/broker-commissions/${commission.id}/approve`)).send({}).expect(200);
    const payout = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [commission.id] }).expect(201);
    payoutIds.push(payout.body.id);
    expect(payout.body.commissions.map((c: { id: string }) => c.id)).toContain(commission.id);
    const bonus = await bonusOf(sale);
    await asAdmin(http().post(`/v1/bonus-entries/${bonus.id}/approve`)).send({}).expect(201);
  });

  it('CB-5: a broker suspended before signing earns a sale reserved while active; a later one waits for reactivation', async () => {
    const raw = testApp.rawPrisma;
    const before = await makeSale(3); // reserved while the broker is active
    await asAdmin(http().post(`/v1/brokers/${brokerId}/suspend`)).send({ reason: 'U2b audit' }).expect(201);
    expect((await raw.broker.findUniqueOrThrow({ where: { id: brokerId } })).suspendedAt).not.toBeNull();
    await sign(before);
    expect(await raw.brokerCommission.findUnique({ where: { contractId: before.contractId } })).not.toBeNull();

    const after = await makeSale(4); // reserved after the suspension
    await sign(after);
    expect(await raw.brokerCommission.findUnique({ where: { contractId: after.contractId } })).toBeNull();
    const followup = await raw.auditLog.findFirst({
      where: { entityId: after.contractId, action: 'contract.sign_followup_failed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(followup).not.toBeNull();

    await asAdmin(http().patch(`/v1/brokers/${brokerId}/status`)).send({ status: 'ACTIVE' }).expect(200);
    expect(await raw.brokerCommission.findUnique({ where: { contractId: after.contractId } })).not.toBeNull();
    expect((await raw.broker.findUniqueOrThrow({ where: { id: brokerId } })).suspendedAt).toBeNull();
  });

  it('CB-6: a cancelled deal\'s paid commission is clawed back from the next payouts', async () => {
    const raw = testApp.rawPrisma;
    // Sale 5: commission 25,000 paid.
    const cancelled = await makeSale(5);
    await sign(cancelled);
    const paidCommission = await commissionOf(cancelled);
    await asAdmin(http().patch(`/v1/broker-commissions/${paidCommission.id}/approve`)).send({}).expect(200);
    const first = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [paidCommission.id] }).expect(201);
    payoutIds.push(first.body.id);
    expect(money(first.body.totalNet)).toBe('25000.00');
    await asAdmin(http().patch(`/v1/broker-payouts/${first.body.id}/approve`)).send({}).expect(200);
    await asAdmin(http().patch(`/v1/broker-payouts/${first.body.id}/process`)).send({}).expect(200);
    await asAdmin(http().patch(`/v1/broker-payouts/${first.body.id}/mark-paid`)).send({ paymentMethod: 'BANK_TRANSFER' }).expect(200);
    // Sale 6: commission 10,000 (1%), approved.
    const next = await makeSale(6, 1);
    await sign(next);
    const nextCommission = await commissionOf(next);
    await asAdmin(http().patch(`/v1/broker-commissions/${nextCommission.id}/approve`)).send({}).expect(200);

    await asAdmin(http().post(`/v1/contracts/${cancelled.contractId}/cancel`))
      .send({ reason: 'customer withdrew', retainedAmount: 0, refundAmount: 0, commissionActionOverride: 'CLAWBACK', bonusActionOverride: 'CLAWBACK' })
      .expect(201);
    expect((await commissionOf(cancelled)).clawbackStatus).toBe('OUTSTANDING');
    const queued = () =>
      raw.brokerCommissionAdjustment.findMany({ where: { commissionId: paidCommission.id }, orderBy: { amount: 'asc' } });
    expect((await queued()).map((a) => [money(a.amount), a.payoutId])).toEqual([['25000.00', null]]);

    // The next payout (10,000) takes 10,000 of it; 15,000 waits.
    const draft = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [nextCommission.id] }).expect(201);
    payoutIds.push(draft.body.id);
    expect(money(draft.body.totalNet)).toBe('0.00');
    expect((await queued()).map((a) => [money(a.amount), a.payoutId])).toEqual([
      ['10000.00', draft.body.id],
      ['15000.00', null],
    ]);
    // Cancelling that payout gives it all back, in one piece.
    await asAdmin(http().patch(`/v1/broker-payouts/${draft.body.id}/cancel`)).send({ reason: 'redo' }).expect(200);
    expect((await queued()).map((a) => [money(a.amount), a.payoutId])).toEqual([['25000.00', null]]);

    const payout = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId, commissionIds: [nextCommission.id] }).expect(201);
    payoutIds.push(payout.body.id);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/approve`)).send({}).expect(200);
    // Not waived while an approved payout deducts part of it.
    await asAdmin(http().post(`/v1/broker-commissions/${paidCommission.id}/clawback/waive`)).send({ reason: 'goodwill' }).expect(409);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/process`)).send({}).expect(200);
    await asAdmin(http().patch(`/v1/broker-payouts/${payout.body.id}/mark-paid`)).send({ paymentMethod: 'BANK_TRANSFER' }).expect(200);
    const afterPay = await commissionOf(cancelled);
    expect(afterPay.clawbackStatus).toBe('PARTIALLY_COLLECTED');
    expect(money(afterPay.clawbackCollectedAmount)).toBe('10000.00');

    // Collected by hand: that much leaves the queue; waived: the rest.
    await asAdmin(http().post(`/v1/broker-commissions/${paidCommission.id}/clawback/collect`))
      .send({ amount: 5000, paymentMethod: 'CASH' })
      .expect(201);
    expect((await queued()).filter((a) => a.payoutId === null).map((a) => money(a.amount))).toEqual(['10000.00']);
    await asAdmin(http().post(`/v1/broker-commissions/${paidCommission.id}/clawback/waive`)).send({ reason: 'goodwill' }).expect(201);
    expect((await queued()).filter((a) => a.payoutId === null)).toHaveLength(0);
    expect((await commissionOf(cancelled)).clawbackStatus).toBe('WAIVED');
  });
});
