/**
 * PRM phase 1 — the permission opens the page.
 *
 * - A staff member outside a route's roles is let in by holding its code
 *   (@GrantedBy): inventory edits, campaigns and lead intake, lead sources
 *   and lost reasons, the website content, notification templates and
 *   sending. Without the code the route stays closed, as before.
 * - The admin-only codes (people, permissions, settings, branding, audit
 *   log) are never given to a non-admin, and one held from before opens
 *   nothing.
 * - GET /me/permissions tells the sidebar which codes count.
 * - A sales manager keeps reading campaigns by role, as before.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM1 — permissions open pages (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  let managerToken: string;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`)).send(
      remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes },
    );
  const insertCode = async (code: string) => {
    const p = await testApp.rawPrisma.permission.findUniqueOrThrow({ where: { code } });
    await testApp.rawPrisma.userPermission.createMany({ data: [{ userId: repId, permissionId: p.id }], skipDuplicates: true });
  };
  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const created = await as(adminToken, http().post('/v1/users'))
      .send({ role: 'SALES', fullName: 'PRM1 Rep', email: `prm1-rep-${stamp}@example.com`, password: 'Prm1RepPass123!' })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');
    managerToken = await testApp.signAccessToken(fixtures.userIds.managerId, 'SALES_MANAGER');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM1-1: without the code the admin page stays closed; with it, it opens', async () => {
    const p1 = fixtures.projects.p1Id;
    const before = await testApp.rawPrisma.project.findUniqueOrThrow({ where: { id: p1 }, select: { district: true } });
    await as(repToken, http().get('/v1/cms/pages')).expect(403);
    await as(repToken, http().patch(`/v1/projects/${p1}`)).send({ district: `PRM1 ${stamp}` }).expect(403);

    await grant(['cms:pages:manage', 'projects:update']).expect(200);
    await as(repToken, http().get('/v1/cms/pages')).expect(200);
    await as(repToken, http().patch(`/v1/projects/${p1}`)).send({ district: `PRM1 ${stamp}` }).expect(200);
    expect((await testApp.rawPrisma.project.findUniqueOrThrow({ where: { id: p1 } })).district).toBe(`PRM1 ${stamp}`);
    await testApp.rawPrisma.project.update({ where: { id: p1 }, data: { district: before.district } });

    // One code opens its own routes only.
    await as(repToken, http().delete(`/v1/projects/${p1}`)).expect(403);
    await as(repToken, http().get('/v1/cms/banners')).expect(403);
    await grant(['cms:pages:manage', 'projects:update'], true).expect(200);
    await as(repToken, http().get('/v1/cms/pages')).expect(403);
  });

  it('PRM1-2: campaigns open to a rep with campaigns:manage; a manager still reads them by role', async () => {
    await as(repToken, http().get('/v1/campaigns')).expect(403);
    await as(repToken, http().get('/v1/lead-intake/keys')).expect(403);
    await as(managerToken, http().get('/v1/campaigns')).expect(200);

    await grant(['campaigns:manage']).expect(200);
    await as(repToken, http().get('/v1/campaigns')).expect(200);
    await as(repToken, http().get('/v1/campaigns/report')).expect(200);
    await as(repToken, http().get('/v1/lead-intake/keys')).expect(200);
    await as(repToken, http().get('/v1/lead-intake/settings')).expect(200);
    await grant(['campaigns:manage'], true).expect(200);
  });

  it('PRM1-3: admin-only codes are never given to a non-admin, and one held from before opens nothing', async () => {
    for (const code of ['settings:write', 'users:read', 'permissions:manage', 'company_branding:manage', 'audit:read']) {
      const res = await grant([code]).expect(400);
      expect(res.body.message).toContain('لمدير النظام فقط');
    }
    expect(
      await testApp.rawPrisma.userPermission.count({ where: { userId: repId, permission: { code: { in: ['settings:write', 'users:read'] } } } }),
    ).toBe(0);

    // Held from before PRM (written straight to the table): still closed.
    await insertCode('settings:read');
    await insertCode('users:read');
    await as(repToken, http().get('/v1/settings')).expect(403);
    await as(repToken, http().get('/v1/users')).expect(403);
    await as(repToken, http().get('/v1/audit-logs')).expect(403);

    // An admin can still be given any code.
    await as(adminToken, http().patch(`/v1/users/${fixtures.userIds.adminId}/permissions`))
      .send({ addPermissionCodes: ['settings:write'] })
      .expect(200);
  });

  it('PRM1-4: /me/permissions lists the codes that count; the permissions list marks admin-only ones', async () => {
    const mine = (await as(repToken, http().get('/v1/me/permissions')).expect(200)).body;
    expect(mine.role).toBe(UserRole.SALES);
    expect(mine.codes).toContain('leads:read');
    expect(mine.codes).not.toContain('settings:read');
    expect(mine.codes).not.toContain('users:read');

    const admin = (await as(adminToken, http().get('/v1/me/permissions')).expect(200)).body;
    expect(admin.codes).toEqual(expect.arrayContaining(['settings:write', 'users:read', 'cms:pages:manage']));

    const list = (await as(adminToken, http().get(`/v1/users/${repId}/permissions`)).expect(200)).body;
    const all = [...list.assigned, ...list.available] as Array<{ code: string; adminOnly: boolean }>;
    expect(all.find((p) => p.code === 'users:read')!.adminOnly).toBe(true);
    expect(all.find((p) => p.code === 'cms:pages:manage')!.adminOnly).toBe(false);
  });

  it('PRM1-5: the admin passes everywhere as before', async () => {
    await as(adminToken, http().get('/v1/cms/pages')).expect(200);
    await as(adminToken, http().get('/v1/campaigns')).expect(200);
    await as(adminToken, http().get('/v1/settings')).expect(200);
  });
});
