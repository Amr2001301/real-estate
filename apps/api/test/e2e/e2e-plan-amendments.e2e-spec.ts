/**
 * T5 — changing a live contract's money.
 *
 * - Reschedule: the unpaid monthly installments are spread over a new number
 *   of months; the total owed does not change by a cent.
 * - One payment for several installments (cash or transfer).
 * - A price change (e.g. a discount) moves the unpaid installments with it.
 * - Early settlement pays everything left, for exactly what is left.
 */
import 'reflect-metadata';
import request from 'supertest';
import { InstallmentStatus, PlanPaymentType, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('T5 — plan amendments & combined payments (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  let unitId: string;
  let templateId: string;
  let reservationId: string;
  let contractId: string;
  let planId: string;
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const cents = (v: unknown) => Math.round(Number(v) * 100);
  const openRows = () =>
    testApp.rawPrisma.installment.findMany({
      where: { planId, status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] } },
      orderBy: { dueDate: 'asc' },
    });
  const sum = (rows: Array<{ amount: unknown }>) => rows.reduce((a, r) => a + cents(r.amount), 0);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `PA-${stamp}`,
          name: { ar: 'مشروع', en: 'PA Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `PA-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `PA-B-${stamp}`, name: 'B' } })).id;
    unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `PA-U-${stamp}`,
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
      name: 'T5 plan',
      projectId,
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
    if (contractId) {
      const deposits = await raw.deposit.findMany({ where: { contractId }, select: { paymentInstrumentId: true } });
      await raw.deposit.deleteMany({ where: { contractId } });
      const instruments = deposits.map((d) => d.paymentInstrumentId).filter((x): x is string => !!x);
      await raw.paymentInstrument.deleteMany({ where: { id: { in: instruments } } });
      await raw.bonusEntry.deleteMany({ where: { contractId } });
      await raw.brokerCommission.deleteMany({ where: { contractId } });
      await raw.contractAmendment.deleteMany({ where: { contractId } });
      if (planId) {
        await raw.installment.deleteMany({ where: { planId } });
        await raw.installmentPlan.deleteMany({ where: { id: planId } });
      }
      await raw.contract.deleteMany({ where: { id: contractId } });
    }
    await raw.auditLog.deleteMany({ where: { entityId: { in: [contractId, unitId].filter(Boolean) }, createdAt: { gte: startedAt } } });
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
    await raw.unitStatusHistory.deleteMany({ where: { unitId } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('PA-1: reschedule spreads the unpaid months without changing what is owed', async () => {
    const before = await openRows();
    const monthlyBefore = before.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    expect(monthlyBefore).toHaveLength(12);
    await asAdmin(http().post(`/v1/contracts/${contractId}/reschedule`))
      .send({ months: 7, startsAt: '2027-03-31', reason: 'customer asked for fewer months' })
      .expect(201);
    const after = await openRows();
    const monthlyAfter = after.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    expect(monthlyAfter).toHaveLength(7);
    expect(sum(after)).toBe(sum(before));
    expect(monthlyAfter[0]!.dueDate.toISOString().slice(0, 10)).toBe('2027-03-31');
    expect(monthlyAfter[1]!.dueDate.toISOString().slice(0, 10)).toBe('2027-04-30');
    const cancelled = await testApp.rawPrisma.installment.count({ where: { planId, status: InstallmentStatus.CANCELLED } });
    expect(cancelled).toBe(12);
    const amendment = await testApp.rawPrisma.contractAmendment.findFirst({ where: { contractId, type: 'RESCHEDULE' } });
    expect(amendment).not.toBeNull();
  });

  it('PA-2: one payment covers several installments; the amount must match', async () => {
    const pick = (await openRows()).slice(0, 3);
    const body = {
      contractId,
      installmentIds: pick.map((r) => r.id),
      paymentMethod: 'BANK_TRANSFER',
      transfer: { bankName: 'NBE', referenceNumber: `PA-${stamp}` },
    };
    await asAdmin(http().post('/v1/deposits/batch'))
      .send({ ...body, amount: sum(pick) / 100 + 1 })
      .expect(400);
    const res = await asAdmin(http().post('/v1/deposits/batch'))
      .send({ ...body, amount: sum(pick) / 100 })
      .expect(201);
    expect(res.body.count).toBe(3);
    const paid = await testApp.rawPrisma.installment.findMany({ where: { id: { in: body.installmentIds } } });
    expect(paid.every((r) => r.status === InstallmentStatus.PAID)).toBe(true);
    const deposits = await testApp.rawPrisma.deposit.findMany({ where: { installmentId: { in: body.installmentIds } } });
    expect(deposits).toHaveLength(3);
    expect(new Set(deposits.map((d) => d.paymentInstrumentId)).size).toBe(1);
    // Paying them again is refused, all or nothing.
    await asAdmin(http().post('/v1/deposits/batch')).send(body).expect(409);
  });

  it('PA-3: a price change moves the unpaid installments with it', async () => {
    const before = await openRows();
    await asAdmin(http().post(`/v1/contracts/${contractId}/price`))
      .send({ totalAmount: 950_000, reason: 'settlement discount' })
      .expect(201);
    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect(cents(contract.totalAmount)).toBe(cents(950_000));
    expect(sum(await openRows())).toBe(sum(before) - cents(50_000));
    const amendment = await testApp.rawPrisma.contractAmendment.findFirst({ where: { contractId, type: 'PRICE_CHANGE' } });
    expect(cents(amendment!.toTotal)).toBe(cents(950_000));
  });

  it('PA-4: early settlement pays exactly what is left', async () => {
    const left = sum(await openRows());
    await asAdmin(http().post('/v1/deposits/settle'))
      .send({ contractId, amount: left / 100 - 1, paymentMethod: 'CASH' })
      .expect(400);
    await asAdmin(http().post('/v1/deposits/settle'))
      .send({ contractId, amount: left / 100, paymentMethod: 'CASH' })
      .expect(201);
    expect(await openRows()).toHaveLength(0);
    // Everything paid adds up to the contract price.
    const deposits = await testApp.rawPrisma.deposit.findMany({ where: { OR: [{ contractId }, { reservationId }], deletedAt: null } });
    expect(sum(deposits)).toBe(cents(950_000));
    await asAdmin(http().post('/v1/deposits/settle'))
      .send({ contractId, amount: 1, paymentMethod: 'CASH' })
      .expect(400);
  });
});
