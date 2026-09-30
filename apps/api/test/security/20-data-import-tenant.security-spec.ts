/**
 * SEC-20 — Data Import tenancy security tests.
 *
 *   DI-1  Unauthenticated call returns 401
 *   DI-2  SALES_MANAGER returns 403 (ADMIN-only endpoint)
 *   DI-3  Cross-tenant code reference — Company A admin uploads a file that
 *         references Company B's project codes; every such row must fail
 *         (unknown parent code). No entity from B's domain may be written
 *         into A's namespace.
 *   DI-4  Preview endpoint honours the same auth rules as the import endpoint
 *   DI-5  A DATA_IMPORT audit log row is created on successful import
 *
 * Uses real HTTP through the NestJS app. File uploads use multipart/form-data.
 *
 * Run with: pnpm --filter @rep/api test -c test/jest-security.json
 */

import request from 'supertest';
import { Workbook } from 'exceljs';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';
import {
  PROJECTS_SHEET,
  PHASES_SHEET,
  BUILDINGS_SHEET,
  UNITS_SHEET,
  CUSTOMERS_SHEET,
} from '../../src/common/utils/import-headers';

// ── Fixture ───────────────────────────────────────────────────────────────────

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;
let smAToken: string;

beforeAll(async () => {
  testApp = await createSecurityTestApp();
  fx = await seedSecurityFixture(testApp.rawPrisma);
  adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
  smAToken    = await loginAs(testApp.app, fx.users.smA.email,    fx.users.smA.password);
}, 90_000);

afterAll(async () => {
  await teardownSecurityFixture(testApp.rawPrisma);
});

// ── Xlsx helpers ──────────────────────────────────────────────────────────────

