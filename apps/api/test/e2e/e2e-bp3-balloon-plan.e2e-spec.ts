/**
 * BP3 — a plan with a big payment every few months beside a small monthly
 * one (owner, 2026-11-11). The company sets the share of the financed amount
 * paid in big payments and how many months apart they fall (3, 6 or 12); the
 * monthly instalment keeps going, and in a big-payment month both are due.
 * Duration plans only; every duration must split into whole periods.
 */
import 'reflect-metadata';
import request from 'supertest';
import { PlanPaymentType, ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('BP3 — balloon plans (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  let unitId: string;
  let templateId: string;
  let reservationId = '';
  let contractId = '';
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const plan = (extra: Record<string, unknown> = {}) => ({
    name: `BP3 plan ${stamp}`,
    projectId,
    reservationAmountType: 'PERCENTAGE',
    reservationAmountValue: 5,
    downPaymentType: 'PERCENTAGE',
    downPaymentValue: 15,
    durationOptions: [
      { durationMonths: 12, increasePercentage: 0 },
      { durationMonths: 24, increasePercentage: 10 },
    ],
    startDateRule: 'AFTER_CONTRACT',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    balloonSharePct: 60,
    balloonEveryMonths: 3,
    ...extra,
  });

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
          code: `BP3-${stamp}`,
          name: { ar: 'مشروع الدفعات', en: 'BP3' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `BP3-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `BP3-B-${stamp}`, name: 'B' } })).id;
    unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `BP3-U-${stamp}`,
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
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    if (contractId) {
      const p = await raw.installmentPlan.findFirst({ where: { contractId }, select: { id: true } });
      if (p) {
        await raw.installment.deleteMany({ where: { planId: p.id } });
        await raw.installmentPlan.deleteMany({ where: { id: p.id } });
      }
      await raw.bonusEntry.deleteMany({ where: { contractId } });
      await raw.unitMaintenanceItem.deleteMany({ where: { unitId } });
    }
    if (reservationId) {
      await raw.deposit.deleteMany({ where: { OR: [{ reservationId }, ...(contractId ? [{ contractId }] : [])] } });
      if (contractId) await raw.contract.deleteMany({ where: { id: contractId } });
      await raw.reservationActivity.deleteMany({ where: { reservationId } });
      await raw.reservation.deleteMany({ where: { id: reservationId } });
    }
    await raw.installmentPlanTemplate.deleteMany({ where: { projectId } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [unitId, contractId].filter(Boolean) }, createdAt: { gte: startedAt } } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('BP3-1: refuses terms that do not fit — a duration not split into whole periods, one term alone, a spacing other than 3/6/12', async () => {
    const odd = await asAdmin(http().post('/v1/installment-plan-templates')).send(
      plan({ durationOptions: [{ durationMonths: 10, increasePercentage: 0 }] }),
    );
    expect(odd.status).toBe(400);
    expect(odd.body.message).toContain('لا تنقسم');
    const half = await asAdmin(http().post('/v1/installment-plan-templates')).send(plan({ balloonEveryMonths: null }));
    expect(half.status).toBe(400);
    expect(half.body.message).toContain('الاتنين');
    const four = await asAdmin(http().post('/v1/installment-plan-templates')).send(plan({ balloonEveryMonths: 4 }));
    expect(four.status).toBe(400);
  });

  it('BP3-2: the plan shows each duration as a small monthly amount plus a big payment every 3 months', async () => {
    const res = await asAdmin(http().post('/v1/installment-plan-templates')).send(plan());
    expect(res.status).toBe(201);
    templateId = res.body.id;
    const stored = await testApp.rawPrisma.installmentPlanTemplate.findUniqueOrThrow({ where: { id: templateId } });
    expect([Number(stored.balloonSharePct), stored.balloonEveryMonths]).toEqual([60, 3]);

    // Public: on this unit (1,000,000): booking 50,000, down 150,000, 800,000 financed.
    const plans = (await http().get(`/v1/public/units/${unitId}/payment-plans`).expect(200)).body as Array<{
      id: string;
      options: Array<{ durationMonths: number; installmentAmount: number; balloonAmount: number; balloonEveryMonths: number; totalPayable: number }>;
    }>;
    const mine = plans.find((p) => p.id === templateId)!;
    expect(mine.options).toEqual([
      // 12 months: 480,000 in 4 big payments, 320,000 over 12 months.
      expect.objectContaining({ durationMonths: 12, installmentAmount: 26_666.66, balloonAmount: 120_000, balloonEveryMonths: 3, totalPayable: 1_000_000 }),
      // 24 months at +10%: 880,000 financed → 528,000 in 8, 352,000 over 24.
      expect.objectContaining({ durationMonths: 24, installmentAmount: 14_666.66, balloonAmount: 66_000, balloonEveryMonths: 3, totalPayable: 1_080_000 }),
    ]);
  });

  it('BP3-3: the contract has a row every month and a big payment every 3rd month, adding up to the price', async () => {
    const options = await testApp.rawPrisma.installmentPlanDurationOption.findMany({ where: { planId: templateId } });
    const twelve = options.find((o) => o.durationMonths === 12)!;
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: templateId,
        installmentPlanDurationOptionId: twelve.id,
        expiresInHours: 72,
      });
    expect({ status: created.status, body: created.status === 201 ? null : created.body }).toEqual({ status: 201, body: null });
    reservationId = created.body.id ?? created.body.reservation?.id;
    const snap = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    expect([Number(snap.snapshotMonthlyInstallment), Number(snap.snapshotBalloonAmount), snap.snapshotBalloonEveryMonths]).toEqual([26_666.66, 120_000, 3]);

    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({ startsAt: '2027-01-01' }).expect(201);
    contractId = (await testApp.rawPrisma.contract.findFirstOrThrow({ where: { reservationId }, select: { id: true } })).id;

    const contractPlan = await testApp.rawPrisma.installmentPlan.findFirstOrThrow({ where: { contractId } });
    expect([Number(contractPlan.monthlyAmount), Number(contractPlan.balloonAmount), contractPlan.balloonEveryMonths]).toEqual([26_666.66, 120_000, 3]);
    const rows = await testApp.rawPrisma.installment.findMany({
      where: { planId: contractPlan.id },
      orderBy: [{ dueDate: 'asc' }, { amount: 'asc' }],
    });
    const installments = rows.filter((r) => r.type === PlanPaymentType.INSTALLMENT);
    const big = installments.filter((r) => Number(r.amount) === 120_000).map((r) => r.dueDate.toISOString().slice(0, 7));
    expect(big).toEqual(['2027-03', '2027-06', '2027-09', '2027-12']);
    expect(installments.filter((r) => Number(r.amount) !== 120_000)).toHaveLength(12);
    const cents = (n: unknown) => Math.round(Number(n) * 100);
    expect(installments.reduce((s, r) => s + cents(r.amount), 0)).toBe(80_000_000);
    expect(rows.find((r) => r.type === PlanPaymentType.DOWN_PAYMENT)?.amount.toString()).toBe('150000');
  });
});
