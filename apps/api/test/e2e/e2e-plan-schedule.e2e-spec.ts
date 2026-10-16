/**
 * T2 — the schedule a reservation converts into.
 *
 * A plan with a final (balloon) payment used to put that payment inside the
 * monthly split AND add it as its own row, so the customer was billed it
 * twice. Monthly amounts were not rounded to the cent, and a plan starting
 * on the 31st skipped February and billed March twice.
 */
import 'reflect-metadata';
import request from 'supertest';
import { PlanPaymentType, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('T2 — converted plan schedule (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let unitId: string;
  let unitPrice: number;
  let templateId: string;
  let reservationId: string;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const cents = (v: unknown) => Math.round(Number(v) * 100);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId: admin.companyId!, status: UnitStatus.AVAILABLE, planTemplates: { none: {} } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, price: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    unitId = unit.id;
    unitPrice = Number(unit.price);

    const tpl = await asAdmin(http().post('/v1/installment-plan-templates'))
      .send({
        name: 'T2 balloon plan',
        projectId: unit.building.phase.projectId,
        unitId,
        totalPrice: unitPrice,
        reservationAmount: 50_000,
        downPaymentType: 'FIXED',
        downPaymentValue: Math.round(unitPrice * 0.1),
        finalPaymentAmount: Math.round(unitPrice * 0.2),
        startDateRule: 'AFTER_CONTRACT',
        status: 'ACTIVE',
        durationOptions: [{ durationMonths: 36, increasePercentage: 0 }],
      });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    templateId = tpl.body.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    if (reservationId) {
      const contract = await raw.contract.findFirst({ where: { reservationId }, select: { id: true } });
      if (contract) {
        const plan = await raw.installmentPlan.findUnique({ where: { contractId: contract.id }, select: { id: true } });
        if (plan) {
          await raw.installment.deleteMany({ where: { planId: plan.id } });
          await raw.installmentPlan.delete({ where: { id: plan.id } });
        }
        await raw.contract.delete({ where: { id: contract.id } });
      }
      await raw.deposit.deleteMany({ where: { reservationId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId } });
      await raw.reservation.delete({ where: { id: reservationId } });
    }
    if (templateId) {
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: templateId } });
      await raw.installmentPlanTemplate.delete({ where: { id: templateId } });
    }
    await raw.unitStatusHistory.deleteMany({ where: { unitId, changedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    await raw.unit.update({ where: { id: unitId }, data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null } });
  });

  it('PS-1: the converted schedule adds up to the contract price exactly — the final payment once', async () => {
    const template = await testApp.rawPrisma.installmentPlanTemplate.findUniqueOrThrow({
      where: { id: templateId },
      select: { durationOptions: { select: { id: true } } },
    });
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: templateId,
        installmentPlanDurationOptionId: template.durationOptions[0]!.id,
        expiresInHours: 72,
      })
      .expect(201);
    reservationId = created.body.id ?? created.body.reservation?.id;
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    const booked = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    if (Number(booked.bookingAmount) > 0) {
      await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    }
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({ startsAt: '2027-01-31' }).expect(201);

    const contract = await testApp.rawPrisma.contract.findFirstOrThrow({
      where: { reservationId },
      select: { totalAmount: true, installmentPlan: { select: { installments: { orderBy: { dueDate: 'asc' } } } } },
    });
    const rows = contract.installmentPlan!.installments;
    const finals = rows.filter((r) => r.type === PlanPaymentType.FINAL_PAYMENT);
    expect(finals).toHaveLength(1);
    expect(cents(finals[0]!.amount)).toBe(cents(Math.round(unitPrice * 0.2)));

    const scheduled = rows.reduce((a, r) => a + cents(r.amount), 0);
    expect(scheduled + cents(booked.bookingAmount)).toBe(cents(contract.totalAmount));
    expect(cents(contract.totalAmount)).toBe(cents(unitPrice));

    // One monthly row per calendar month, February included.
    const monthly = rows.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    expect(monthly).toHaveLength(36);
    const months = monthly.map((r) => r.dueDate.toISOString().slice(0, 7));
    expect(new Set(months).size).toBe(36);
    expect(monthly[1]!.dueDate.toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(monthly[2]!.dueDate.toISOString().slice(0, 10)).toBe('2027-03-31');
  });
});