/** Minimal valid Projects-only xlsx with one row. */
async function buildProjectsXlsx(projectCode: string): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet(PROJECTS_SHEET.name);
  ws.addRow(PROJECTS_SHEET.headers);
  // _Code, nameAr, nameEn, descAr, descEn, city, status, createdAt
  ws.getRow(2).getCell(1).value = projectCode;
  ws.getRow(2).getCell(1).numFmt = '@';
  ws.getRow(2).getCell(6).value = 'Cairo';  // city (required for new project)
  ws.getRow(2).getCell(7).value = 'DRAFT';
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Xlsx that references Company B's project code in the Phases sheet. */
async function buildCrossTenantPhasesXlsx(): Promise<Buffer> {
  const wb = new Workbook();

  // Phases sheet: reference a project that belongs to Company B
  const ws = wb.addWorksheet(PHASES_SHEET.name);
  ws.addRow(PHASES_SHEET.headers);
  // _ProjectCode, projNameAr, projNameEn, _PhaseCode, phaseNameAr, phaseNameEn, order, createdAt
  ws.getRow(2).getCell(1).value = 'SEC-A-P1';  // This is Company A's project code — fine
  ws.getRow(2).getCell(4).value = 'ATTACK-PH1';
  ws.getRow(2).getCell(4).numFmt = '@';

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Xlsx that tries to reference a non-existent (cross-tenant) project code. */
async function buildUnknownProjectCodeXlsx(): Promise<Buffer> {
  const wb = new Workbook();

  const ws = wb.addWorksheet(PHASES_SHEET.name);
  ws.addRow(PHASES_SHEET.headers);
  // Reference a project code that does not exist in Company A's namespace
  // (it is Company B's project code: from the security fixture the B company
  //  has no project seeded by default, so any code not in A is "unknown")
  ws.getRow(2).getCell(1).value = 'B-CROSS-TENANT-PROJ';
  ws.getRow(2).getCell(4).value = 'SHOULD-FAIL';
  ws.getRow(2).getCell(4).numFmt = '@';

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ── DI-1: Unauthenticated → 401 ──────────────────────────────────────────────

it('DI-1: unauthenticated import returns 401', async () => {
  const buf = await buildProjectsXlsx('NEW-PROJ');
  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/import')
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(401);
});

it('DI-1b: unauthenticated preview returns 401', async () => {
  const buf = await buildProjectsXlsx('NEW-PROJ');
  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/preview')
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(401);
});

// ── DI-2: SALES_MANAGER → 403 ────────────────────────────────────────────────

it('DI-2: SALES_MANAGER is rejected with 403', async () => {
  const buf = await buildProjectsXlsx('NEW-PROJ');
  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/import')
    .set('Authorization', bearer(smAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(403);
});

it('DI-2b: SALES_MANAGER preview is rejected with 403', async () => {
  const buf = await buildProjectsXlsx('NEW-PROJ');
  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/preview')
    .set('Authorization', bearer(smAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(403);
});

// ── DI-3: Cross-tenant isolation ──────────────────────────────────────────────

it('DI-3: phase referencing a project code not owned by Company A yields validation errors', async () => {
  const buf = await buildUnknownProjectCodeXlsx();

  const res = await request(testApp.app.getHttpServer())
    .post('/v1/data-import/preview')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(200);

  const body = res.body as { hasErrors: boolean; phases: { errorCount: number } };
  expect(body.hasErrors).toBe(true);
  expect(body.phases.errorCount).toBeGreaterThan(0);

  // Import endpoint must also refuse
  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/import')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect((res) => {
      // Returns 200 with success:false — the service returns the error plan rather than throwing
      expect((res.body as { success: boolean }).success).toBe(false);
    });
});

it('DI-3b: Company A admin cannot create entities by uploading a file with B-only parent codes — every row fails', async () => {
  // Company B project code 'SEC-A-P1' belongs to Company A in the fixture;
  // there is no project in Company B's namespace seeded by default.
  // Attack: Company B admin tries to use Company A's project code in their import.
  const adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);

  const wb = new Workbook();
  const ws = wb.addWorksheet(PHASES_SHEET.name);
  ws.addRow(PHASES_SHEET.headers);
  // 'SEC-A-P1' is Company A's code — it does NOT exist in Company B's namespace
  ws.getRow(2).getCell(1).value = 'SEC-A-P1';
  ws.getRow(2).getCell(4).value = 'ATTACK-PH-B';
  ws.getRow(2).getCell(4).numFmt = '@';

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

  const res = await request(testApp.app.getHttpServer())
    .post('/v1/data-import/preview')
    .set('Authorization', bearer(adminBToken))
    .set('X-Tenant-Slug', SEC_SLUG_B)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect(200);

  const body = res.body as { hasErrors: boolean; phases: { errorCount: number } };
  // Must fail: 'SEC-A-P1' is not in Company B's namespace
  expect(body.hasErrors).toBe(true);
  expect(body.phases.errorCount).toBeGreaterThan(0);
});

// ── DI-6: Cross-tenant phone collision ────────────────────────────────────────

it('DI-6: phone already registered to a Company B customer is blocked, crossTenantPhoneConflicts=1, no user created in Company A', async () => {
  const crossPhone = '01099887766';

  // Create a CLIENT user in Company B that holds this phone.
  // teardownSecurityFixture calls user.deleteMany({ where: { companyId: bId } }),
  // so the finally block below is belt-and-suspenders.
  const clientInB = await testApp.rawPrisma.user.create({
    data: {
      fullName: 'Cross-Tenant Client',
      phone: crossPhone,
      role: 'CLIENT',
      active: true,
      companyId: fx.companies.bId,
      locale: 'ar',
    },
  });

  try {
    // Build a Customers-only xlsx with that phone targeting Company A
    const wb = new Workbook();
    const ws = wb.addWorksheet(CUSTOMERS_SHEET.name);
    ws.addRow(CUSTOMERS_SHEET.headers);
    // headers order: fullName, phone, email, locale, createdAt
    ws.getRow(2).getCell(1).value = 'محاولة استيراد';
    ws.getRow(2).getCell(2).value = crossPhone;
    ws.getRow(2).getCell(2).numFmt = '@';

    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const res = await request(testApp.app.getHttpServer())
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminAToken))
      .set('X-Tenant-Slug', SEC_SLUG_A)
      .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect((r) => {
        // The Customers sheet has a blocking error → success must be false
        expect((r.body as { success: boolean }).success).toBe(false);
      });

    // Counter must be exactly 1 — only the cross-tenant collision row
    expect((res.body as { crossTenantPhoneConflicts: number }).crossTenantPhoneConflicts).toBe(1);

    // No CLIENT user with this phone must have been created in Company A
    const inA = await testApp.rawPrisma.user.findFirst({
      where: { phone: crossPhone, companyId: fx.companies.aId },
    });
    expect(inA).toBeNull();
  } finally {
    await testApp.rawPrisma.user.deleteMany({ where: { id: clientInB.id } });
  }
});

// ── DI-5: Audit log written on successful import ──────────────────────────────

it('DI-5: a DATA_IMPORT audit log row is created on successful import', async () => {
  // Create a valid new project for Company A so the import does real work
  const uniqueCode = `SEC20-AUDIT-${Date.now()}`;
  const wb = new Workbook();
  const ws = wb.addWorksheet(PROJECTS_SHEET.name);
  ws.addRow(PROJECTS_SHEET.headers);
  ws.getRow(2).getCell(1).value = uniqueCode;
  ws.getRow(2).getCell(1).numFmt = '@';
  ws.getRow(2).getCell(3).value = `Audit Test ${uniqueCode}`;  // nameEn
  ws.getRow(2).getCell(6).value = 'Cairo';  // city
  ws.getRow(2).getCell(7).value = 'DRAFT';

  const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const before = new Date();

  await request(testApp.app.getHttpServer())
    .post('/v1/data-import/import')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .attach('file', buf, { filename: 'import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    .expect((res) => {
      expect((res.body as { success: boolean }).success).toBe(true);
    });

  const log = await testApp.rawPrisma.auditLog.findFirst({
    where: {
      actorId:    fx.users.adminA.id,
      action:     'DATA_IMPORT',
      entityType: 'data-import',
      companyId:  fx.companies.aId,
      createdAt:  { gte: before },
    },
  });

  expect(log).not.toBeNull();
  expect(log?.entityId).toBe(fx.companies.aId);

  // Clean up
  await testApp.rawPrisma.project.deleteMany({
    where: { code: uniqueCode, companyId: fx.companies.aId },
  });
});
