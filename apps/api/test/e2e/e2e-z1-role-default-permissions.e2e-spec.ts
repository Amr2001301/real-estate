/**
 * Z1 — new staff start with their role's permissions. The guards ask for
 * permission codes, and a user created from the dashboard got none: a new
 * sales rep saw every page and every one refused them ("ليست لديك الصلاحية
 * المطلوبة") until an admin ticked ~30 boxes by hand. A company's first
 * admin, created by the platform owner, could not do the strict actions
 * (cancel a contract, verify payments) either.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { SALES_DEFAULT_PERMISSIONS } from '../../src/modules/permissions/role-default-permissions';

describe('Z1 — new staff start with their role’s permissions (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  const userIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const codesOf = async (userId: string) =>
    (
      await testApp.rawPrisma.userPermission.findMany({
        where: { userId },
        select: { permission: { select: { code: true } } },
      })
    ).map((r) => r.permission.code);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.notification.deleteMany({ where: { userId: { in: userIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('Z1-1: a sales rep created by the admin has the sales tier and can open their leads', async () => {
    const created = await http()
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .send({
        role: 'SALES',
        fullName: 'Z1 Rep',
        email: `z1-rep-${stamp}@example.com`,
        password: 'Z1RepPass123!',
      })
      .expect(201);
    userIds.push(created.body.id);

    expect((await codesOf(created.body.id)).sort()).toEqual([...SALES_DEFAULT_PERMISSIONS].sort());
    // Nothing strict: the admin still grants approvals and payments by hand.
    expect(await codesOf(created.body.id)).not.toContain('reservations:approve');

    const repToken = await testApp.signAccessToken(created.body.id, 'SALES');
    await http().get('/v1/leads').set('Authorization', bearer(repToken)).expect(200);
  });

  it('Z1-2: a company admin created by the platform owner holds every code', async () => {
    const superId = (
      await testApp.rawPrisma.user.create({
        data: {
          role: UserRole.SUPER_ADMIN,
          fullName: 'Z1 Platform',
          email: `z1-super-${stamp}@example.com`,
          locale: 'en',
        },
        select: { id: true },
      })
    ).id;
    userIds.push(superId);
    const superToken = await testApp.signAccessToken(superId, 'SUPER_ADMIN');

    const created = await http()
      .post(`/v1/super-admin/companies/${companyId}/admin`)
      .set('Authorization', bearer(superToken))
      .send({
        email: `z1-admin-${stamp}@example.com`,
        password: 'Z1AdminPass123!',
        fullName: 'Z1 Admin',
      })
      .expect(201);
    userIds.push(created.body.id);

    const all = await testApp.rawPrisma.permission.count();
    expect((await codesOf(created.body.id)).length).toBe(all);
  });
});
