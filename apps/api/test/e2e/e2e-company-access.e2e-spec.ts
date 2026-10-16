/**
 * Q5 — a company whose subscription is suspended, cancelled or expired.
 *
 * Every way back in is closed (signed-in requests, token refresh, the public
 * catalog), a trial ends on its end date like a paid period, and reactivating
 * a company whose end date has passed needs a new one.
 */
import 'reflect-metadata';
import request from 'supertest';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer } from '../helpers/login';

describe('Q5 — company subscription enforcement (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let companyId: string;
  let slug: string;
  let superToken: string;
  let superId: string;
  const original: { status: SubscriptionStatus; endAt: Date | null } = { status: SubscriptionStatus.ACTIVE, endAt: null };

  const http = () => request(testApp.app.getHttpServer());
  const setCompany = (data: { subscriptionStatus?: SubscriptionStatus; subscriptionEndAt?: Date | null }) =>
    testApp.rawPrisma.company.update({ where: { id: companyId }, data });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    companyId = admin.companyId!;
    const company = await raw.company.findUniqueOrThrow({ where: { id: companyId } });
    slug = company.slug;
    original.status = company.subscriptionStatus;
    original.endAt = company.subscriptionEndAt;
    const stamp = Date.now().toString().slice(-8);
    superId = (
      await raw.user.create({
        data: { role: UserRole.SUPER_ADMIN, fullName: 'Q5 Platform', email: `q5-super-${stamp}@example.com`, locale: 'en' },
        select: { id: true },
      })
    ).id;
    superToken = await testApp.signAccessToken(superId, 'SUPER_ADMIN');
  });

  afterAll(async () => {
    await setCompany({ subscriptionStatus: original.status, subscriptionEndAt: original.endAt });
    await testApp.rawPrisma.user.deleteMany({ where: { id: superId } }).catch(() => void 0);
  });

  it('Q5-1: a suspended company is locked out — signed-in calls, refresh and the public catalog', async () => {
    const login = await http().post('/v1/auth/login').send({ email: 'admin@example.com', password: 'ChangeMe123!' });
    expect(login.status).toBeLessThan(300);
    const { accessToken, refreshToken } = login.body.tokens;

    await http().get('/v1/public/units').set('X-Tenant-Slug', slug).expect(200);

    await setCompany({ subscriptionStatus: SubscriptionStatus.SUSPENDED });
    try {
      await http().get('/v1/leads').set('Authorization', bearer(accessToken)).expect(403);
      const refresh = await http().post('/v1/auth/refresh').send({ refreshToken });
      expect([401, 403]).toContain(refresh.status);
      await http().get('/v1/public/units').set('X-Tenant-Slug', slug).expect(404);
    } finally {
      await setCompany({ subscriptionStatus: original.status });
    }
    await http().get('/v1/leads').set('Authorization', bearer(accessToken)).expect(200);
  });

  it('Q5-2: a trial past its end date expires in the nightly check', async () => {
    await setCompany({ subscriptionStatus: SubscriptionStatus.TRIAL, subscriptionEndAt: new Date(Date.now() - 86_400_000) });
    await testApp.runCronJob('subscription-expiry');
    const company = await testApp.rawPrisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.subscriptionStatus).toBe(SubscriptionStatus.EXPIRED);
  });

  it('Q5-3: reactivating with a passed end date needs a new one, and it sticks through the nightly check', async () => {
    const activate = (body: object) =>
      http().post(`/v1/super-admin/companies/${companyId}/activate`).set('Authorization', bearer(superToken)).send(body);

    await activate({}).expect(400);
    await activate({ subscriptionEndAt: new Date(Date.now() - 1000).toISOString() }).expect(400);

    const end = new Date(Date.now() + 30 * 86_400_000);
    const ok = await activate({ subscriptionEndAt: end.toISOString() });
    expect(ok.status).toBeLessThan(300);

    await testApp.runCronJob('subscription-expiry');
    const company = await testApp.rawPrisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
    expect(company.subscriptionEndAt?.toISOString()).toBe(end.toISOString());
  });
});
