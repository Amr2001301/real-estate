/**
 * U2 — money: numbering, proofs after a plan change, amendments, payouts,
 * clawbacks and manual bonuses.
 *
 * - Commission and payout numbers run per company: another company holding
 *   the same COM-/PAY- number no longer blocks this one.
 * - A proof pays an installment only at its current amount and only while it
 *   is open: no approval at another amount, no resubmission after a price
 *   change or onto a row a reschedule cancelled.
 * - A reschedule cannot start in the past.
 * - A unit swap goes through the discount cap and the archived-project block.
 * - Releasing a cancelled contract's unit leaves it alone once it was sold
 *   again.
 * - Two admins acting on one payout at once: one wins, the other gets 409.
 * - A clawback cannot be collected above what is owed.
 * - A manual bonus needs a sales rep and a rule of this company.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  BrokerActivityType,
  ClawbackStatus,
  ContractStatus,
  DepositReviewStatus,
  DepositType,
  InstallmentStatus,
  PlanPaymentType,
  ProjectStatus,
  UnitStatus,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('U2 — money (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let otherCompanyId: string;
  let brokerId: string;
  const projectIds: string[] = [];
  const buildingIds: string[] = [];
  let unitId: string;
  let swapUnitId: string;
  let archivedUnitId: string;
  let templateId: string;
  let reservationId: string;
  let contractId: string;
  let planId: string;
  const payoutIds: string[] = [];
  const extraContractIds: string[] = [];
  const otherCommissionIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();
  const year = new Date().getFullYear();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const asCustomer = <T extends request.Test>(r: T) => r.set('Authorization', bearer(customerToken));
  const openMonthly = () =>
    testApp.rawPrisma.installment.findMany({
      where: { planId, type: PlanPaymentType.INSTALLMENT, status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] } },
      orderBy: { dueDate: 'asc' },
    });
  /** The next number this company would draw for `prefix` (max + 1). */
  const nextNumber = (prefix: string, used: string[]) => {
    const max = used.reduce((m, n) => Math.max(m, parseInt(n.slice(prefix.length), 10) || 0), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  };
  const proofDeposit = (installment: { id: string; amount: unknown }, data: Record<string, unknown>) =>
    testApp.rawPrisma.deposit.create({
      data: {
        companyId,
        type: DepositType.INSTALLMENT,
        contractId,
        installmentId: installment.id,
        amount: installment.amount as never,
        paidAt: new Date(),
        receiptUrl: `https://example.invalid/receipts/u2-${stamp}.pdf`,
        recordedById: fixtures.userIds.customer1UserId,
        verified: false,
        ...data,
      },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    customerToken = await loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    otherCompanyId = (
      await raw.company.create({ data: { name: `U2 Other ${stamp}`, slug: `u2-other-${stamp}` }, select: { id: true } })
    ).id;
    brokerId = (await raw.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 }, select: { id: true } })).id;

    const makeProject = async (code: string, status: ProjectStatus) => {
      const project = await raw.project.create({
        data: {
          companyId,
          code: `${code}-${stamp}`,
          name: { ar: 'مشروع', en: `U2 ${code}` },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status,
        },
      });
      projectIds.push(project.id);
      const phase = await raw.phase.create({ data: { companyId, projectId: project.id, code: `${code}-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
      const building = await raw.building.create({ data: { companyId, phaseId: phase.id, code: `${code}-B-${stamp}`, name: 'B' } });
      buildingIds.push(building.id);
      return { projectId: project.id, buildingId: building.id };
    };
    const makeUnit = async (bId: string, code: string, price: number) =>
      (
        await raw.unit.create({
          data: {
            companyId,
            buildingId: bId,
            code: `${code}-${stamp}`,
            type: 'APARTMENT',
            area: 100,
            bedrooms: 2,
            bathrooms: 1,
            floor: 1,
            price,
            status: UnitStatus.AVAILABLE,
          },
        })
      ).id;
    const live = await makeProject('U2', ProjectStatus.PUBLISHED);
    unitId = await makeUnit(live.buildingId, 'U2-U', 1_000_000);
    swapUnitId = await makeUnit(live.buildingId, 'U2-S', 1_500_000);
    const archived = await makeProject('U2A', ProjectStatus.ARCHIVED);
    archivedUnitId = await makeUnit(archived.buildingId, 'U2A-U', 1_000_000);

    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: 'U2 plan',
      projectId: live.projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    templateId = tpl.body.id;
    const option = await raw.installmentPlanDurationOption.findFirstOrThrow({ where: { planId: templateId } });
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: templateId,
        installmentPlanDurationOptionId: option.id,
        expiresInHours: 72,
      })
      .expect(201);
    reservationId = created.body.id ?? created.body.reservation?.id;
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({ startsAt: '2027-01-15' }).expect(201);
    const contract = await raw.contract.findFirstOrThrow({
      where: { reservationId },
      select: { id: true, installmentPlan: { select: { id: true } } },
    });
    contractId = contract.id;
    planId = contract.installmentPlan!.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.setting.deleteMany({ where: { companyId, key: 'pricing.maxDiscountPct' } });
    await raw.bonusEntry.deleteMany({ where: { createdAt: { gte: startedAt }, period: '2099-01' } });
    await raw.bonusRule.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.brokerActivityLog.deleteMany({ where: { entityId: { in: payoutIds } } });
    await raw.brokerCommission.updateMany({ where: { payoutId: { in: payoutIds } }, data: { payoutId: null } });
    await raw.brokerPayout.deleteMany({ where: { id: { in: payoutIds } } });
    await raw.brokerPayout.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.brokerCommission.deleteMany({ where: { id: { in: otherCommissionIds } } });
    if (contractId) {
      const deposits = await raw.deposit.findMany({ where: { contractId }, select: { paymentInstrumentId: true } });
      await raw.document.deleteMany({ where: { ownerType: 'DEPOSIT', createdAt: { gte: startedAt }, title: { contains: 'إثبات' } } });
      await raw.deposit.deleteMany({ where: { contractId } });
      const instruments = deposits.map((d) => d.paymentInstrumentId).filter((x): x is string => !!x);
      await raw.paymentInstrument.deleteMany({ where: { id: { in: instruments } } });
      await raw.bonusEntry.deleteMany({ where: { contractId } });
      await raw.brokerCommission.deleteMany({ where: { contractId } });
      await raw.contractAmendment.deleteMany({ where: { contractId } });
      await raw.contractCancellation.deleteMany({ where: { contractId } });
      if (planId) {
        await raw.installment.deleteMany({ where: { planId } });
        await raw.installmentPlan.deleteMany({ where: { id: planId } });
      }
      await raw.contract.deleteMany({ where: { id: { in: [contractId, ...extraContractIds] } } });
    }
    await raw.auditLog.deleteMany({ where: { entityId: { in: [contractId, unitId, swapUnitId].filter(Boolean) }, createdAt: { gte: startedAt } } });
    if (reservationId) {
      await raw.deposit.deleteMany({ where: { reservationId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId } });
      await raw.reservation.deleteMany({ where: { id: reservationId } });
    }
    if (templateId) {
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: templateId } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: templateId } });
    }
    const unitIds = [unitId, swapUnitId, archivedUnitId].filter(Boolean);
    await raw.unitMaintenanceItem.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { buildingId: { in: buildingIds } } });
    await raw.building.deleteMany({ where: { id: { in: buildingIds } } });
    await raw.phase.deleteMany({ where: { projectId: { in: projectIds } } });
    await raw.project.deleteMany({ where: { id: { in: projectIds } } });
    if (otherCompanyId) await raw.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('U2-1a: a payout number another company already uses does not block this one', async () => {
    const raw = testApp.rawPrisma;
    const prefix = `PAY-${year}-`;
    const ours = await raw.brokerPayout.findMany({ where: { companyId, payoutNumber: { startsWith: prefix } }, select: { payoutNumber: true } });
    const expected = nextNumber(prefix, ours.map((p) => p.payoutNumber));
    await raw.brokerPayout.create({ data: { companyId: otherCompanyId, brokerId, payoutNumber: expected } });

    const res = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId });
    expect(res.status).toBe(201);
    payoutIds.push(res.body.id);
    expect(res.body.payoutNumber).toBe(expected);
  });

  it('U2-1b: a commission number another company already uses does not block materialization', async () => {
    const raw = testApp.rawPrisma;
    // This sale is now a broker sale at 2.5%.
    await raw.reservation.update({ where: { id: reservationId }, data: { brokerId, commissionLockedPct: 2.5 } });
    await raw.contract.update({ where: { id: contractId }, data: { brokerId } });
    const prefix = `COM-${year}-`;
    const ours = await raw.brokerCommission.findMany({ where: { companyId, commissionNumber: { startsWith: prefix } }, select: { commissionNumber: true } });
    const expected = nextNumber(prefix, ours.map((c) => c.commissionNumber));
    const anyFree = await raw.contract.findFirstOrThrow({
      where: { brokerCommission: null, id: { not: contractId } },
      select: { id: true, unitId: true },
    });
    const foreign = await raw.brokerCommission.create({
      data: {
        companyId: otherCompanyId,
        commissionNumber: expected,
        brokerId,
        contractId: anyFree.id,
        unitId: anyFree.unitId,
        projectId: projectIds[0]!,
        basisAmount: 1,
        grossAmount: 1,
        netAmount: 1,
        earnedAt: new Date(),
      },
    });
    otherCommissionIds.push(foreign.id);

    await asAdmin(http().post(`/v1/contracts/${contractId}/sign`)).send({ signedAt: new Date().toISOString() }).expect(201);
    const commission = await raw.brokerCommission.findUnique({ where: { contractId } });
    expect(commission).not.toBeNull();
    expect(commission!.commissionNumber).toBe(expected);
    expect(commission!.companyId).toBe(companyId);
  });

  it('U2-6: a reschedule cannot start in the past', async () => {
    const before = (await openMonthly()).length;
    await asAdmin(http().post(`/v1/contracts/${contractId}/reschedule`))
      .send({ months: 6, startsAt: '2020-01-31', reason: 'start date already passed' })
      .expect(400);
    expect((await openMonthly()).length).toBe(before);
  });

  it('U2-2a: a proof is not approved at an amount other than the installment', async () => {
    const [row] = await openMonthly();
    const proof = await proofDeposit(row!, {
      amount: Number(row!.amount) - 1,
      reviewStatus: DepositReviewStatus.PENDING_REVIEW,
    });
    await asAdmin(http().post(`/v1/deposits/${proof.id}/approve`)).send({}).expect(409);
    const after = await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id: row!.id } });
    expect(after.status).toBe(InstallmentStatus.PENDING);
    await testApp.rawPrisma.deposit.delete({ where: { id: proof.id } });
  });

  it('U2-2b: a rejected proof cannot be resubmitted after the price changed', async () => {
    const [row] = await openMonthly();
    const proof = await proofDeposit(row!, { reviewStatus: DepositReviewStatus.REJECTED, rejectionReason: 'blurry' });
    await asAdmin(http().post(`/v1/contracts/${contractId}/price`))
      .send({ totalAmount: 960_000, reason: 'loyalty discount' })
      .expect(201);
    const res = await asCustomer(http().post(`/v1/me/deposits/${proof.id}/resubmit`)).send({
      paymentMethod: 'BANK_TRANSFER',
      receiptUrl: `https://example.invalid/receipts/u2-again-${stamp}.pdf`,
    });
    expect(res.status).toBe(409);
    const still = await testApp.rawPrisma.deposit.findUniqueOrThrow({ where: { id: proof.id } });
    expect(still.reviewStatus).toBe(DepositReviewStatus.REJECTED);
    await testApp.rawPrisma.deposit.delete({ where: { id: proof.id } });
  });

  it('U2-2c: a rejected proof cannot be resubmitted onto a row a reschedule cancelled', async () => {
    const [row] = await openMonthly();
    const proof = await proofDeposit(row!, { reviewStatus: DepositReviewStatus.REJECTED, rejectionReason: 'blurry' });
    await asAdmin(http().post(`/v1/contracts/${contractId}/reschedule`))
      .send({ months: 8, startsAt: '2027-06-30', reason: 'customer asked for fewer months' })
      .expect(201);
    expect((await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id: row!.id } })).status).toBe(
      InstallmentStatus.CANCELLED,
    );
    const res = await asCustomer(http().post(`/v1/me/deposits/${proof.id}/resubmit`)).send({
      paymentMethod: 'BANK_TRANSFER',
      receiptUrl: `https://example.invalid/receipts/u2-cancelled-${stamp}.pdf`,
    });
    expect(res.status).toBe(409);
    const still = await testApp.rawPrisma.deposit.findUniqueOrThrow({ where: { id: proof.id } });
    expect(still.reviewStatus).toBe(DepositReviewStatus.REJECTED);
    await testApp.rawPrisma.deposit.delete({ where: { id: proof.id } });
  });

  it('U2-4: a unit swap is refused onto an archived project and goes through the discount cap', async () => {
    await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
      .send({ unitId: archivedUnitId, totalAmount: 960_000, reason: 'customer prefers the other block' })
      .expect(400);
    expect((await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: contractId } })).unitId).toBe(unitId);

    await asAdmin(http().patch('/v1/settings/pricing.maxDiscountPct')).send({ value: 5 }).expect(200);
    // 960,000 on a 1,500,000 unit is 36% off: allowed only through the
    // approve-discount permission, and on record.
    await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
      .send({ unitId: swapUnitId, totalAmount: 960_000, reason: 'customer prefers the bigger unit' })
      .expect(201);
    const log = await testApp.rawPrisma.auditLog.findFirst({
      where: { action: 'pricing.discount-approved', entityId: contractId, createdAt: { gte: startedAt } },
    });
    expect(log).not.toBeNull();
  });

  it('U2-5: releasing the unit of a cancelled contract leaves it alone once sold again', async () => {
    const raw = testApp.rawPrisma;
    await asAdmin(http().post(`/v1/contracts/${contractId}/cancel`))
      .send({ reason: 'customer withdrew', retainedAmount: 0, refundAmount: 0, unitReleaseOverride: 'REQUIRES_APPROVAL' })
      .expect(201);
    expect((await raw.unit.findUniqueOrThrow({ where: { id: swapUnitId } })).status).toBe(UnitStatus.SOLD);
    // The unit was sold to someone else before anyone released it.
    const resale = await raw.contract.create({
      data: {
        companyId,
        unitId: swapUnitId,
        customerId: fixtures.userIds.customer1UserId,
        totalAmount: 1_500_000,
        status: ContractStatus.ACTIVE,
        signedAt: new Date(),
      },
    });
    extraContractIds.push(resale.id);

    await asAdmin(http().post(`/v1/contracts/${contractId}/release-unit`)).send({}).expect(201);
    expect((await raw.unit.findUniqueOrThrow({ where: { id: swapUnitId } })).status).toBe(UnitStatus.SOLD);
    const cc = await raw.contractCancellation.findUniqueOrThrow({ where: { contractId } });
    expect(cc.unitReleasedAt).not.toBeNull();
  });

  it('U2-7: two admins cancelling one payout at once — one succeeds, one gets 409', async () => {
    const created = await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId }).expect(201);
    payoutIds.push(created.body.id);
    const cancel = () =>
      asAdmin(http().patch(`/v1/broker-payouts/${created.body.id}/cancel`)).send({ reason: 'duplicate draft' });
    const statuses = (await Promise.all([cancel(), cancel()])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    const logged = await testApp.rawPrisma.brokerActivityLog.count({
      where: { entityId: created.body.id, type: BrokerActivityType.PAYOUT_CANCELLED },
    });
    expect(logged).toBe(1);
  });

  it('U2-8: a clawback cannot be collected above what is owed', async () => {
    const raw = testApp.rawPrisma;
    const commission = await raw.brokerCommission.findUniqueOrThrow({ where: { contractId } });
    await raw.brokerCommission.update({
      where: { id: commission.id },
      data: { clawbackStatus: ClawbackStatus.OUTSTANDING, clawbackReason: 'u2', clawbackAt: new Date() },
    });
    await asAdmin(http().post(`/v1/broker-commissions/${commission.id}/clawback/collect`))
      .send({ amount: Number(commission.netAmount) + 1000, paymentMethod: 'CASH' })
      .expect(400);
    const after = await raw.brokerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(after.clawbackStatus).toBe(ClawbackStatus.OUTSTANDING);
    expect(after.clawbackCollectedAmount).toBeNull();
  });

  it('U2-13: a manual bonus needs a rule of this company and a sales rep', async () => {
    const foreignRule = await testApp.rawPrisma.bonusRule.create({
      data: { companyId: otherCompanyId, name: `U2 foreign ${stamp}`, percentage: 1 },
    });
    await asAdmin(http().post('/v1/bonus-entries'))
      .send({ salesId: fixtures.userIds.salesId, ruleId: foreignRule.id, amount: 1000, period: '2099-01' })
      .expect(404);
    const ownRule = await asAdmin(http().post('/v1/bonus-rules')).send({ name: `U2 own ${stamp}`, percentage: 1 }).expect(201);
    try {
      await asAdmin(http().post('/v1/bonus-entries'))
        .send({ salesId: fixtures.userIds.broker1UserId, ruleId: ownRule.body.id, amount: 1000, period: '2099-01' })
        .expect(404);
      await asAdmin(http().post('/v1/bonus-entries'))
        .send({ salesId: fixtures.userIds.salesId, ruleId: ownRule.body.id, amount: 1000, period: '2099-01' })
        .expect(201);
    } finally {
      await testApp.rawPrisma.bonusEntry.deleteMany({ where: { ruleId: ownRule.body.id } });
      await testApp.rawPrisma.bonusRule.deleteMany({ where: { id: ownRule.body.id } });
    }
  });
});
