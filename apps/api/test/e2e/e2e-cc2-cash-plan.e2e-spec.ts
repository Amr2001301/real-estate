/**
 * CC2 — F11. There was no cash plan: a plan needed a duration or an
 * instalment count, so a cash sale had to be entered as a one-month plan at
 * 0%. A cash plan now has no instalments: what the booking leaves is one
 * payment due at signing, and the contract converts without a start date.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  InstallmentFrequency,
  PlanPaymentType,
  ProjectStatus,
  ReservationStatus,
  UnitStatus,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('CC2 — a cash plan (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  const sales: Sale[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const day = (d: Date) => d.toISOString().slice(0, 10);

  /** Reserve, approve, take the booking and convert a fresh unit on a cash plan. */
  const sell = async (n: number, price: number, booking: number): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `CC2-U${n}-${stamp}`,
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
    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: `CC2 plan ${n}`,
      projectId,
      unitId,
      totalPrice: price,
      reservationAmount: booking,
      isCash: true,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: tpl.body.id,
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
    // No start date: a cash plan has no instalments to start.
    const converted = await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send(
      {},
    );
    expect({
      status: converted.status,
      body: converted.status === 201 ? null : converted.body,
    }).toEqual({ status: 201, body: null });
    sale.contractId = (
      await raw.contract.findFirstOrThrow({ where: { reservationId }, select: { id: true } })
    ).id;
    return sale;
  };

  const schedule = async (s: Sale) => {
    const raw = testApp.rawPrisma;
    const plan = await raw.installmentPlan.findFirstOrThrow({
      where: { contractId: s.contractId },
    });
    const rows = await raw.installment.findMany({
      where: { planId: plan.id },
      orderBy: [{ dueDate: 'asc' }, { type: 'asc' }],
    });
    return { plan, rows };
  };

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
          code: `CC2-${stamp}`,
          name: { ar: 'مشروع', en: 'CC2 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `CC2-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `CC2-B-${stamp}`, name: 'B' },
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

  it('CC2-1: a cash sale is one payment of what the booking leaves, due at signing', async () => {
    const sale = await sell(1, 1_000_000, 100_000);
    const template = await testApp.rawPrisma.installmentPlanTemplate.findUniqueOrThrow({
      where: { id: sale.templateId },
    });
    expect(template.isCash).toBe(true);
    expect(template.installmentsCount).toBeNull();
    expect(Number(template.downPaymentAmount)).toBe(900_000);

    const reservation = await testApp.rawPrisma.reservation.findUniqueOrThrow({
      where: { id: sale.reservationId },
    });
    expect(reservation.selectedDurationMonths).toBe(0);
    expect(Number(reservation.snapshotTotalPayable)).toBe(1_000_000);

    const { rows } = await schedule(sale);
    expect(rows.map((r) => [r.type, Number(r.amount)])).toEqual([
      [PlanPaymentType.DOWN_PAYMENT, 900_000],
    ]);
    // Due today (company day), not at some instalment start date.
    expect(Math.abs(rows[0]!.dueDate.getTime() - Date.now())).toBeLessThan(86_400_000);
    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
      where: { id: sale.contractId },
    });
    expect(Number(contract.totalAmount)).toBe(1_000_000);
  });

  it('CC2-2: a cash plan takes no durations or instalments', async () => {
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        companyId,
        buildingId,
        code: `CC2-U2-${stamp}`,
        type: 'APARTMENT',
        area: 100,
        bedrooms: 2,
        bathrooms: 1,
        floor: 1,
        price: 1_000_000,
        status: UnitStatus.AVAILABLE,
      },
    });
    const res = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: `CC2 bad ${stamp}`,
      projectId,
      unitId: unit.id,
      totalPrice: 1_000_000,
      reservationAmount: 100_000,
      isCash: true,
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
      startDateRule: 'AFTER_CONTRACT',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('خطة الكاش');
  });
});
