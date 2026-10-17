/**
 * V1 — the customer's schedule adds up, and cancellation money stays within
 * what was collected (numbers audit, 2026-10-17).
 *
 * - The schedule is built on the booking the customer actually pays (a
 *   percentage of the unit price, or an admin's amount), so booking + rows =
 *   contract price.
 * - A plan made later on a plan-less contract leaves out the booking.
 * - No rows of 0.00; a template's final payment must fit in the price.
 * - The booking amount can't change once paid.
 * - The discount cap sees the sale price without the instalment markup.
 * - Refund + retained ≤ collected.
 * - A payment approved again after a reversal pays and counts again.
 */
import 'reflect-metadata';
import request from 'supertest';
import { InstallmentStatus, PlanPaymentType, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { COLLECTED_DEPOSIT_WHERE } from '../../src/common/finance/collected';

describe('V1 — schedule money and cancellation (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let units: Array<{ id: string; price: number; projectId: string }> = [];
  const templateIds: string[] = [];
  const reservationIds: string[] = [];
  let capBefore: unknown;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const cents = (v: unknown) => Math.round(Number(v) * 100);

  async function template(unit: (typeof units)[number], body: Record<string, unknown>) {
    const res = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: `V1 plan ${templateIds.length}`,
      projectId: unit.projectId,
      unitId: unit.id,
      totalPrice: unit.price,
      downPaymentType: 'FIXED',
      downPaymentValue: Math.round(unit.price * 0.1),
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      ...body,
    });
    if (res.status !== 201) throw new Error(`template: ${JSON.stringify(res.body)}`);
    templateIds.push(res.body.id);
    return testApp.rawPrisma.installmentPlanTemplate.findUniqueOrThrow({
      where: { id: res.body.id },
      select: { id: true, durationOptions: { select: { id: true } } },
    });
  }

  async function reserve(body: Record<string, unknown>) {
    const res = await asAdmin(http().post('/v1/reservations'))
      .send({ clientId: fixtures.userIds.customer1UserId, expiresInHours: 72, ...body })
      .expect(201);
    const id: string = res.body.id ?? res.body.reservation?.id;
    reservationIds.push(id);
    return id;
  }

  async function convert(reservationId: string, startsAt?: string) {
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`))
      .send(startsAt ? { startsAt } : {})
      .expect(201);
    return testApp.rawPrisma.contract.findFirstOrThrow({ where: { reservationId }, select: { id: true, totalAmount: true } });
  }

  const rowsOf = (contractId: string) =>
    testApp.rawPrisma.installment.findMany({
      where: { plan: { contractId } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, amount: true, status: true, type: true },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    const found = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, planTemplates: { none: {} }, price: { gt: 500_000 } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, price: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    if (found.length < 4) throw new Error('V1 needs 4 available units');
    units = found.map((u) => ({ id: u.id, price: Number(u.price), projectId: u.building.phase.projectId }));
    capBefore = (await raw.setting.findFirst({ where: { companyId, key: 'pricing.maxDiscountPct' } }))?.value;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    if (capBefore === undefined) await raw.setting.deleteMany({ where: { companyId, key: 'pricing.maxDiscountPct' } });
    for (const reservationId of reservationIds) {
      const contract = await raw.contract.findFirst({ where: { reservationId }, select: { id: true } });
      if (contract) {
        await raw.paymentCorrection.deleteMany({ where: { deposit: { contractId: contract.id } } });
        await raw.deposit.deleteMany({ where: { contractId: contract.id } });
        await raw.contractCancellation.deleteMany({ where: { contractId: contract.id } });
        await raw.contractAmendment.deleteMany({ where: { contractId: contract.id } });
        await raw.auditLog.deleteMany({ where: { entityId: contract.id } });
        await raw.installment.updateMany({ where: { plan: { contractId: contract.id } }, data: { lastCorrectionId: null } });
        await raw.installment.deleteMany({ where: { plan: { contractId: contract.id }, feeForId: { not: null } } });
        await raw.installment.deleteMany({ where: { plan: { contractId: contract.id } } });
        await raw.installmentPlan.deleteMany({ where: { contractId: contract.id } });
        await raw.contract.delete({ where: { id: contract.id } });
      }
      await raw.deposit.deleteMany({ where: { reservationId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId } });
      await raw.reservation.delete({ where: { id: reservationId } });
    }
    for (const id of templateIds) {
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: id } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: id } });
      await raw.installmentPlanTemplate.delete({ where: { id } });
    }
    for (const u of units) {
      await raw.unitStatusHistory.deleteMany({ where: { unitId: u.id, changedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
      await raw.unit.update({ where: { id: u.id }, data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null } });
    }
  });

  it('V1-1: a percentage booking on a discounted plan — booking + rows = contract; a price cut cancels rows, never 0.00; refund ≤ collected', async () => {
    const unit = units[0]!;
    const tpl = await template(unit, {
      discountType: 'FIXED',
      discountValue: Math.round(unit.price * 0.05),
      reservationAmountType: 'PERCENTAGE',
      reservationAmountValue: 10,
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
    });
    const reservationId = await reserve({
      unitId: unit.id,
      installmentPlanTemplateId: tpl.id,
      installmentPlanDurationOptionId: tpl.durationOptions[0]!.id,
    });
    const booking = (await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).bookingAmount;
    const contract = await convert(reservationId, '2027-01-01');
    let rows = await rowsOf(contract.id);
    expect(cents(booking) + rows.reduce((a, r) => a + cents(r.amount), 0)).toBe(cents(contract.totalAmount));

    // Cut the price by everything still open: the open rows owe nothing now.
    const open = rows.reduce((a, r) => a + cents(r.amount), 0);
    await asAdmin(http().post(`/v1/contracts/${contract.id}/price`))
      .send({ totalAmount: (cents(contract.totalAmount) - open) / 100, reason: 'V1 zero rows' })
      .expect(201);
    rows = await rowsOf(contract.id);
    expect(rows.filter((r) => cents(r.amount) === 0 && r.status !== InstallmentStatus.CANCELLED)).toEqual([]);
    expect(rows.every((r) => r.status === InstallmentStatus.CANCELLED)).toBe(true);

    // Only the booking was collected: a refund above it is refused.
    const res = await asAdmin(http().post(`/v1/contracts/${contract.id}/cancel`))
      .send({ reason: 'V1 refund cap', retainedAmount: 0, refundAmount: Number(booking) + 1 })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('المحصّل');
  });

  it('V1-2: a plan made later on a plan-less contract leaves out the booking already paid', async () => {
    const unit = units[1]!;
    const reservationId = await reserve({ unitId: unit.id, bookingAmount: 100_000 });
    const contract = await convert(reservationId);
    await asAdmin(http().post('/v1/installment-plans'))
      .send({ contractId: contract.id, totalMonths: 10, startsAt: '2027-02-01' })
      .expect(201);
    const rows = await rowsOf(contract.id);
    expect(100_000 * 100 + rows.reduce((a, r) => a + cents(r.amount), 0)).toBe(cents(contract.totalAmount));

    // V1-6 on the same contract: un-verify a payment, verify it again — the
    // installment is paid and the money is collected again.
    const row = rows.find((r) => r.type === PlanPaymentType.INSTALLMENT)!;
    const dep = await asAdmin(http().post('/v1/deposits'))
      .send({ contractId: contract.id, installmentId: row.id, amount: Number(row.amount), paymentMethod: 'CASH' })
      .expect(201);
    const depositId: string = dep.body.id;
    await asAdmin(http().patch(`/v1/deposits/${depositId}/verify`)).send({ verified: true }).expect(200);
    await asAdmin(http().patch(`/v1/deposits/${depositId}/verify`)).send({ verified: false }).expect(200);
    expect((await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(InstallmentStatus.PENDING);
    await asAdmin(http().patch(`/v1/deposits/${depositId}/verify`)).send({ verified: true }).expect(200);
    expect((await testApp.rawPrisma.installment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(InstallmentStatus.PAID);
    expect(await testApp.rawPrisma.deposit.count({ where: { id: depositId, ...COLLECTED_DEPOSIT_WHERE } })).toBe(1);
  });

  it('V1-3: a template whose booking + down + final payment pass the price is refused', async () => {
    const unit = units[2]!;
    const res = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: 'V1 final too big',
      projectId: unit.projectId,
      unitId: unit.id,
      totalPrice: unit.price,
      reservationAmount: Math.round(unit.price * 0.1),
      downPaymentType: 'FIXED',
      downPaymentValue: Math.round(unit.price * 0.4),
      finalPaymentAmount: Math.round(unit.price * 0.6),
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
    });
    if (res.status === 201) templateIds.push(res.body.id);
    expect(res.status).toBe(400);
  });

  it('V1-4: changing the booking amount rebuilds the schedule; not once the booking is paid', async () => {
    const unit = units[2]!;
    const tpl = await template(unit, {
      reservationAmount: 50_000,
      finalPaymentAmount: Math.round(unit.price * 0.1),
      durationOptions: [{ durationMonths: 24, increasePercentage: 10 }],
    });
    const reservationId = await reserve({
      unitId: unit.id,
      installmentPlanTemplateId: tpl.id,
      installmentPlanDurationOptionId: tpl.durationOptions[0]!.id,
    });
    await asAdmin(http().patch(`/v1/reservations/${reservationId}`)).send({ bookingAmount: 20_000 }).expect(200);
    const r = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    const down = Math.round(unit.price * 0.1);
    const final = Math.round(unit.price * 0.1);
    expect(cents(r.snapshotRemainingAmount)).toBe((unit.price - 20_000 - down - final) * 100);
    expect(cents(r.snapshotTotalPayable)).toBe(
      cents(r.bookingAmount) + cents(r.snapshotDownPaymentAmount) + cents(r.snapshotFinancedAmount) + cents(r.snapshotFinalPaymentAmount),
    );

    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().patch(`/v1/reservations/${reservationId}`)).send({ bookingAmount: 30_000 }).expect(400);
  });

  it('V1-5: the discount cap sees the price without the instalment markup', async () => {
    const unit = units[3]!;
    const tpl = await template(unit, {
      reservationAmount: 50_000,
      durationOptions: [{ durationMonths: 36, increasePercentage: 20 }],
    });
    const reservationId = await reserve({
      unitId: unit.id,
      installmentPlanTemplateId: tpl.id,
      installmentPlanDurationOptionId: tpl.durationOptions[0]!.id,
    });
    const contract = await convert(reservationId, '2027-01-01');
    expect(Number(contract.totalAmount)).toBeGreaterThan(unit.price);
    await testApp.rawPrisma.setting.upsert({
      where: { companyId_key: { companyId, key: 'pricing.maxDiscountPct' } },
      create: { companyId, key: 'pricing.maxDiscountPct', value: 1 },
      update: { value: 1 },
    });
    // Down to the list price: the whole markup (~16% of the price) comes off
    // the sale price — over the 1% cap. The admin holds the approval code, so
    // it goes through as an approved discount, on record (it used to read 0%).
    await asAdmin(http().post(`/v1/contracts/${contract.id}/price`))
      .send({ totalAmount: unit.price, reason: 'V1 hidden discount' })
      .expect(201);
    const audit = await testApp.rawPrisma.auditLog.findFirstOrThrow({
      where: { entityId: contract.id, action: 'pricing.discount-approved' },
      select: { after: true },
    });
    expect((audit.after as { discountPct: number }).discountPct).toBeGreaterThan(10);
    if (capBefore !== undefined) {
      await testApp.rawPrisma.setting.update({
        where: { companyId_key: { companyId, key: 'pricing.maxDiscountPct' } },
        data: { value: capBefore as number },
      });
    }
  });
});
