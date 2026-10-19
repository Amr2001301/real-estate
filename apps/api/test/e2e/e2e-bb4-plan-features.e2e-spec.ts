/**
 * BB4 — F36. On a plan without maintenance the admin could still create a
 * maintenance supervisor, whose app then refused every request
 * (CAPABILITY_NOT_ENABLED). The role is now refused for what it is.
 */
import 'reflect-metadata';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('BB4 — plan features (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let original: Prisma.JsonValue = null;
  const userIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const setCapabilities = async (value: Prisma.JsonValue) => {
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { capabilities: value ?? Prisma.DbNull },
    });
    await testApp.flushCapabilities(companyId);
  };
  const createSupervisor = (n: number) =>
    http()
      .post('/v1/users')
      .set('Authorization', bearer(adminToken))
      .send({
        role: 'MAINTENANCE_SUPERVISOR',
        fullName: `BB4 Supervisor ${n}`,
        email: `bb4-sup-${stamp}-${n}@example.com`,
        password: 'Bb4SupPass123!',
      });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const company = await testApp.rawPrisma.company.findFirstOrThrow({
      where: { users: { some: { id: fixtures.userIds.adminId } } },
      select: { id: true, capabilities: true },
    });
    companyId = company.id;
    original = company.capabilities;
  });

  afterAll(async () => {
    await setCapabilities(original);
    const raw = testApp.rawPrisma;
    await raw.userPermission.deleteMany({ where: { userId: { in: userIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('BB4-1: no maintenance supervisor on a plan without maintenance', async () => {
    const base = (original ?? {}) as Prisma.JsonObject;
    await setCapabilities({ ...base, 'feature.maintenance': false });
    const res = await createSupervisor(1);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CAPABILITY_NOT_ENABLED');
    expect(
      await testApp.rawPrisma.user.count({ where: { email: `bb4-sup-${stamp}-1@example.com` } }),
    ).toBe(0);
  });

  it('BB4-2: with maintenance on the plan the supervisor is created', async () => {
    const base = (original ?? {}) as Prisma.JsonObject;
    await setCapabilities({ ...base, 'feature.maintenance': true });
    const res = await createSupervisor(2);
    expect(res.status).toBe(201);
    userIds.push(res.body.id);
  });
});
