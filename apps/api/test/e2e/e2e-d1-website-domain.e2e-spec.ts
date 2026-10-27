/**
 * D1 — «دومين الموقع»: the company's website domain is connected by the
 * platform owner, not by the company.
 *
 * - The company's admin reads its domains, and can no longer add, check,
 *   set primary or remove one.
 * - The platform owner does all of it under /super-admin/companies/:id/domains,
 *   for that company only: a domain of another company answers 404.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('D1 — website domain belongs to the platform owner (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let platformToken: string;
  let adminToken: string;
  let companyId: string;
  let otherCompanyId: string;
  const stamp = Date.now().toString().slice(-8);
  const hostname = `d1-${stamp}.example.com`;
  const otherHostname = `d1-other-${stamp}.example.com`;

  const http = () => request(testApp.app.getHttpServer());
  const base = (id: string) => `/v1/super-admin/companies/${id}/domains`;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    platformToken = await loginAs(testApp.app, 'platform@example.com', 'PlatformPass1!!');
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { companyId: true },
    });
    companyId = admin.companyId!;
    otherCompanyId = (
      await testApp.rawPrisma.company.create({
        data: { name: `D1 Other ${stamp}`, slug: `d1-other-${stamp}` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await testApp.rawPrisma.companyDomain.deleteMany({ where: { hostname: { in: [hostname, otherHostname] } } });
    await testApp.rawPrisma.companyDomain.deleteMany({ where: { companyId: otherCompanyId } });
    await testApp.rawPrisma.company.deleteMany({ where: { id: otherCompanyId } });
  });

  it('D1-1: the company admin reads its domains but cannot change them', async () => {
    await http().get('/v1/company-domains').set('Authorization', bearer(adminToken)).expect(200);
    await http().post('/v1/company-domains').set('Authorization', bearer(adminToken)).send({ hostname }).expect(404);
    // Nor through the platform owner's routes.
    await http().get(base(companyId)).set('Authorization', bearer(adminToken)).expect(403);
    await http().post(base(companyId)).set('Authorization', bearer(adminToken)).send({ hostname }).expect(403);
  });

  it('D1-2: the platform owner adds a domain, with the records to set at the provider', async () => {
    const res = await http().post(base(companyId)).set('Authorization', bearer(platformToken)).send({ hostname }).expect(201);
    expect(res.body.hostname).toBe(hostname);
    expect(res.body.type).toBe('CUSTOM');
    expect(res.body.verifiedAt).toBeNull();
    expect(res.body.dns.map((r: { purpose: string }) => r.purpose)).toEqual(expect.arrayContaining(['routing', 'ownership']));

    const list = await http().get(base(companyId)).set('Authorization', bearer(platformToken)).expect(200);
    expect(list.body.map((d: { hostname: string }) => d.hostname)).toContain(hostname);
    // The company admin sees it too.
    const mine = await http().get('/v1/company-domains').set('Authorization', bearer(adminToken)).expect(200);
    expect(mine.body.map((d: { hostname: string }) => d.hostname)).toContain(hostname);
  });

  it('D1-3: check, primary and remove work for that company only', async () => {
    const domain = await testApp.rawPrisma.companyDomain.findUniqueOrThrow({ where: { hostname }, select: { id: true } });
    const auth = bearer(platformToken);

    // Under another company's path the domain does not exist.
    await http().post(`${base(otherCompanyId)}/${domain.id}/verify`).set('Authorization', auth).expect(404);
    await http().post(`${base(otherCompanyId)}/${domain.id}/primary`).set('Authorization', auth).expect(404);
    await http().delete(`${base(otherCompanyId)}/${domain.id}`).set('Authorization', auth).expect(404);

    // The DNS records are not in place: not verified, so not primary.
    const check = await http().post(`${base(companyId)}/${domain.id}/verify`).set('Authorization', auth).expect(201);
    expect(check.body.verified).toBe(false);
    await http().post(`${base(companyId)}/${domain.id}/primary`).set('Authorization', auth).expect(400);

    await http().delete(`${base(companyId)}/${domain.id}`).set('Authorization', auth).expect(200);
    expect(await testApp.rawPrisma.companyDomain.count({ where: { hostname } })).toBe(0);
  });

  it('D1-4: a company that does not exist answers 404', async () => {
    const missing = '00000000-0000-4000-8000-00000000d100';
    await http().get(base(missing)).set('Authorization', bearer(platformToken)).expect(404);
    await http().post(base(missing)).set('Authorization', bearer(platformToken)).send({ hostname: otherHostname }).expect(404);
  });
});
