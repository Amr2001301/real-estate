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
import { xlsxText } from '../helpers/xlsx-text';

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
    await as(repToken, http().get('/v1/units/export.xlsx')).expect(403);

    await grant(['units:export']);
    const mineX = await xlsxText(as(repToken, http().get('/v1/units/export.xlsx')));
    const adminX = await xlsxText(as(adminToken, http().get('/v1/units/export.xlsx')));
    expect(mineX.status).toBe(200);
    // Same rows; the title block carries the export time and the footer who
    // issued it, so compare the table (header row to footer).
    const rows = (t: string) => t.slice(t.indexOf('كود الوحدة'), t.lastIndexOf('صادر عن'));
    expect(rows(mineX.text)).toBe(rows(adminX.text));
    // Each file says who issued it.
    expect(mineX.text).toContain('أصدره:');
    expect(adminX.text).toContain('أصدره:');
    expect(mineX.text.slice(mineX.text.lastIndexOf('أصدره:'))).not.toBe(adminX.text.slice(adminX.text.lastIndexOf('أصدره:')));
    await grant(['units:export'], true);
    await as(repToken, http().get('/v1/units/export.xlsx')).expect(403);
  });
});
