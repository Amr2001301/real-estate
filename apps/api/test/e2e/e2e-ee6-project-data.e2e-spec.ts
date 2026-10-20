/**
 * EE6 — F10. A project had a name, a city and a map pin: no type (compound,
 * coastal, administrative …), no district, no land area, no license number.
 * They are entered on the project, shown on the public site, and the lists
 * filter by type.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';

describe('EE6 — project data (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let companyId: string;
  const projectIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  // Made directly (the demo company is at its plan's project limit); the
  // fields are written through the API.
  const createProject = async (n: number, extra: Record<string, unknown>) => {
    const p = await testApp.rawPrisma.project.create({
      data: {
        companyId,
        code: `EE6-${stamp}-${n}`,
        name: { ar: `مشروع ${n}`, en: `Project ${n}` },
        description: { ar: '', en: '' },
        city: 'القاهرة الجديدة',
        lat: 30.03,
        lng: 31.47,
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    projectIds.push(p.id);
    return asAdmin(http().patch(`/v1/projects/${p.id}`)).send(extra).expect(200);
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const fixtures: E2EFixtures = await loadE2EFixtures(testApp.rawPrisma);
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
  });

  afterAll(async () => {
    await testApp.rawPrisma.project.deleteMany({ where: { id: { in: projectIds } } });
  });

  it('EE6-1: a project carries its type, district, land area and license number', async () => {
    const res = await createProject(1, {
      type: 'RESIDENTIAL',
      district: 'التجمع الخامس',
      totalArea: 420_000,
      licenseNumber: ' 123/2024 ',
    });
    expect(res.body).toMatchObject({
      type: 'RESIDENTIAL',
      district: 'التجمع الخامس',
      totalArea: 420_000,
      licenseNumber: '123/2024',
    });

    const pub = await http().get(`/v1/public/projects/${res.body.id}`).expect(200);
    expect(pub.body).toMatchObject({
      type: 'RESIDENTIAL',
      district: 'التجمع الخامس',
      totalArea: 420_000,
      licenseNumber: '123/2024',
    });

    // Cleared and changed.
    const upd = await asAdmin(http().patch(`/v1/projects/${res.body.id}`))
      .send({ type: 'MIXED_USE', licenseNumber: null, district: '' })
      .expect(200);
    expect(upd.body).toMatchObject({ type: 'MIXED_USE', licenseNumber: null, district: null, totalArea: 420_000 });

    await asAdmin(http().patch(`/v1/projects/${res.body.id}`)).send({ type: 'CASTLE' }).expect(400);
    await asAdmin(http().patch(`/v1/projects/${res.body.id}`)).send({ totalArea: -1 }).expect(400);
  });

  it('EE6-2: the lists filter by type', async () => {
    const coastal = await createProject(2, { type: 'COASTAL' });
    const ids = (body: { data: Array<{ id: string }> }) => body.data.map((p) => p.id);

    const pub = await http().get('/v1/public/projects?type=COASTAL&pageSize=50').expect(200);
    expect(ids(pub.body)).toContain(coastal.body.id);
    expect(ids(pub.body)).not.toContain(projectIds[0]);
    expect(pub.body.data.find((p: { id: string }) => p.id === coastal.body.id).type).toBe('COASTAL');

    const staff = await asAdmin(http().get('/v1/projects?type=MIXED_USE&pageSize=50')).expect(200);
    expect(ids(staff.body)).toContain(projectIds[0]);
    expect(ids(staff.body)).not.toContain(coastal.body.id);
  });
});
