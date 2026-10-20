/**
 * EE4 — F10. A project's unit models: a layout (type, areas, rooms,
 * finishing) a unit is entered from. Optional per project; a model belongs
 * to its project, so a unit can only take a model of its own project; the
 * units filter by model and carry its name.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('EE4 — unit models (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let buildingId: string;
  let otherBuildingId: string;
  let otherProjectId = '';
  const modelIds: string[] = [];
  const unitIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const createUnit = (n: number, extra: Record<string, unknown>, building = buildingId) =>
    asAdmin(http().post('/v1/units')).send({
      buildingId: building,
      code: `EE4-${stamp}-${n}`,
      type: '3BR',
      area: 180,
      bedrooms: 3,
      floor: 1,
      pricePerMeter: 20_000,
      ...extra,
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    buildingId = (
      await raw.building.findFirstOrThrow({ where: { phase: { projectId: fixtures.projects.p1Id } }, select: { id: true } })
    ).id;
    const companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    otherProjectId = (
      await raw.project.create({
        data: { companyId, code: `EE4-P-${stamp}`, name: { ar: 'مشروع EE4', en: 'EE4' }, description: { ar: '', en: '' }, city: 'Cairo', lat: 30, lng: 31 },
        select: { id: true },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId: otherProjectId, code: 'EE4-PH', name: { ar: 'مرحلة', en: 'Phase' }, order: 0 },
      select: { id: true },
    });
    otherBuildingId = (
      await raw.building.create({ data: { companyId, phaseId: phase.id, code: 'EE4-B', name: 'B', order: 0 }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    await raw.unitModel.deleteMany({ where: { id: { in: modelIds } } });
    if (otherProjectId) await raw.project.deleteMany({ where: { id: otherProjectId } });
  });

  it('EE4-1: a project gets its models; codes are unique in it', async () => {
    const res = await asAdmin(http().post(`/v1/projects/${fixtures.projects.p1Id}/unit-models`))
      .send({
        code: `a${stamp}`,
        ar: 'نموذج أ',
        en: 'Model A',
        type: 'villa',
        area: 320,
        landArea: 500,
        gardenArea: 150,
        bedrooms: 4,
        bathrooms: 4,
        finishing: 'SEMI_FINISHED',
      })
      .expect(201);
    modelIds.push(res.body.id);
    expect(res.body).toMatchObject({ code: `A${stamp}`, type: 'Villa', area: 320, landArea: 500, bedrooms: 4 });

    // Same code again in the project → refused; an office model has no bedrooms.
    await asAdmin(http().post(`/v1/projects/${fixtures.projects.p1Id}/unit-models`))
      .send({ code: `A${stamp}`, ar: 'x', en: 'x', type: 'Villa', area: 1 })
      .expect(409);
    const office = await asAdmin(http().post(`/v1/projects/${fixtures.projects.p1Id}/unit-models`))
      .send({ code: `O${stamp}`, ar: 'مكتب', en: 'Office', type: 'Office', area: 60, bedrooms: 2 })
      .expect(201);
    modelIds.push(office.body.id);
    expect(office.body.bedrooms).toBe(0);

    const list = await asAdmin(http().get(`/v1/projects/${fixtures.projects.p1Id}/unit-models`)).expect(200);
    expect(list.body.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(modelIds));
    // Another project's list does not show them.
    const other = await asAdmin(http().get(`/v1/projects/${otherProjectId}/unit-models`)).expect(200);
    expect(other.body.map((m: { id: string }) => m.id)).not.toContain(modelIds[0]);
  });

  it('EE4-2: a unit takes a model of its own project only', async () => {
    const [villa] = modelIds;
    const unit = await createUnit(1, { modelId: villa, type: 'Villa', area: 320, bedrooms: 4 }).expect(201);
    unitIds.push(unit.body.id);
    expect(unit.body.modelId).toBe(villa);

    const wrong = await createUnit(2, { modelId: villa }, otherBuildingId).expect(400);
    expect(wrong.body.message).toContain('مشروع آخر');

    // Shown by name; the list filters by model.
    const one = await asAdmin(http().get(`/v1/units/${unit.body.id}`)).set('Accept-Language', 'ar').expect(200);
    expect(one.body.model).toMatchObject({ code: `A${stamp}`, name: 'نموذج أ' });
    const plain = await createUnit(3, {}).expect(201);
    unitIds.push(plain.body.id);
    const filtered = await asAdmin(http().get(`/v1/units?modelId=${villa}&pageSize=50`)).expect(200);
    expect(filtered.body.data.map((u: { id: string }) => u.id)).toEqual([unit.body.id]);

    const pub = await http().get(`/v1/public/units/${unit.body.id}`).set('Accept-Language', 'en').expect(200);
    expect(pub.body.model).toEqual({ code: `A${stamp}`, name: 'Model A' });
  });

  it('EE4-3: a model switched off is not given to a new unit; its units keep it', async () => {
    const [villa] = modelIds;
    await asAdmin(http().patch(`/v1/unit-models/${villa}`)).send({ active: false, area: 330 }).expect(200);
    const off = await createUnit(4, { modelId: villa }).expect(400);
    expect(off.body.message).toContain('موقوف');

    // The unit entered from it keeps it — and its own area (330 is the model's).
    const unitId = unitIds[0]!;
    await asAdmin(http().patch(`/v1/units/${unitId}`)).send({ modelId: villa, floor: 2 }).expect(200);
    const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id: unitId }, select: { modelId: true, area: true } });
    expect(unit).toEqual({ modelId: villa, area: 320 });

    // Cleared.
    await asAdmin(http().patch(`/v1/units/${unitId}`)).send({ modelId: null }).expect(200);
    expect((await testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id: unitId } })).modelId).toBeNull();
  });
});
