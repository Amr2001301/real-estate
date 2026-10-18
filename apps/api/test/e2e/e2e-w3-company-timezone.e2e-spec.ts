/**
 * W3 — the web picks "today" and "this month" in the company's time zone, not
 * the server's UTC (decided 2026-10-18): for the first hours of a month in
 * Cairo the reports opened on the last month. GET /company/currency, open to
 * every signed-in role, now carries the company's time zone.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('W3 — company time zone for the web (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let before: unknown;

  const get = async () =>
    (await request(testApp.app.getHttpServer()).get('/v1/company/currency').set('Authorization', bearer(adminToken)).expect(200))
      .body as { currency: string; timeZone?: string };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    before = (await testApp.rawPrisma.setting.findFirst({ where: { companyId, key: 'company.timezone' } }))?.value;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    if (before === undefined) await raw.setting.deleteMany({ where: { companyId, key: 'company.timezone' } });
    else await raw.setting.update({ where: { companyId_key: { companyId, key: 'company.timezone' } }, data: { value: before as string } });
  });

  it('W3-1: the company currency endpoint carries the company time zone', async () => {
    await testApp.rawPrisma.setting.upsert({
      where: { companyId_key: { companyId, key: 'company.timezone' } },
      create: { companyId, key: 'company.timezone', value: 'Asia/Dubai' },
      update: { value: 'Asia/Dubai' },
    });
    const body = await get();
    expect(body.timeZone).toBe('Asia/Dubai');
    expect(typeof body.currency).toBe('string');
  });
});
