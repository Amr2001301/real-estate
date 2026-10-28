/**
 * PRM phase 2f — the unit export (the company's full price list) opens by
 * units:export, which is in no role's starting set; units:read alone, which
 * every rep starts with, does not export.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2f — unit export opens by units:export (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`))
      .send(remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes })
      .expect(200);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const created = await as(adminToken, http().post('/v1/users'))
      .send({
        role: 'SALES',
        fullName: 'PRM2f Rep',
        email: `prm2f-rep-${stamp}@example.com`,
        password: 'Prm2fRepPass123!',
      })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM2f-1: units:read does not export; units:export does, the same rows as the admin’s', async () => {
    const mine = (await as(repToken, http().get('/v1/me/permissions')).expect(200)).body
      .codes as string[];
    expect(mine).toContain('units:read');
    expect(mine).not.toContain('units:export');
    await as(repToken, http().get('/v1/units/export.csv')).expect(403);

    await grant(['units:export']);
    const csv = (await as(repToken, http().get('/v1/units/export.csv')).expect(200)).text;
    const adminCsv = (await as(adminToken, http().get('/v1/units/export.csv')).expect(200)).text;
    expect(csv).toBe(adminCsv);
    await as(repToken, http().get('/v1/units/export.xlsx')).expect(200);
    await grant(['units:export'], true);
    await as(repToken, http().get('/v1/units/export.csv')).expect(403);
  });
});
