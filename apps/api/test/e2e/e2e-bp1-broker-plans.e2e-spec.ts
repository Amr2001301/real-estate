/**
 * BP1 — payment plans on the broker's unit and project pages. A broker sees
 * what a customer would (owner, 2026-11-03): the ACTIVE plans the company
 * marked PUBLIC, and only on a unit or project the broker is granted.
 * `GET /portal/units/:id/payment-plans`, `GET /portal/projects/:id/payment-plans`.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('BP1 — broker payment plans (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken = '';
  let brokerToken = '';
  let companyId = '';
  const unitIds: string[] = [];
  const templateIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asBroker = <T extends request.Test>(r: T) => r.set('Authorization', bearer(brokerToken));

  /** A unit of its own in `projectId` with one plan (a unit has one plan). */
  const unitWithPlan = async (
    projectId: string,
    n: number,
    visibility: 'PUBLIC' | 'SALES_ONLY',
  ) => {
    const raw = testApp.rawPrisma;
    const building = await raw.building.findFirstOrThrow({
      where: { phase: { projectId } },
      select: { id: true },
    });
    const unit = await raw.unit.create({
      data: {
        companyId,
        buildingId: building.id,
        code: `BP1-U${n}-${stamp}`,
        type: 'APARTMENT',
        area: 100,
        bedrooms: 2,
        bathrooms: 1,
        price: 1_000_000,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    unitIds.push(unit.id);
    const res = await http()
      .post('/v1/installment-plan-templates')
      .set('Authorization', bearer(adminToken))
      .send({
        name: `BP1 ${n} ${stamp}`,
        projectId,
        unitId: unit.id,
        totalPrice: 1_000_000,
        reservationAmount: 50_000,
        downPaymentType: 'PERCENTAGE',
        downPaymentValue: 10,
        durationOptions: [{ durationMonths: 60, increasePercentage: 0 }],
        startDateRule: 'AFTER_CONTRACT',
        status: 'ACTIVE',
        visibility,
      });
    if (res.status !== 201) throw new Error(`template create: ${JSON.stringify(res.body)}`);
    templateIds.push(res.body.id);
    return unit.id;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    brokerToken = await loginAs(testApp.app, 'broker1@example.com', 'BrokerPass1!!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.installmentPlanDurationOption.deleteMany({ where: { planId: { in: templateIds } } });
    await raw.planTemplateScheduleItem.deleteMany({ where: { planId: { in: templateIds } } });
    await raw.installmentPlanTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [...templateIds, ...unitIds] } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
  });

  it('BP1-1: a granted unit shows its public plan; a sales-only plan does not show', async () => {
    const shown = await unitWithPlan(fixtures.projects.p1Id, 1, 'PUBLIC');
    const hidden = await unitWithPlan(fixtures.projects.p1Id, 2, 'SALES_ONLY');
    const res = await asBroker(http().get(`/v1/portal/units/${shown}/payment-plans`)).expect(200);
    expect(res.body).toHaveLength(1);
    // 1,000,000 − 50,000 booking − 100,000 down = 850,000 over 60 months.
    expect(res.body[0]).toMatchObject({ downPaymentPercent: 10 });
    expect(res.body[0].options[0]).toMatchObject({
      durationMonths: 60,
      installmentAmount: 14_166.66,
    });
    expect(res.body[0]).not.toHaveProperty('createdById');
    const none = await asBroker(http().get(`/v1/portal/units/${hidden}/payment-plans`)).expect(200);
    expect(none.body).toEqual([]);
  });

  it('BP1-2: the granted project folds its public plans into offers', async () => {
    const res = await asBroker(
      http().get(`/v1/portal/projects/${fixtures.projects.p1Id}/payment-plans`),
    ).expect(200);
    expect(res.body.minDownPaymentPercent).toBe(10);
    expect(res.body.offers).toEqual(
      expect.arrayContaining([{ downPaymentPercent: 10, maxMonths: 60, isCash: false }]),
    );
  });

  it('BP1-3: a project or unit the broker is not granted is not found', async () => {
    const p3 = fixtures.projects.p3Id; // granted to BROKER_2 only
    const unit = await unitWithPlan(p3, 3, 'PUBLIC');
    await asBroker(http().get(`/v1/portal/units/${unit}/payment-plans`)).expect(404);
    await asBroker(http().get(`/v1/portal/projects/${p3}/payment-plans`)).expect(404);
  });

  it('BP1-4: staff cannot use the broker routes', async () => {
    await http()
      .get(`/v1/portal/projects/${fixtures.projects.p1Id}/payment-plans`)
      .set('Authorization', bearer(adminToken))
      .expect(403);
  });
});
