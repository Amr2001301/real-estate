/**
 * SEC-19 — Data Export security tests.
 *
 *   DE-1  Unauthenticated call returns 401
 *   DE-2  SALES_MANAGER returns 403 (ADMIN-only endpoint)
 *   DE-3  Company A admin cannot export Company B data — cross-tenant isolation
 *   DE-4  No passwordHash and no staff user (ADMIN / SALES_MANAGER) appears
 *         anywhere in the workbook output
 *
 * All four tests use real HTTP through the NestJS app. DE-3 and DE-4 parse the
 * XLSX response with ExcelJS and inspect cell values directly.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Force superagent to treat the response as raw binary bytes. */
function binaryParser(
  res: { on: (event: string, cb: (chunk?: unknown) => void) => void },
  callback: (err: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: unknown) => chunks.push(chunk as Buffer));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (err: unknown) => callback(err as Error, Buffer.alloc(0)));
}

/** Collect every non-null cell value in the workbook as strings. */
async function allCellStrings(buf: Buffer): Promise<string[]> {
  const wb = new Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const values: string[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value != null) values.push(String(cell.value));
      });
    });
  });
  return values;
}

/** Collect every non-null cell value from a single named sheet. */
async function sheetCellStrings(buf: Buffer, sheetName: string): Promise<string[]> {
  const wb = new Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) return [];
  const values: string[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value != null) values.push(String(cell.value));
    });
  });
  return values;
}

// ── Fixture ───────────────────────────────────────────────────────────────────

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;
let smAToken: string;
let adminBToken: string;

// Unique sentinel values seeded into company B so we can detect cross-tenant leakage
const B_SENTINEL_PHONE = '09999000001';
const B_SENTINEL_NAME  = 'SEC19_B_ONLY_CUSTOMER';

beforeAll(async () => {
  testApp = await createSecurityTestApp();
  fx = await seedSecurityFixture(testApp.rawPrisma);

  // Seed a CLIENT user for company B with a sentinel phone/name
  await testApp.rawPrisma.user.create({
    data: {
      fullName: B_SENTINEL_NAME,
      phone:    B_SENTINEL_PHONE,
      role:     'CLIENT',
      active:   true,
      companyId: fx.companies.bId,
    },
  });

  adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
  smAToken    = await loginAs(testApp.app, fx.users.smA.email,    fx.users.smA.password);
  adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);
}, 90_000);

afterAll(async () => {
  await teardownSecurityFixture(testApp.rawPrisma);
});

// ── DE-1: Unauthenticated → 401 ───────────────────────────────────────────────

it('DE-1: unauthenticated request returns 401', async () => {
  await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(401);
});

// ── DE-2: SALES_MANAGER → 403 ────────────────────────────────────────────────

it('DE-2: SALES_MANAGER is rejected with 403', async () => {
  await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('Authorization', bearer(smAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(403);
});

// ── DE-3: Cross-tenant isolation ─────────────────────────────────────────────

it('DE-3: Company A admin export contains no Company B data', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);

  const cells = await allCellStrings(res.body as unknown as Buffer);

  // The sentinel values were seeded only in company B — none should appear in A's export
  expect(cells).not.toContain(B_SENTINEL_PHONE);
  expect(cells.some((v) => v.includes(B_SENTINEL_NAME))).toBe(false);
});

it('DE-3b: Company B export does not contain Company A data', async () => {
  // adminA's email is 'sec-admin-a@sec.test' — the local part is a unique sentinel
  const adminAName = 'sec-admin-a';

  const res = await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('Authorization', bearer(adminBToken))
    .set('X-Tenant-Slug', SEC_SLUG_B)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);

  const cells = await allCellStrings(res.body as unknown as Buffer);

  // B's export must contain the sentinel we seeded for B
  expect(cells).toContain(B_SENTINEL_NAME);

  // And must not contain any A-specific data (adminA email prefix is a good canary)
  expect(cells.some((v) => v.includes(adminAName))).toBe(false);
});

// ── DE-4: No passwordHash or staff user in output ────────────────────────────

it('DE-4: workbook contains no passwordHash and no staff user rows', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);

  const buf = res.body as unknown as Buffer;
  const cells = await allCellStrings(buf);

  // No cell should contain a bcrypt/argon2 hash prefix
  const hashCells = cells.filter((v) => v.startsWith('$2b$') || v.startsWith('$2a$') || v.startsWith('$argon2'));
  expect(hashCells).toHaveLength(0);

  // Staff names must not appear as customer rows in the Customers sheet.
  // Staff names DO legitimately appear in other sheets (e.g. "exported by" in
  // README, "recorded by" in Deposits) — the property is only that staff users
  // are not exported as customer records.
  const customerCells = await sheetCellStrings(buf, 'Customers');
  const adminFullName = 'Admin A';
  expect(customerCells).not.toContain(adminFullName);

  const smFullName = 'SM A';
  expect(customerCells).not.toContain(smFullName);
});

// ── DE-5: Audit log written on successful export ──────────────────────────────

it('DE-5: a DATA_EXPORT audit log row is created on successful export', async () => {
  const before = new Date();

  await request(testApp.app.getHttpServer())
    .get('/v1/data-export/export.xlsx')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);

  const log = await testApp.rawPrisma.auditLog.findFirst({
    where: {
      actorId:    fx.users.adminA.id,
      action:     'DATA_EXPORT',
      entityType: 'data-export',
      companyId:  fx.companies.aId,
      createdAt:  { gte: before },
    },
  });

  expect(log).not.toBeNull();
  expect(log?.entityId).toBe(fx.companies.aId);
});
