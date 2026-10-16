/**
 * T1 — security and privacy on the customer and public side.
 *
 * - A phone code signs in customers only, never a staff account.
 * - Registration answers the same for every number already on file.
 * - The public catalogue shows PUBLISHED projects only and no sales figures.
 * - A company cannot hang phases, buildings, units or media under another
 *   company's records, nor delete another company's media.
 * - A customer's payments come without staff names or internal reasons.
 */
import 'reflect-metadata';
import { createHash } from 'crypto';
import request from 'supertest';
import * as argon2 from 'argon2';
import { DepositReviewStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const COMPANY_B_SLUG = 'pp-test-company-b';
const COMPANY_B_ADMIN_EMAIL = 'pp-admin-b@example.com';

describe('T1 — public & customer privacy (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let slug: string;
  let companyBId: string;
  let projectB: string;
  let phaseB: string;
  let buildingB: string;
  let mediaB: string;
  let draftId: string;
  const stamp = Date.now().toString().slice(-7);
  const staffPhone = `+20112${stamp}`;
  const deletedPhone = `+20113${stamp}`;
  const createdUserIds: string[] = [];
  const depositIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const giveCode = (phone: string, code: string) =>
    testApp.rawPrisma.otpCode.create({
      data: {
        phone,
        codeHash: createHash('sha256').update(code).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        companyId,
      },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const admin = await raw.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    await testApp.flushCapabilities(companyId);

    const leftover = await raw.company.findFirst({ where: { slug: COMPANY_B_SLUG } });
    if (leftover) {
      await raw.project.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }
    companyBId = (
      await raw.company.create({ data: { name: 'PP Company B', slug: COMPANY_B_SLUG, isActive: true, country: 'EG' } })
    ).id;
    await raw.user.create({
      data: {
        email: COMPANY_B_ADMIN_EMAIL,
        passwordHash: await argon2.hash('ChangeMe123!'),
        fullName: 'PP Admin B',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });
    projectB = (
      await raw.project.create({
        data: {
          companyId: companyBId,
          code: 'PP-B',
          name: { ar: 'مشروع ب', en: 'PP B' },
          description: { ar: 'وصف', en: 'desc' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: 'PUBLISHED',
        },
      })
    ).id;
    phaseB = (await raw.phase.create({ data: { companyId: companyBId, projectId: projectB, code: 'PP-PH', name: { ar: 'م', en: 'P' } } })).id;
    buildingB = (await raw.building.create({ data: { companyId: companyBId, phaseId: phaseB, code: 'PP-BL', name: 'B' } })).id;
    mediaB = (await raw.projectMedia.create({ data: { projectId: projectB, url: 'https://cdn.example/b.jpg' } })).id;
    draftId = (
      await raw.project.create({
        data: {
          companyId,
          code: `PP-DRAFT-${stamp}`,
          name: { ar: 'مسودة', en: 'Unannounced' },
          description: { ar: 'سر', en: 'secret' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: 'DRAFT',
        },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { id: { in: depositIds } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await raw.otpCode.deleteMany({ where: { phone: { in: [staffPhone, deletedPhone] } } });
    await raw.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await raw.project.deleteMany({ where: { id: draftId } });
    await raw.projectMedia.deleteMany({ where: { projectId: projectB } });
    await raw.building.deleteMany({ where: { companyId: companyBId } });
    await raw.phase.deleteMany({ where: { companyId: companyBId } });
    await raw.project.deleteMany({ where: { companyId: companyBId } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });
  });

  it('PP-1: a phone code never signs in a staff account', async () => {
    const staff = await testApp.rawPrisma.user.create({
      data: { companyId, phone: staffPhone, fullName: 'PP Staff', role: UserRole.ADMIN, active: true },
    });
    createdUserIds.push(staff.id);
    await giveCode(staffPhone, '246810');
    const res = await http().post('/v1/auth/tenant/otp/verify').send({ slug, phone: staffPhone, code: '246810' });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('PP-2: a removed customer gets "inactive", not a server error', async () => {
    const gone = await testApp.rawPrisma.user.create({
      data: { companyId, phone: deletedPhone, fullName: 'PP Gone', role: UserRole.CLIENT, active: true, deletedAt: new Date() },
    });
    createdUserIds.push(gone.id);
    await giveCode(deletedPhone, '135790');
    const res = await http().post('/v1/auth/tenant/otp/verify').send({ slug, phone: deletedPhone, code: '135790' });
    expect(res.status).toBe(403);
    expect(await testApp.rawPrisma.user.count({ where: { phone: deletedPhone } })).toBe(1);
  });

  it('PP-3: registration answers the same for an account and for a CRM record', async () => {
    const raw = testApp.rawPrisma;
    const registered = await raw.user.create({
      data: { companyId, phone: `+20114${stamp}`, fullName: 'PP Registered', role: UserRole.CLIENT, passwordHash: 'x', active: true },
    });
    const crmOnly = await raw.user.create({
      data: { companyId, phone: `+20115${stamp}`, fullName: 'PP Lead', role: UserRole.CLIENT, active: true },
    });
    createdUserIds.push(registered.id, crmOnly.id);
    const register = (phone: string, n: number) =>
      http()
        .post('/v1/auth/tenant/customer/register')
        .send({ slug, fullName: 'Someone', phone, email: `pp-${n}-${stamp}@example.com`, password: 'Passw0rd!x9', acceptTerms: true });
    const a = await register(registered.phone!, 1);
    const b = await register(crmOnly.phone!, 2);
    expect([a.status, b.status]).toEqual([409, 409]);
    expect([a.body.code, b.body.code]).toEqual(['account_exists_verify', 'account_exists_verify']);
  });

  it('PP-4: the public catalogue never lists a draft project, whatever the filter', async () => {
    const res = await http().get('/v1/public/projects').query({ status: 'DRAFT' }).set('X-Tenant-Slug', slug).expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(draftId);
  });

  it('PP-5: the public unit listing carries no sales figures', async () => {
    const res = await http().get('/v1/public/units').query({ status: 'SOLD', pageSize: 1 }).set('X-Tenant-Slug', slug).expect(200);
    expect(res.body.meta.facets).toBeUndefined();
  });

  it('PP-6: nothing can be hung under, or removed from, another company', async () => {
    await asAdmin(http().post('/v1/phases'))
      .send({ projectId: projectB, code: 'PP-X', name: { ar: 'س', en: 'X' } })
      .expect(404);
    await asAdmin(http().post('/v1/buildings')).send({ phaseId: phaseB, code: 'PP-X', name: 'X' }).expect(404);
    await asAdmin(http().post('/v1/units'))
      .send({ buildingId: buildingB, code: 'PP-X1', type: 'APARTMENT', area: 100, bedrooms: 2, bathrooms: 1, floor: 1, price: 1000000 })
      .expect(404);
    await asAdmin(http().post('/v1/media/projects')).send({ projectId: projectB, url: 'https://cdn.example/x.jpg' }).expect(404);
    await asAdmin(http().delete(`/v1/media/projects/${mediaB}`)).expect(404);
    expect(await testApp.rawPrisma.projectMedia.count({ where: { id: mediaB } })).toBe(1);
    expect(await testApp.rawPrisma.phase.count({ where: { projectId: projectB } })).toBe(1);
  });

  it('PP-7: a customer\'s payments come without staff names or internal ids', async () => {
    const dep = await testApp.rawPrisma.deposit.create({
      data: {
        companyId,
        contractId: fixtures.flowE.customer1ContractId,
        amount: 4321,
        paidAt: new Date(),
        recordedById: fixtures.userIds.adminId,
        reviewedById: fixtures.userIds.adminId,
        reviewStatus: DepositReviewStatus.APPROVED,
        verified: true,
      },
      select: { id: true },
    });
    depositIds.push(dep.id);
    const token = await testApp.signAccessToken(fixtures.userIds.customer1UserId, 'CUSTOMER');
    const res = await http().get('/v1/me/deposits').set('Authorization', bearer(token)).expect(200);
    const row = (res.body.data as Array<Record<string, unknown>>).find((d) => d.id === dep.id);
    expect(row).toBeDefined();
    for (const key of ['reviewedBy', 'reviewedById', 'recordedById', 'paymentInstrumentId']) {
      expect(row).not.toHaveProperty(key);
    }
    expect(JSON.stringify(res.body)).not.toContain('lastCorrection');
  });
});
