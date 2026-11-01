/**
 * CMS1 — the content page's pages and banners reach the public site.
 *
 * - A page address (slug) is the company's own: two companies can each have
 *   /about, and saving one never touches the other's.
 * - The site lists a company's published pages (footer, sitemap) and opens
 *   one by its address; a draft or a missing page is a 404.
 * - A page is deleted by its company only.
 * - Banners: only active ones reach the site; the admin hides and shows one,
 *   and a banner link is a site path or a web address — never a script.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('CMS1 — pages and banners on the public site (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let otherToken: string;
  let slugA: string;
  let companyB: string;
  let slugB: string;
  let userB: string;
  const stamp = Date.now().toString().slice(-7);
  const pageSlug = `about-${stamp}`;
  const draftSlug = `draft-${stamp}`;
  const bannerIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const page = (slug: string, ar: string, published = true) => ({
    slug,
    ar_title: ar,
    en_title: `${ar} (en)`,
    ar_body: `نص ${ar}`,
    en_body: `Body of ${ar}`,
    published,
  });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { slug: true } } },
    });
    slugA = admin.company!.slug;

    slugB = `cms1-b-${stamp}`;
    companyB = (
      await testApp.rawPrisma.company.create({ data: { name: `CMS1 B ${stamp}`, slug: slugB }, select: { id: true } })
    ).id;
    userB = (
      await testApp.rawPrisma.user.create({
        data: { role: UserRole.ADMIN, companyId: companyB, fullName: 'CMS1 B admin', email: `cms1-b-${stamp}@example.com`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    otherToken = await testApp.signAccessToken(userB, 'ADMIN');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.cmsPage.deleteMany({ where: { slug: { in: [pageSlug, draftSlug] } } });
    await raw.banner.deleteMany({ where: { id: { in: bannerIds } } });
    await raw.user.deleteMany({ where: { id: userB } }).catch(() => void 0);
    await raw.company.deleteMany({ where: { id: companyB } }).catch(() => void 0);
  });

  it('CMS1-1: two companies each keep their own page at the same address', async () => {
    await as(adminToken, http().post('/v1/cms/pages')).send(page(pageSlug, 'من نحن أ')).expect(201);
    await as(otherToken, http().post('/v1/cms/pages')).send(page(pageSlug, 'من نحن ب')).expect(201);
    // Saving again updates the company's own page, not the other's.
    await as(adminToken, http().post('/v1/cms/pages')).send(page(pageSlug, 'من نحن أ ٢')).expect(201);

    const a = await http().get(`/v1/public/pages/${pageSlug}`).set('X-Tenant-Slug', slugA).set('Accept-Language', 'ar').expect(200);
    const b = await http().get(`/v1/public/pages/${pageSlug}`).set('X-Tenant-Slug', slugB).set('Accept-Language', 'ar').expect(200);
    expect(a.body.title).toBe('من نحن أ ٢');
    expect(b.body.title).toBe('من نحن ب');
    expect(await testApp.rawPrisma.cmsPage.count({ where: { slug: pageSlug } })).toBe(2);
  });

  it('CMS1-2: the site lists only published pages; a draft or a missing page is 404', async () => {
    await as(adminToken, http().post('/v1/cms/pages')).send(page(draftSlug, 'مسودة', false)).expect(201);

    const list = await http().get('/v1/public/pages').set('X-Tenant-Slug', slugA).set('Accept-Language', 'ar').expect(200);
    const slugs = (list.body as Array<{ slug: string; title: string }>).map((p) => p.slug);
    expect(slugs).toContain(pageSlug);
    expect(slugs).not.toContain(draftSlug);
    expect(list.body.find((p: { slug: string }) => p.slug === pageSlug).title).toBe('من نحن أ ٢');
    // The other company's pages are not listed on this company's site.
    const listB = await http().get('/v1/public/pages').set('X-Tenant-Slug', slugB).expect(200);
    expect((listB.body as unknown[]).length).toBe(1);

    await http().get(`/v1/public/pages/${draftSlug}`).set('X-Tenant-Slug', slugA).expect(404);
    await http().get(`/v1/public/pages/missing-${stamp}`).set('X-Tenant-Slug', slugA).expect(404);
  });

  it('CMS1-3: a page address is letters, digits and dashes', async () => {
    for (const bad of ['About Us', '../admin', 'من-نحن', '-about']) {
      await as(adminToken, http().post('/v1/cms/pages')).send(page(bad, 'خطأ')).expect(400);
    }
  });

  it('CMS1-4: a page is deleted by its own company only', async () => {
    const own = await testApp.rawPrisma.cmsPage.findFirstOrThrow({ where: { slug: draftSlug }, select: { id: true } });
    await as(otherToken, http().delete(`/v1/cms/pages/${own.id}`)).expect(404);
    await as(adminToken, http().delete(`/v1/cms/pages/${own.id}`)).expect(200);
    expect(await testApp.rawPrisma.cmsPage.count({ where: { id: own.id } })).toBe(0);
  });

  it('CMS1-5: only active banners reach the site; the admin hides and shows one', async () => {
    const res = await as(adminToken, http().post('/v1/cms/banners'))
      .send({ imageUrl: 'https://cdn.example.com/b.jpg', ar_title: `عرض ${stamp}`, en_title: `Offer ${stamp}`, link: '/projects' })
      .expect(201);
    bannerIds.push(res.body.id);
    const onSite = async (slug: string) =>
      ((await http().get('/v1/public/banners').set('X-Tenant-Slug', slug).expect(200)).body as Array<{ id: string }>).some(
        (b) => b.id === res.body.id,
      );

    expect(await onSite(slugA)).toBe(true);
    expect(await onSite(slugB)).toBe(false);

    await as(adminToken, http().patch(`/v1/cms/banners/${res.body.id}`)).send({ active: false }).expect(200);
    expect(await onSite(slugA)).toBe(false);
    // Another company cannot touch it.
    await as(otherToken, http().patch(`/v1/cms/banners/${res.body.id}`)).send({ active: true }).expect(404);
    await as(otherToken, http().delete(`/v1/cms/banners/${res.body.id}`)).expect(404);
    await as(adminToken, http().patch(`/v1/cms/banners/${res.body.id}`)).send({ active: true }).expect(200);
    expect(await onSite(slugA)).toBe(true);
  });

  it('CMS1-6: a banner link is a site path or a web address; its image a web address', async () => {
    const send = (body: Record<string, unknown>) =>
      as(adminToken, http().post('/v1/cms/banners')).send({ ar_title: 'ب', en_title: 'B', imageUrl: 'https://cdn.example.com/b.jpg', ...body });
    for (const link of ['javascript:alert(1)', '//evil.example.com', 'data:text/html,x']) {
      await send({ link }).expect(400);
    }
    await send({ imageUrl: 'javascript:alert(1)' }).expect(400);
    const ok = await send({ link: 'https://example.com/offer' }).expect(201);
    bannerIds.push(ok.body.id);
  });
});
