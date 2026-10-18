/**
 * AA4 — amendments keep the down payment, and the swap form knows the
 * markup. A markup waiver and a unit swap rescaled the unpaid down payment
 * with the instalments (B-101 waiver: 400,000 → 350,230.41; a swap doubled
 * one: 110,000 → 226,321.83) — the markup is on the financed part, so the
 * down payment keeps its amount. The contract also reports the markup still
 * in its total, which the swap form adds to the new unit's price.
 */
import 'reflect-metadata';
import request from 'supertest';
import { PlanPaymentType, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('AA4 — amendments keep the down payment (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  const sales: Sale[] = [];
  const extraUnits: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();
  const DAY = 86_400_000;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const summary = async () =>
    (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.financial as {
      dueToDate: number;
      collectedAgainstDue: number;
    };

  /** A 1,000,000 unit on a 12-month plan at +10% (50,000 booking, 200,000 down), converted from `startsAt`. */
  const sell = async (n: number, startsAt: string): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `AA4-U${n}-${stamp}`,
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
      name: `AA4 plan ${n}`,
      projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 200_000,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 10 }],
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    const option = await raw.installmentPlanDurationOption.findFirstOrThrow({
      where: { planId: tpl.body.id },
    });
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
    const sale: Sale = { unitId, templateId: tpl.body.id, reservationId, contractId: '' };
    sales.push(sale);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`))
      .send({})
      .expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`))
      .send({})
      .expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`))
      .send({ startsAt })
      .expect(201);
    sale.contractId = (
      await raw.contract.findFirstOrThrow({ where: { reservationId }, select: { id: true } })
    ).id;
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/sign`))
      .send({ signedAt: new Date().toISOString() })
      .expect(201);
    return sale;
  };
  const rowsOf = async (s: Sale) =>
    testApp.rawPrisma.installment.findMany({
      where: { plan: { contractId: s.contractId } },
      orderBy: [{ dueDate: 'asc' }, { type: 'asc' }],
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } }))
      .companyId!;
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `AA4-${stamp}`,
          name: { ar: 'مشروع', en: 'AA4 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `AA4-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `AA4-B-${stamp}`, name: 'B' },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const s of sales) {
      if (s.contractId) {
        const plan = await raw.installmentPlan.findFirst({
          where: { contractId: s.contractId },
          select: { id: true },
        });
        if (plan) {
          await raw.installment.deleteMany({ where: { planId: plan.id, feeForId: { not: null } } });
          await raw.installment.deleteMany({ where: { planId: plan.id } });
          await raw.installmentPlan.deleteMany({ where: { id: plan.id } });
        }
        await raw.bonusEntry.deleteMany({ where: { contractId: s.contractId } });
        await raw.unitMaintenanceItem.deleteMany({ where: { unitId: s.unitId } });
      }
      await raw.deposit.deleteMany({
        where: {
          OR: [
            { reservationId: s.reservationId },
            ...(s.contractId ? [{ contractId: s.contractId }] : []),
          ],
        },
      });
      if (s.contractId) {
        await raw.contractAmendment.deleteMany({ where: { contractId: s.contractId } });
        await raw.contract.deleteMany({ where: { id: s.contractId } });
      }
      await raw.reservationActivity.deleteMany({ where: { reservationId: s.reservationId } });
      await raw.reservation.deleteMany({ where: { id: s.reservationId } });
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: s.templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: s.templateId } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: s.templateId } });
    }
    const unitIds = [...sales.map((s) => s.unitId), ...extraUnits];
    await raw.auditLog.deleteMany({
      where: {
        entityId: { in: [...unitIds, ...sales.map((s) => s.contractId)] },
        createdAt: { gte: startedAt },
      },
    });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  const downOf = async (s: Sale) =>
    (await rowsOf(s)).find((r) => r.type === PlanPaymentType.DOWN_PAYMENT)!;
  const openTotal = async (s: Sale) =>
    (await rowsOf(s))
      .filter((r) => r.status !== 'PAID' && r.status !== 'CANCELLED')
      .reduce((a, r) => a + Number(r.amount), 0);

  it('AA4-1: the contract reports its markup, and a waiver leaves the down payment as it was', async () => {
    const sale = await sell(1, day(new Date(Date.now() + 40 * DAY)));
    // 750,000 financed at +10%: 75,000 of markup in the total.
    const detail = await asAdmin(http().get(`/v1/contracts/${sale.contractId}`)).expect(200);
    expect(Number(detail.body.markupLeft)).toBe(75_000);

    const before = await openTotal(sale);
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/waive-markup`))
      .send({ amount: 15_000, reason: 'AA4 early settlement' })
      .expect(201);
    expect(Number((await downOf(sale)).amount)).toBe(200_000);
    expect(Math.round((before - (await openTotal(sale))) * 100) / 100).toBe(15_000);
    const after = await asAdmin(http().get(`/v1/contracts/${sale.contractId}`)).expect(200);
    expect(Number(after.body.markupLeft)).toBe(60_000);
  });

  it('AA4-2: a unit swap at a higher price leaves the down payment as it was', async () => {
    const sale = await sell(2, day(new Date(Date.now() + 40 * DAY)));
    const raw = testApp.rawPrisma;
    const target = await raw.unit.create({
      data: {
        companyId,
        buildingId,
        code: `AA4-T-${stamp}`,
        type: 'APARTMENT',
        area: 120,
        bedrooms: 3,
        bathrooms: 2,
        floor: 2,
        price: 1_200_000,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    extraUnits.push(target.id);
    const before = await openTotal(sale);
    // The new unit's price plus the markup still on the contract.
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/swap-unit`))
      .send({ unitId: target.id, totalAmount: 1_275_000, reason: 'AA4 bigger unit' })
      .expect(201);
    expect(Number((await downOf(sale)).amount)).toBe(200_000);
    expect(Math.round(((await openTotal(sale)) - before) * 100) / 100).toBe(200_000);
  });
});
