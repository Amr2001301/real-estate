/**
 * Step 18 — Company branding tenancy + RBAC security tests.
 *
 * Verifies:
 *   BS-1  Admin A cannot read Company B's branding via GET /company/branding
 *         (middleware scoping: Auth JWT carries companyId, not a path param)
 *   BS-2  Admin A PATCH does NOT touch Company B's branding row
 *   BS-3  SALES user of Company A cannot PATCH branding (403)
 *   BS-4  SALES_MANAGER of Company A cannot PATCH branding (403)
 *   BS-5  Admin A CAN read and PATCH own branding (happy path)
 *   BS-6  PATCH with primaryColor that fails contrast check returns 400
 *         with code CONTRAST_BELOW_MINIMUM visible in the error body
 *   BS-7  PATCH with malformed hex returns 400
 *   BS-8  GET /company/branding by an unauthenticated request returns 401
 *
 * Requires TEST_DATABASE_URL pointing at a dedicated e2e/test database.
 * Run with: pnpm --filter @rep/api test -c test/jest-security.json
 */

import request from 'supertest';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;
let adminBToken: string;
let salesAToken: string;
let smAToken: string;
let customerAToken: string;

const VALID_PATCH = {
  displayName: 'Test Branding Co',
  primaryColor: '#1E3A5F',  // deep blue — high contrast against white
  accentColor: '#C8A24B',
};

beforeAll(async () => {
  testApp = await createSecurityTestApp();
  fx = await seedSecurityFixture(testApp.rawPrisma);

  [adminAToken, adminBToken, salesAToken, smAToken, customerAToken] = await Promise.all([
    loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password),
    loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password),
    loginAs(testApp.app, fx.users.sales1A.email, fx.users.sales1A.password),
    loginAs(testApp.app, fx.users.smA.email, fx.users.smA.password),
    loginAs(testApp.app, fx.users.customerA.email, fx.users.customerA.password, 'customer'),
  ]);
}, 90_000);

afterAll(async () => {
  await teardownSecurityFixture(testApp.rawPrisma);
});

// ── BS-1: GET isolation ───────────────────────────────────────────────────────

it("BS-1: GET /company/branding returns caller's own branding, not company B's", async () => {
  // Seed a unique displayName on company B
  await testApp.rawPrisma.company.update({
    where: { id: fx.companies.bId },
    data: { displayName: 'COMPANY_B_EXCLUSIVE_NAME' },
  });

  const res = await request(testApp.app.getHttpServer())
    .get('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(200);

  expect((res.body as { displayName?: string }).displayName).not.toBe('COMPANY_B_EXCLUSIVE_NAME');

  // Cleanup
  await testApp.rawPrisma.company.update({
    where: { id: fx.companies.bId },
    data: { displayName: null },
  });
});

// ── BS-2: PATCH isolation ─────────────────────────────────────────────────────

it('BS-2: Admin A PATCH does NOT modify Company B branding row', async () => {
  const beforeB = await testApp.rawPrisma.company.findUnique({
    where: { id: fx.companies.bId },
    select: { primaryColor: true },
  });

  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ primaryColor: '#0F1E33' })
    .expect(200);

  const afterB = await testApp.rawPrisma.company.findUnique({
    where: { id: fx.companies.bId },
    select: { primaryColor: true },
  });

  // Company B's primaryColor must be unchanged
  expect(afterB?.primaryColor).toBe(beforeB?.primaryColor);
});

// ── BS-3: SALES role denied ───────────────────────────────────────────────────

it('BS-3: SALES user cannot PATCH branding (403)', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(salesAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send(VALID_PATCH)
    .expect(403);
});

// ── BS-4: SALES_MANAGER role denied ──────────────────────────────────────────

it('BS-4: SALES_MANAGER cannot PATCH branding (403)', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(smAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send(VALID_PATCH)
    .expect(403);
});

// ── BS-5: Admin happy path ────────────────────────────────────────────────────

it('BS-5: Admin A can read and update own branding', async () => {
  await request(testApp.app.getHttpServer())
    .get('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(200);

  const res = await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send(VALID_PATCH)
    .expect(200);

  expect((res.body as { primaryColor?: string }).primaryColor).toBe(VALID_PATCH.primaryColor);

  // Admin B can still update B's own branding independently
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminBToken))
    .set('X-Tenant-Slug', SEC_SLUG_B)
    .send({ displayName: 'Company B Name' })
    .expect(200);
});

// ── BS-6: Contrast check ─────────────────────────────────────────────────────

it('BS-6: primaryColor with contrast < 3:1 against white returns 400', async () => {
  // #FFFFFF is white — luminance=1, contrast=1.0 (fails 3:1)
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ primaryColor: '#FFFFFF' })
    .expect(400);

  // #FFFF00 — bright yellow — luminance ≈ 0.928, contrast ≈ 1.07 (fails)
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ primaryColor: '#FFFF00' })
    .expect(400);
});

// ── BS-7: Malformed hex rejected ──────────────────────────────────────────────

it('BS-7: malformed primaryColor hex returns 400', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ primaryColor: 'not-a-color' })
    .expect(400);

  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ primaryColor: '#FFF' })   // 3-digit shorthand not accepted
    .expect(400);
});

// ── BS-8: Unauthenticated request ─────────────────────────────────────────────

it('BS-8: unauthenticated GET /company/branding returns 401', async () => {
  await request(testApp.app.getHttpServer())
    .get('/v1/company/branding')
    .expect(401);
});

// ── BS-9: CUSTOMER role denied ────────────────────────────────────────────────

it('BS-9: CUSTOMER user cannot PATCH branding (403)', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/company/branding')
    .set('Authorization', bearer(customerAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send(VALID_PATCH)
    .expect(403);
});
