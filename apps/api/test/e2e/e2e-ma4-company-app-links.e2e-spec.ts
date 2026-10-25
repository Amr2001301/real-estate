/**
 * MA4 — what the company's public site says about its own app.
 *
 * - The signing-key fingerprints (for Android App Links) are validated and
 *   stored upper-case, once each.
 * - The build file lists the company's verified domains.
 * - The public branding shows the app (name, store links, package and
 *   fingerprints) only once it is PUBLISHED, and right after a save — the
 *   branding cache is cleared.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const FP_A = Array.from({ length: 32 }, (_, i) => (i + 16).toString(16).padStart(2, '0')).join(':');
const FP_B = Array.from({ length: 32 }, () => 'ab').join(':');

describe('MA4 — company app on the public site (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let companyId: string;
  let slug: string;
  const packageId = `com.ma4test${Date.now().toString().slice(-7)}.app`;

  const http = () => request(testApp.app.getHttpServer());
  const put = (body: Record<string, unknown>) =>
    http()
      .put(`/v1/super-admin/companies/${companyId}/mobile-app`)
      .set('Authorization', bearer(platformToken))
      .send({ appNameAr: 'بيوت', appNameEn: 'Homes', packageId, ...body });
  const branding = () => http().get(`/v1/public/branding?slug=${encodeURIComponent(slug)}`).expect(200);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    platformToken = await loginAs(testApp.app, 'platform@example.com', 'PlatformPass1!!');
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    await testApp.rawPrisma.companyMobileApp.deleteMany({ where: { companyId } });
  });

  afterAll(async () => {
    await testApp.rawPrisma.companyMobileApp.deleteMany({ where: { companyId } });
    await http().get(`/v1/public/branding?slug=${encodeURIComponent(slug)}`);
  });

  it('MA4-1: fingerprints are validated and stored upper-case, once each', async () => {
    await put({ androidSha256: 'not-a-fingerprint' }).expect(400);
    await put({ androidSha256: `${FP_A}:FF` }).expect(400);
    const res = await put({ androidSha256: `${FP_A.toLowerCase()},\n${FP_B}  ${FP_A}` }).expect(200);
    expect(res.body.app.androidSha256).toBe(`${FP_A.toUpperCase()},${FP_B.toUpperCase()}`);
    // The build file lists the verified domains its links open from.
    expect(Array.isArray(res.body.company.domains)).toBe(true);
  });

  it('MA4-2: the public branding shows the app only once it is published', async () => {
    const draft = await branding();
    expect(draft.body.mobileApp).toBeUndefined();

    await put({ status: 'PUBLISHED', playStoreUrl: `https://play.google.com/store/apps/details?id=${packageId}` }).expect(200);
    const published = await branding();
    // The name is translatable: LocaleInterceptor flattens it to the
    // request's language (Arabic by default).
    expect(published.body.mobileApp).toEqual({
      name: 'بيوت',
      packageId,
      playStoreUrl: `https://play.google.com/store/apps/details?id=${packageId}`,
      androidSha256: [FP_A.toUpperCase(), FP_B.toUpperCase()],
    });
  });

  it('MA4-3: removing the app takes it off the site at once', async () => {
    await http()
      .delete(`/v1/super-admin/companies/${companyId}/mobile-app`)
      .set('Authorization', bearer(platformToken))
      .expect(200);
    expect((await branding()).body.mobileApp).toBeUndefined();
  });
});
