/**
 * PRM phase 2e — maintenance from the dashboard.
 *
 * - A maintenance supervisor keeps working their own requests in the app;
 *   their starting codes (maintenance:read / resolve) open nothing more.
 * - The new maintenance:manage:all (in no role's starting set) opens the
 *   whole company's requests, reports, assignment and status from the
 *   dashboard, as the admin has them.
 * - A request on a customer's behalf stays with the admin (it needs the
 *   customer list); categories open by maintenance:categories:manage.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2e — maintenance opens by its codes (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
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
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const created = await as(adminToken, http().post('/v1/users'))
      .send({
        role: 'SALES',
        fullName: 'PRM2e Rep',
        email: `prm2e-rep-${stamp}@example.com`,
        password: 'Prm2eRepPass123!',
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

  it('PRM2e-1: a supervisor’s starting codes do not open the dashboard list; a rep without the code neither', async () => {
    const supervisor = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { role: UserRole.MAINTENANCE_SUPERVISOR, email: 'maintenance@example.com' },
      select: { id: true },
    });
    const supToken = await testApp.signAccessToken(supervisor.id, 'MAINTENANCE_SUPERVISOR');
    await as(supToken, http().get('/v1/maintenance-requests')).expect(403);
    await as(supToken, http().get('/v1/me/maintenance-requests')).expect(200);
    await as(repToken, http().get('/v1/maintenance-requests')).expect(403);
    await as(repToken, http().get('/v1/maintenance-categories')).expect(403);
  });

  it('PRM2e-2: maintenance:manage:all opens the whole company’s requests and reports; creating stays with the admin', async () => {
    const requestId = fixtures.flowF.customer1MaintenanceRequestId;
    await grant(['maintenance:manage:all']);
    const mine = (await as(repToken, http().get('/v1/maintenance-requests?pageSize=1')).expect(200))
      .body;
    const admins = (
      await as(adminToken, http().get('/v1/maintenance-requests?pageSize=1')).expect(200)
    ).body;
    expect(mine.meta.total).toBe(admins.meta.total);
    await as(repToken, http().get(`/v1/maintenance-requests/${requestId}`)).expect(200);
    await as(repToken, http().get('/v1/maintenance-requests/reports/summary')).expect(200);
    await as(repToken, http().get('/v1/maintenance-categories')).expect(200);
    await as(repToken, http().post('/v1/maintenance-requests')).send({}).expect(403);
    await as(repToken, http().post('/v1/maintenance-categories'))
      .send({ ar: 'x', en: 'x' })
      .expect(403);
    await grant(['maintenance:manage:all'], true);
    await as(repToken, http().get('/v1/maintenance-requests')).expect(403);
  });
});
