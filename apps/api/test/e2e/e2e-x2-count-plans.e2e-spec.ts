/**
 * X2 — a plan priced by instalment count (quarterly, semi-annual, a final
 * payment) can be sold. The plan form makes such plans (no duration options),
 * but their reservations had no snapshot and conversion refused them ("this
 * reservation is old…"), so they could be created and never become contracts.
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

describe('X2 — plans priced by instalment count convert to contracts (e2e)', () => {
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

  /** Reserve, approve, take the booking and convert a fresh unit on a count plan. */
  const sell = async (
    n: number,
    price: number,
    plan: {
      booking: number;
      down: number;
      count: number;
      frequency: InstallmentFrequency;
      final?: number;
    },
  ): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `X2-U${n}-${stamp}`,
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
      name: `X2 plan ${n}`,
      projectId,
      unitId,
      totalPrice: price,
      reservationAmount: plan.booking,
      downPaymentType: 'FIXED',
      downPaymentValue: plan.down,
      installmentsCount: plan.count,
      frequency: plan.frequency,
      ...(plan.final ? { finalPaymentAmount: plan.final } : {}),
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
    const converted = await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({
      startsAt: '2027-01-15',
    });
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
          code: `X2-${stamp}`,
          name: { ar: 'مشروع', en: 'X2 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `X2-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `X2-B-${stamp}`, name: 'B' },
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

  it('X2-1: quarterly with a final payment — 8 rows three months apart, the final one quarter later', async () => {
    // 1,600,000 = 50,000 booking + 200,000 down + 8 × 118,750 + 400,000 final.
    const sale = await sell(1, 1_600_000, {
      booking: 50_000,
      down: 200_000,
      count: 8,
      frequency: 'QUARTERLY',
      final: 400_000,
    });
    const reservation = await testApp.rawPrisma.reservation.findUniqueOrThrow({
      where: { id: sale.reservationId },
    });
    expect(reservation.snapshotFrequency).toBe('QUARTERLY');
    expect(reservation.selectedDurationMonths).toBe(24);

    const { plan, rows } = await schedule(sale);
    expect(plan.frequency).toBe('QUARTERLY');
    const installments = rows.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    expect(installments.map((r) => day(r.dueDate))).toEqual([
      '2027-01-15',
      '2027-04-15',
      '2027-07-15',
      '2027-10-15',
      '2028-01-15',
      '2028-04-15',
      '2028-07-15',
      '2028-10-15',
    ]);
    expect(installments.every((r) => Number(r.amount) === 118_750)).toBe(true);
    const final = rows.find((r) => r.type === PlanPaymentType.FINAL_PAYMENT)!;
    expect([day(final.dueDate), Number(final.amount)]).toEqual(['2029-01-15', 400_000]);
    expect(Number(rows.find((r) => r.type === PlanPaymentType.DOWN_PAYMENT)!.amount)).toBe(200_000);

    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
      where: { id: sale.contractId },
    });
    expect(Number(contract.totalAmount)).toBe(1_600_000);
    const sum = rows.reduce((a, r) => a + Number(r.amount), 0);
    expect(Math.round(sum * 100) / 100).toBe(1_600_000 - 50_000);
  });

  it('X2-2: semi-annual without a final payment — the last row carries the rounding', async () => {
    // 1,000,000 − 100,000 booking − 100,000 down = 800,000 over 6 rows.
    const sale = await sell(2, 1_000_000, {
      booking: 100_000,
      down: 100_000,
      count: 6,
      frequency: 'SEMI_ANNUAL',
    });
    const { plan, rows } = await schedule(sale);
    expect(plan.frequency).toBe('SEMI_ANNUAL');
    const installments = rows.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    expect(installments.map((r) => day(r.dueDate))).toEqual([
      '2027-01-15',
      '2027-07-15',
      '2028-01-15',
      '2028-07-15',
      '2029-01-15',
      '2029-07-15',
    ]);
    expect(installments.slice(0, 5).every((r) => Number(r.amount) === 133_333.33)).toBe(true);
    expect(Number(installments[5]!.amount)).toBe(133_333.35);
    expect(rows.some((r) => r.type === PlanPaymentType.FINAL_PAYMENT)).toBe(false);
  });

  it('X2-3: a broker portal reservation on a count plan carries the same snapshot', async () => {
    const raw = testApp.rawPrisma;
    const brokerToken = await loginAs(
      testApp.app,
      fixtures.users.BROKER_1.email,
      fixtures.users.BROKER_1.password,
    );
    // A free unit of a project BROKER_1 is granted.
    const unit = await raw.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        building: { phase: { projectId: fixtures.projects.p1Id } },
        reservations: {
          none: { status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
        },
        contracts: { none: { status: { not: 'CANCELLED' }, deletedAt: null } },
      },
      select: { id: true, price: true },
    });
    const price = Number(unit.price);
    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: 'X2 portal plan',
      projectId: fixtures.projects.p1Id,
      unitId: unit.id,
      totalPrice: price,
      reservationAmount: 10_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 20_000,
      installmentsCount: 4,
      frequency: 'YEARLY',
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    let reservationId: string | undefined;
    try {
      const res = await http()
        .post('/v1/portal/reservations')
        .set('Authorization', bearer(brokerToken))
        .send({
          leadId: fixtures.flowD.broker1ApprovedLeadId,
          unitId: unit.id,
          installmentPlanTemplateId: tpl.body.id,
          expiresInHours: 72,
        });
      expect(res.status).toBe(201);
      reservationId = res.body.id;
      const r = await raw.reservation.findUniqueOrThrow({ where: { id: reservationId } });
      expect(r.snapshotFrequency).toBe('YEARLY');
      expect(r.selectedDurationMonths).toBe(48);
      const perRow = Math.floor(((price - 30_000) * 100) / 4) / 100;
      expect(Number(r.snapshotMonthlyInstallment)).toBe(perRow);
      expect(Number(r.snapshotTotalPayable)).toBe(price);
    } finally {
      if (reservationId) {
        await raw.reservationActivity.deleteMany({ where: { reservationId } });
        await raw.reservation.deleteMany({ where: { id: reservationId } });
      }
      await raw.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null },
      });
      await raw.unitStatusHistory.deleteMany({
        where: { unitId: unit.id, changedAt: { gte: startedAt } },
      });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: tpl.body.id } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: tpl.body.id } });
    }
  });
});
