/**
 * Y1 — due dates are days. The down payment written on conversion carried the
 * time of day (`now`), so on its own day it fell out of "due by today": the
 * dashboard showed a 100% collection rate on a signing day, with the unpaid
 * down payment nowhere in it. A back-dated contract also had its down payment
 * due after instalments that were already due.
 */
import 'reflect-metadata';
import request from 'supertest';
import { PlanPaymentType, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { startOfLocalToday } from '../../src/common/time/company-timezone';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('Y1 — due dates are days (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  const sales: Sale[] = [];
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

  /** A 1,000,000 unit on a 12-month plan (50,000 booking, 200,000 down), converted from `startsAt`. */
  const sell = async (n: number, startsAt: string): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `Y1-U${n}-${stamp}`,
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
      name: `Y1 plan ${n}`,
      projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 200_000,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
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
          code: `Y1-${stamp}`,
          name: { ar: 'مشروع', en: 'Y1 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `Y1-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `Y1-B-${stamp}`, name: 'B' },
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
      if (s.contractId) await raw.contract.deleteMany({ where: { id: s.contractId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId: s.reservationId } });
      await raw.reservation.deleteMany({ where: { id: s.reservationId } });
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: s.templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: s.templateId } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: s.templateId } });
    }
    const unitIds = sales.map((s) => s.unitId);
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

  it('Y1-1: the down payment is due today (the day, no time) and counts in "due by today" on its own day', async () => {
    const before = await summary();
    const sale = await sell(1, day(new Date(Date.now() + 40 * DAY)));
    const down = (await rowsOf(sale)).find((r) => r.type === PlanPaymentType.DOWN_PAYMENT)!;
    expect(down.dueDate.toISOString()).toBe(startOfLocalToday('Africa/Cairo').toISOString());

    const after = await summary();
    // Due by today: the 50,000 booking (paid) and the 200,000 down payment (not paid).
    expect(Math.round(after.dueToDate - before.dueToDate)).toBe(250_000);
    expect(Math.round(after.collectedAgainstDue - before.collectedAgainstDue)).toBe(50_000);
  });

  it('Y1-2: a back-dated contract owes its down payment on its start date, not after its instalments', async () => {
    const startsAt = new Date(startOfLocalToday('Africa/Cairo').getTime() - 90 * DAY);
    const sale = await sell(2, day(startsAt));
    const rows = await rowsOf(sale);
    const down = rows.find((r) => r.type === PlanPaymentType.DOWN_PAYMENT)!;
    const first = rows.find((r) => r.type === PlanPaymentType.INSTALLMENT)!;
    expect(day(down.dueDate)).toBe(day(startsAt));
    expect(down.dueDate.getTime()).toBeLessThanOrEqual(first.dueDate.getTime());
  });
});
