/**
 * The operations center's summary: a 14-day series for its trend chart, in
 * the company's days, and "today" counted over the same day — it used the
 * server's day, so today and the chart's last day disagreed.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Operations summary (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  const ids: string[] = [];

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
  });

  afterAll(async () => {
    await testApp.rawPrisma.auditLog.deleteMany({ where: { id: { in: ids } } });
  });

  it("OPS-1: 14 days, oldest first; today is the chart's last day", async () => {
    const companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    // Two events: now, and 2 days ago.
    for (const at of [new Date(), new Date(Date.now() - 2 * 86_400_000)]) {
      const row = await testApp.rawPrisma.auditLog.create({
        data: { companyId, actorId: fixtures.userIds.adminId, action: 'POST', entityType: 'ops-test', createdAt: at },
        select: { id: true },
      });
      ids.push(row.id);
    }
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/operations/summary')
      .set('Authorization', bearer(adminToken))
      .expect(200);
    const daily = res.body.daily as Array<{ date: string; count: number }>;
    expect(daily).toHaveLength(14);
    expect([...daily].map((d) => d.date).sort()).toEqual(daily.map((d) => d.date));
    expect(daily.at(-1)!.count).toBe(res.body.totals.today);
    expect(res.body.totals.today).toBeGreaterThanOrEqual(1);
    expect(daily.at(-3)!.count).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.totals.previous7Days).toBe('number');
  });
});
