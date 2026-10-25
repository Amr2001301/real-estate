/**
 * AI1 — the AI assistant's account with a company, apart from the
 * subscription plans.
 *
 * - The platform owner keeps question packages and opens one for a company at
 *   an agreed price: one month from that day.
 * - The company's admin sees what is left; other roles do not.
 * - Questions are counted once each; 80% and 100% send one notice each; past
 *   the limit or the month the assistant is refused.
 * - A top-up adds to this month; a renewal starts a new month; every step is
 *   on the company's ledger with its price.
 * - The hourly sweep stops an ended month and says so.
 * - The yearly subscription is announced a month before it ends.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('AI1 — assistant packages and company account (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let packageId: string;
  let originalEnd: Date | null = null;
  let originalStatus: string | null = null;
  const startedAt = new Date();
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const ask = () => testApp.aiConsume(companyId);
  const noticeCount = (code: string) =>
    testApp.rawPrisma.notification.count({ where: { companyId, templateCode: code, createdAt: { gte: startedAt } } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [platformToken, adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'platform@example.com', 'PlatformPass1!!'),
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const company = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, subscriptionEndAt: true, subscriptionStatus: true } } },
    });
    companyId = company.company!.id;
    originalEnd = company.company!.subscriptionEndAt;
    originalStatus = company.company!.subscriptionStatus;
    await testApp.rawPrisma.companyAiPlan.deleteMany({ where: { companyId } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.aiLedgerEntry.deleteMany({ where: { companyId } });
    await raw.companyAiPlan.deleteMany({ where: { companyId } });
    if (packageId) await raw.aiPackage.deleteMany({ where: { id: packageId } });
    await raw.notification.deleteMany({
      where: { companyId, templateCode: { startsWith: 'subscription_' }, createdAt: { gte: startedAt } },
    });
    await raw.company.update({
      where: { id: companyId },
      data: { subscriptionEndAt: originalEnd, subscriptionStatus: originalStatus as never },
    });
  });

  it('AI1-1: the platform owner keeps packages and opens one for a company at an agreed price', async () => {
    await as(adminToken, http().post('/v1/super-admin/ai/packages')).send({ name: 'x', questions: 5, price: 1 }).expect(403);
    const pkg = await as(platformToken, http().post('/v1/super-admin/ai/packages'))
      .send({ name: `AI1 ${stamp}`, questions: 5, price: 1500 })
      .expect(201);
    packageId = pkg.body.id;

    const opened = await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/activate`))
      .send({ packageId, price: 1200, note: 'special price' })
      .expect(201);
    expect(opened.body).toMatchObject({ quota: 5, used: 0, remaining: 5, status: 'ACTIVE' });
    const days = (new Date(opened.body.periodEnd).getTime() - new Date(opened.body.periodStart).getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    // Already open → renew or top up instead.
    await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/activate`)).send({ packageId }).expect(409);

    const account = await as(platformToken, http().get(`/v1/super-admin/ai/companies/${companyId}`)).expect(200);
    expect(account.body.ledger).toHaveLength(1);
    expect(account.body.ledger[0]).toMatchObject({ type: 'ACTIVATE', questions: 5 });
    expect(Number(account.body.ledger[0].price)).toBe(1200);
  });

  it("AI1-2: the company's admin sees what is left; other roles do not", async () => {
    const usage = await as(adminToken, http().get('/v1/ai/usage')).expect(200);
    expect(usage.body).toMatchObject({ enabled: true, quota: 5, remaining: 5 });
    await as(salesToken, http().get('/v1/ai/usage')).expect(403);
  });

  it('AI1-3: questions are counted; 80% and 100% are announced once; past the limit is refused', async () => {
    for (let i = 0; i < 3; i++) await ask();
    expect(await noticeCount('subscription_ai_quota_80')).toBe(0);
    await ask(); // 4 of 5 = 80%
    await ask(); // 5 of 5 = 100%
    expect(await noticeCount('subscription_ai_quota_80')).toBeGreaterThan(0);
    const fullNotices = await noticeCount('subscription_ai_quota_exhausted');
    expect(fullNotices).toBeGreaterThan(0);
    await expect(ask()).rejects.toMatchObject({ response: { code: 'AI_QUOTA_EXHAUSTED' } });
    expect(await noticeCount('subscription_ai_quota_exhausted')).toBe(fullNotices);
  });

  it('AI1-4: a top-up adds to this month and is on the ledger', async () => {
    const res = await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/top-up`))
      .send({ questions: 3, price: 300 })
      .expect(201);
    expect(res.body).toMatchObject({ quota: 8, used: 5, remaining: 3, status: 'ACTIVE' });
    await ask();
    const plan = await testApp.rawPrisma.companyAiPlan.findUniqueOrThrow({ where: { companyId } });
    expect(plan.alertedFullAt).toBeNull();
  });

  it('AI1-5: a renewal starts a new month; unused questions do not carry over', async () => {
    const res = await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/renew`))
      .send({ packageId })
      .expect(201);
    expect(res.body).toMatchObject({ quota: 5, used: 0, remaining: 5 });
    const ledger = await testApp.rawPrisma.aiLedgerEntry.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
    expect(ledger.map((e) => e.type)).toEqual(['ACTIVATE', 'TOP_UP', 'RENEW']);
    expect(Number(ledger[2]!.price)).toBe(1500);
  });

  it('AI1-6: an ended month stops the assistant and is announced; a top-up needs a renewal first', async () => {
    await testApp.rawPrisma.companyAiPlan.update({ where: { companyId }, data: { periodEnd: new Date(Date.now() - 60_000) } });
    await testApp.runCronJob('ai-plans');
    const plan = await testApp.rawPrisma.companyAiPlan.findUniqueOrThrow({ where: { companyId } });
    expect(plan.status).toBe('ENDED');
    expect(await noticeCount('subscription_ai_ended')).toBeGreaterThan(0);
    await expect(ask()).rejects.toMatchObject({ response: { code: 'AI_NOT_ACTIVE' } });
    await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/top-up`))
      .send({ questions: 3, price: 300 })
      .expect(400);
    const attention = await as(platformToken, http().get('/v1/super-admin/ai/attention')).expect(200);
    expect((attention.body as Array<{ company: { id: string }; reason: string }>).find((a) => a.company.id === companyId)?.reason).toBe('ENDED');
  });

  it('AI1-7: the yearly subscription is announced a month before it ends', async () => {
    await testApp.rawPrisma.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'ACTIVE', subscriptionEndAt: new Date(Date.now() + 29.5 * 86_400_000) },
    });
    await testApp.runCronJob('subscription-expiry');
    const notice = await testApp.rawPrisma.notification.findFirst({
      where: { companyId, templateCode: 'subscription_expiring_soon', createdAt: { gte: startedAt } },
    });
    expect(notice).not.toBeNull();
    expect((notice!.payload as { daysLeft?: number }).daysLeft).toBe(30);
  });

  it('AI1-8: a question given back after 100% re-arms that notice', async () => {
    // A fresh period on the 5-question package, then all 5 asked.
    await testApp.rawPrisma.company.update({ where: { id: companyId }, data: { subscriptionStatus: originalStatus as never } });
    await as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/renew`)).send({ packageId }).expect(201);
    for (let i = 0; i < 5; i++) await ask();
    let plan = await testApp.rawPrisma.companyAiPlan.findUniqueOrThrow({ where: { companyId } });
    expect(plan.alertedFullAt).not.toBeNull();
    // The model failed on the last one: it is given back.
    await testApp.aiRefund(companyId);
    plan = await testApp.rawPrisma.companyAiPlan.findUniqueOrThrow({ where: { companyId } });
    expect(plan.used).toBe(4);
    expect(plan.alertedFullAt).toBeNull();
    expect(plan.alerted80At).not.toBeNull(); // still at 80%
    const before = await noticeCount('subscription_ai_quota_exhausted');
    await ask(); // 5 of 5 for real
    expect(await noticeCount('subscription_ai_quota_exhausted')).toBe(before + 1);
  });

  it('AI1-9: two "enable" clicks at once — one period, one ledger entry', async () => {
    await testApp.rawPrisma.aiLedgerEntry.deleteMany({ where: { companyId } });
    await testApp.rawPrisma.companyAiPlan.deleteMany({ where: { companyId } });
    const enable = () =>
      as(platformToken, http().post(`/v1/super-admin/ai/companies/${companyId}/activate`)).send({ packageId });
    const codes = (await Promise.all([enable(), enable(), enable()])).map((r) => r.status).sort();
    expect(codes).toEqual([201, 409, 409]);
    expect(await testApp.rawPrisma.aiLedgerEntry.count({ where: { companyId, type: 'ACTIVATE' } })).toBe(1);
  });
});
