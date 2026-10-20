/**
 * EE5 — F10. A unit had no handover date. A phase now has one, a unit may
 * have its own (a later block, a garage), the unit shows the one that
 * applies, and the lists filter by it ("handed over by …", "ready now").
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('EE5 — handover dates (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId = '';
  let phaseId = '';
  let buildingId = '';
  const unitIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const createUnit = (code: string, extra: Record<string, unknown> = {}) =>
    asAdmin(http().post('/v1/units')).send({
      buildingId,
      code,
      type: '2BR',
      area: 100,
      bedrooms: 2,
      floor: 1,
      pricePerMeter: 20_000,
      ...extra,
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    projectId = (
      await testApp.rawPrisma.project.create({
        data: {
          companyId,
          code: `EE5-P-${stamp}`,
          name: { ar: 'مشروع EE5', en: 'EE5' },
          description: { ar: '', en: '' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: 'PUBLISHED',
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    if (projectId) await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('EE5-1: a phase has a handover date; its units show it unless they have their own', async () => {
    const phase = await asAdmin(http().post('/v1/phases'))
      .send({ projectId, code: 'EE5-PH', name: { ar: 'المرحلة الأولى', en: 'Phase 1' }, deliveryDate: '2027-06-30' })
      .expect(201);
    phaseId = phase.body.id;
    expect(phase.body.deliveryDate.slice(0, 10)).toBe('2027-06-30');
    buildingId = (
      await testApp.rawPrisma.building.create({ data: { companyId, phaseId, code: 'EE5-B', name: 'B', order: 0 }, select: { id: true } })
    ).id;

    const plain = await createUnit(`EE5-${stamp}-1`).expect(201);
    const later = await createUnit(`EE5-${stamp}-2`, { deliveryDate: '2028-12-31' }).expect(201);
    unitIds.push(plain.body.id, later.body.id);

    const a = await asAdmin(http().get(`/v1/units/${plain.body.id}`)).expect(200);
    expect(a.body.effectiveDeliveryDate).toBe('2027-06-30');
    const b = await asAdmin(http().get(`/v1/units/${later.body.id}`)).expect(200);
    expect(b.body.effectiveDeliveryDate).toBe('2028-12-31');
    const pub = await http().get(`/v1/public/units/${later.body.id}`).expect(200);
    expect(pub.body.deliveryDate).toBe('2028-12-31');

    // The phase moves: the unit without its own date follows.
    await asAdmin(http().patch(`/v1/phases/${phaseId}`)).send({ deliveryDate: '2027-09-30' }).expect(200);
    const moved = await asAdmin(http().get(`/v1/units/${plain.body.id}`)).expect(200);
    expect(moved.body.effectiveDeliveryDate).toBe('2027-09-30');

    // The unit's own date cleared → the phase's.
    await asAdmin(http().patch(`/v1/units/${later.body.id}`)).send({ deliveryDate: null }).expect(200);
    const cleared = await asAdmin(http().get(`/v1/units/${later.body.id}`)).expect(200);
    expect(cleared.body.effectiveDeliveryDate).toBe('2027-09-30');
    await asAdmin(http().patch(`/v1/units/${later.body.id}`)).send({ deliveryDate: '2028-12-31' }).expect(200);
  });

  it('EE5-2: the lists filter by "handed over by"', async () => {
    const ids = (body: { data: Array<{ id: string }> }) => body.data.map((u) => u.id);
    const [plain, later] = unitIds;
    const by2027 = await asAdmin(http().get(`/v1/units?q=EE5-${stamp}&deliveryBy=2027-12-31`)).expect(200);
    expect(ids(by2027.body)).toEqual([plain]);
    const by2029 = await asAdmin(http().get(`/v1/units?q=EE5-${stamp}&deliveryBy=2029-01-01`)).expect(200);
    expect(ids(by2029.body).sort()).toEqual([plain, later].sort());
    const pub = await http().get(`/v1/public/units?projectId=${projectId}&deliveryBy=2027-12-31`).expect(200);
    expect(ids(pub.body)).toEqual([plain]);
    await http().get('/v1/public/units?deliveryBy=soon').expect(400);
  });
});
