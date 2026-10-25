/**
 * MA1 — each company's own customer app in the stores.
 *
 * - Only the platform owner sets it: name, package id, icon, status, store links.
 * - The read carries what a build needs: the company's slug and brand colours.
 * - A package id is one company's: the shared apps' ids and another company's
 *   are refused.
 * - Removing it sends the company back to the shared customer app.
 * - Icon/splash uploads are PNG within their size.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('MA1 — company mobile app (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let adminToken: string;
  let companyId: string;
  let otherCompanyId: string;
  const stamp = Date.now().toString().slice(-7);
  const packageId = `com.ma1test${stamp}.homes`;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const url = (id: string) => `/v1/super-admin/companies/${id}/mobile-app`;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [platformToken, adminToken] = await Promise.all([
      loginAs(testApp.app, 'platform@example.com', 'PlatformPass1!!'),
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
    ]);
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } });
    companyId = admin.companyId!;
    const other = await testApp.rawPrisma.company.create({ data: { name: `MA1 ${stamp}`, slug: `ma1-${stamp}` } });
    otherCompanyId = other.id;
    await testApp.rawPrisma.companyMobileApp.deleteMany({ where: { companyId } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.companyMobileApp.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
    await raw.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('MA1-1: only the platform owner reads or sets it', async () => {
    await as(adminToken, http().get(url(companyId))).expect(403);
    await as(adminToken, http().put(url(companyId)))
      .send({ appNameAr: 'تطبيق', appNameEn: 'App', packageId })
      .expect(403);
    const none = await as(platformToken, http().get(url(companyId))).expect(200);
    expect(none.body.app).toBeNull();
    expect(none.body.company).toMatchObject({ id: companyId });
    expect(typeof none.body.company.slug).toBe('string');
  });

  it('MA1-2: the platform owner sets the app; the read carries what a build needs', async () => {
    const res = await as(platformToken, http().put(url(companyId)))
      .send({
        appNameAr: 'بيوت أكمي',
        appNameEn: 'Acme Homes',
        packageId,
        iconUrl: 'https://cdn.example.com/branding/icon.png',
      })
      .expect(200);
    expect(res.body.app).toMatchObject({ appNameAr: 'بيوت أكمي', packageId, status: 'DRAFT', splashUrl: null });
    expect(res.body.company).toHaveProperty('primaryColor');

    // A later save changes only what it sends.
    const published = await as(platformToken, http().put(url(companyId)))
      .send({
        appNameAr: 'بيوت أكمي',
        appNameEn: 'Acme Homes',
        packageId,
        status: 'PUBLISHED',
        playStoreUrl: `https://play.google.com/store/apps/details?id=${packageId}`,
      })
      .expect(200);
    expect(published.body.app).toMatchObject({ status: 'PUBLISHED', iconUrl: 'https://cdn.example.com/branding/icon.png' });
  });

  it("MA1-3: a package id is one company's — the shared apps' and a taken one are refused", async () => {
    const base = { appNameAr: 'تطبيق', appNameEn: 'App' };
    await as(platformToken, http().put(url(otherCompanyId)))
      .send({ ...base, packageId: 'com.realestate.customer.mobile_customer' })
      .expect(400);
    await as(platformToken, http().put(url(otherCompanyId))).send({ ...base, packageId: 'Not.Valid-id' }).expect(400);
    await as(platformToken, http().put(url(otherCompanyId))).send({ ...base, packageId: 'single' }).expect(400);
    await as(platformToken, http().put(url(otherCompanyId))).send({ ...base, packageId }).expect(409);
    await as(platformToken, http().put(url(otherCompanyId)))
      .send({ ...base, packageId, playStoreUrl: 'http://not-https.example.com' })
      .expect(400);
  });

  it('MA1-4: removing it sends the company back to the shared app', async () => {
    const res = await as(platformToken, http().delete(url(companyId))).expect(200);
    expect(res.body.app).toBeNull();
    expect(await testApp.rawPrisma.companyMobileApp.count({ where: { companyId } })).toBe(0);
    await as(platformToken, http().get(url('00000000-0000-0000-0000-00000000dead'))).expect(404);
  });

  it('MA1-5: icon and splash uploads are PNG within their size', async () => {
    const presign = (body: Record<string, unknown>) =>
      as(platformToken, http().post('/v1/super-admin/mobile-app/presign')).send(body);
    await presign({ asset: 'icon', contentType: 'image/jpeg', sizeBytes: 1000 }).expect(400);
    await presign({ asset: 'icon', contentType: 'image/png', sizeBytes: 1024 * 1024 + 1 }).expect(400);
    await presign({ asset: 'logo', contentType: 'image/png', sizeBytes: 1000 }).expect(400);
    await as(adminToken, http().post('/v1/super-admin/mobile-app/presign'))
      .send({ asset: 'icon', contentType: 'image/png', sizeBytes: 1000 })
      .expect(403);
  });
});
