/**
 * PP1 — payment plans customers see in the app. A plan the company marks
 * PUBLIC (and ACTIVE) shows on its unit's page through
 * `GET /public/units/:id/payment-plans`, and folds into the project's offers
 * through `GET /public/projects/:id/payment-plans`. Sales-only, draft and
 * other companies' plans never show; no creator or internal fields leak.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ProjectStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PP1 — public payment plans (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId = '';
  let buildingId = '';
  let otherCompanyId = '';
  let foreignUnitId = '';
  const templateIds: string[] = [];
  let publicPlan = { id: '', unitId: '' };
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  // A unit has one plan, so every plan gets a unit of its own.
  const unitIds: string[] = [];
  const plan = async (body: Record<string, unknown>) => {
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        companyId,
        buildingId,
        code: `PP1-U${unitIds.length}-${stamp}`,
        type: 'APARTMENT',
        area: 100,
        bedrooms: 2,
        bathrooms: 1,
        floor: 1,
        price: 1_000_000,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    unitIds.push(unit.id);
    const res = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      projectId,
      unitId: unit.id,
      totalPrice: 1_000_000,
      startDateRule: 'AFTER_CONTRACT',
      ...body,
    });
    if (res.status !== 201) throw new Error(`template create: ${JSON.stringify(res.body)}`);
    templateIds.push(res.body.id);
    return { id: res.body.id as string, unitId: unit.id };
  };
  const plansOf = async (id: string) =>
    (await http().get(`/v1/public/units/${id}/payment-plans`).expect(200)).body as {
      id: string;
      downPaymentPercent: number;
      options: unknown[];
    }[];

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
          code: `PP1-${stamp}`,
          name: { ar: 'مشروع', en: 'PP1 Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `PP1-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `PP1-B-${stamp}`, name: 'B' },
      })
    ).id;

    // Another company's published unit, with a PUBLIC ACTIVE plan of its own.
    otherCompanyId = (
      await raw.company.create({
        data: { name: `PP1 Other ${stamp}`, slug: `pp1-other-${stamp}`, isActive: true },
        select: { id: true },
      })
    ).id;
    const oProject = await raw.project.create({
      data: {
        companyId: otherCompanyId,
        code: `PP1-O-${stamp}`,
        name: { ar: 'آخر', en: 'Other' },
        description: { ar: 'و', en: 'd' },
        city: 'Cairo',
        lat: 30,
        lng: 31,
        status: ProjectStatus.PUBLISHED,
      },
    });
    const oPhase = await raw.phase.create({
      data: {
        companyId: otherCompanyId,
        projectId: oProject.id,
        code: 'O-PH',
        name: { ar: 'م', en: 'P' },
      },
    });
    const oBuilding = await raw.building.create({
      data: { companyId: otherCompanyId, phaseId: oPhase.id, code: 'O-B', name: 'B' },
    });
    foreignUnitId = (
      await raw.unit.create({
        data: {
          companyId: otherCompanyId,
          buildingId: oBuilding.id,
          code: `PP1-OU-${stamp}`,
          type: 'APARTMENT',
          area: 100,
          bedrooms: 2,
          bathrooms: 1,
          price: 1_000_000,
          status: UnitStatus.AVAILABLE,
        },
      })
    ).id;
    const foreignPlan = await raw.installmentPlanTemplate.create({
      data: {
        companyId: otherCompanyId,
        name: 'Foreign',
        projectId: oProject.id,
        unitId: foreignUnitId,
        totalPrice: 1_000_000,
        netPrice: 1_000_000,
        downPaymentValue: 100_000,
        downPaymentAmount: 100_000,
        installmentsCount: 12,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        createdById: fixtures.userIds.adminId,
      },
    });
    templateIds.push(foreignPlan.id);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.installmentPlanDurationOption.deleteMany({ where: { planId: { in: templateIds } } });
    await raw.planTemplateScheduleItem.deleteMany({ where: { planId: { in: templateIds } } });
    await raw.installmentPlanTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: templateIds } } });
    await raw.unit.deleteMany({ where: { id: { in: [...unitIds, foreignUnitId] } } });
    await raw.building.deleteMany({ where: { phase: { projectId } } });
    await raw.building.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.phase.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { companyId: otherCompanyId } });
    await raw.project.deleteMany({ where: { id: projectId } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('PP1-1: only ACTIVE plans marked PUBLIC show, with their monthly amounts', async () => {
    publicPlan = await plan({
      name: `PP1 public ${stamp}`,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 50_000,
      durationOptions: [
        { durationMonths: 60, increasePercentage: 0 },
        { durationMonths: 96, increasePercentage: 10 },
      ],
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    });
    const salesOnly = await plan({
      name: `PP1 sales ${stamp}`,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      installmentsCount: 12,
      frequency: 'MONTHLY',
      status: 'ACTIVE',
    });
    const draft = await plan({
      name: `PP1 draft ${stamp}`,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      installmentsCount: 12,
      frequency: 'MONTHLY',
      status: 'DRAFT',
      visibility: 'PUBLIC',
    });

    expect(await plansOf(salesOnly.unitId)).toEqual([]);
    expect(await plansOf(draft.unitId)).toEqual([]);
    const shown = await plansOf(publicPlan.unitId);
    expect(shown).toHaveLength(1);
    const p = shown[0];
    if (!p) throw new Error('no plan');
    expect(p.id).toBe(publicPlan.id);
    // The down payment alone (the 50,000 booking is its own line).
    expect(p.downPaymentPercent).toBe(5);
    // 900,000 over 60 months; 990,000 (+10%) over 96.
    expect(p.options).toEqual([
      expect.objectContaining({
        durationMonths: 60,
        frequency: 'MONTHLY',
        installmentAmount: 15_000,
      }),
      expect.objectContaining({
        durationMonths: 96,
        frequency: 'MONTHLY',
        installmentAmount: 10_312.5,
      }),
    ]);
    expect(p).not.toHaveProperty('createdById');
    expect(p).not.toHaveProperty('createdBy');
    expect(p).not.toHaveProperty('companyId');
  });

  it('PP1-2: a legacy plan comes out as one option at its own frequency', async () => {
    const legacy = await plan({
      name: `PP1 legacy ${stamp}`,
      downPaymentType: 'PERCENTAGE',
      downPaymentValue: 20,
      installmentsCount: 8,
      frequency: 'QUARTERLY',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    });
    const [p] = await plansOf(legacy.unitId);
    if (!p) throw new Error('no plan');
    expect(p.id).toBe(legacy.id);
    expect(p.downPaymentPercent).toBe(20);
    expect(p.options).toEqual([
      expect.objectContaining({
        durationMonths: 24,
        frequency: 'QUARTERLY',
        installmentsCount: 8,
        installmentAmount: 100_000,
      }),
    ]);
  });

  it('PP1-3: the project folds its public plans into offers', async () => {
    const res = await http().get(`/v1/public/projects/${projectId}/payment-plans`).expect(200);
    expect(res.body.plansCount).toBe(2);
    expect(res.body.minDownPaymentPercent).toBe(5);
    expect(res.body.maxMonths).toBe(96);
    expect(res.body.offers).toEqual([
      { downPaymentPercent: 5, maxMonths: 96, isCash: false },
      { downPaymentPercent: 20, maxMonths: 24, isCash: false },
    ]);
  });

  it('PP1-4: switching a plan back to sales-only hides it', async () => {
    await asAdmin(http().patch(`/v1/installment-plan-templates/${publicPlan.id}`))
      .send({ visibility: 'SALES_ONLY' })
      .expect(200);
    expect(await plansOf(publicPlan.unitId)).toEqual([]);
  });

  it('PP1-5: another company’s unit or project is not found', async () => {
    await http().get(`/v1/public/units/${foreignUnitId}/payment-plans`).expect(404);
    const foreignProject = await testApp.rawPrisma.project.findFirstOrThrow({
      where: { companyId: otherCompanyId },
      select: { id: true },
    });
    await http().get(`/v1/public/projects/${foreignProject.id}/payment-plans`).expect(404);
  });

  it('PP1-6: an unknown visibility is refused', async () => {
    const res = await asAdmin(http().patch(`/v1/installment-plan-templates/${publicPlan.id}`)).send(
      {
        visibility: 'EVERYONE',
      },
    );
    expect(res.status).toBe(400);
  });

  it("PP1-7: several plans change at once, only the company's own; sales cannot", async () => {
    const a = await plan({
      name: `PP1 bulk a ${stamp}`,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      installmentsCount: 10,
      frequency: 'MONTHLY',
      status: 'ACTIVE',
    });
    const b = await plan({
      name: `PP1 bulk b ${stamp}`,
      downPaymentType: 'FIXED',
      downPaymentValue: 100_000,
      installmentsCount: 10,
      frequency: 'MONTHLY',
      status: 'ACTIVE',
    });
    const foreignId = (
      await testApp.rawPrisma.installmentPlanTemplate.findFirstOrThrow({
        where: { companyId: otherCompanyId },
        select: { id: true },
      })
    ).id;
    const res = await asAdmin(http().post('/v1/installment-plan-templates/visibility'))
      .send({ ids: [a.id, b.id, foreignId], visibility: 'PUBLIC' })
      .expect(201);
    expect(res.body).toEqual({ updated: 2 });
    expect(await plansOf(a.unitId)).toHaveLength(1);
    expect(await plansOf(b.unitId)).toHaveLength(1);
    // The other company's plan is untouched (it was PUBLIC; flip it back and check).
    await asAdmin(http().post('/v1/installment-plan-templates/visibility'))
      .send({ ids: [foreignId], visibility: 'SALES_ONLY' })
      .expect(201)
      .expect(({ body }) => expect(body).toEqual({ updated: 0 }));
    const foreign = await testApp.rawPrisma.installmentPlanTemplate.findUniqueOrThrow({
      where: { id: foreignId },
    });
    expect(foreign.visibility).toBe('PUBLIC');
    // The list filters by who sees it.
    const listed = await asAdmin(
      http().get(
        `/v1/installment-plan-templates?projectId=${projectId}&visibility=PUBLIC&pageSize=100`,
      ),
    ).expect(200);
    expect(listed.body.data.map((x: { id: string }) => x.id)).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(listed.body.data.every((x: { visibility: string }) => x.visibility === 'PUBLIC')).toBe(
      true,
    );
    // Sales cannot change it; bad input is refused.
    const salesToken = await loginAs(testApp.app, 'sales@example.com', 'SalesPass123!');
    await http()
      .post('/v1/installment-plan-templates/visibility')
      .set('Authorization', bearer(salesToken))
      .send({ ids: [a.id], visibility: 'SALES_ONLY' })
      .expect(403);
    await asAdmin(http().post('/v1/installment-plan-templates/visibility'))
      .send({ ids: [], visibility: 'PUBLIC' })
      .expect(400);
  });
});
