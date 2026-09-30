/**
 * E2E — Data Import (real Postgres)
 *
 * DI-E2E-1  Round-trip idempotency: export → import → assert 0 creates, 0 updates,
 *           and no row was written in any of the four tables.
 *           Covers all four entity types across a non-trivial fixture tree.
 *
 *           The "nothing was written" assertion uses two independent mechanisms:
 *
 *           (a) xmin — a Postgres system column holding the transaction ID of the
 *               last write that touched the row. Any UPDATE bumps xmin, even when
 *               every value written is identical to what was already stored. This
 *               catches a row misclassified as 'update' instead of 'unchanged',
 *               which would trigger a no-op UPDATE that the content comparison
 *               below would miss. xmin works uniformly across all four tables;
 *               it is the primary assertion.
 *
 *               Using field-value comparison alone (name, order, etc.) for Phase
 *               and Building would be BLIND to this bug class: comparing field
 *               values only proves the values are the same, not that the row
 *               was not written.
 *
 *           (b) updatedAt on Project and Unit — a second, independent check that
 *               agrees with xmin. If the two disagree (xmin changed but updatedAt
 *               didn't, or vice versa), that itself is a diagnostic signal.
 *               Phase and Building have no updatedAt in the schema (see FG-15),
 *               so xmin is the only mechanism for them.
 *
 * DI-E2E-2  Stale-forecast safety: the preview and import are separate HTTP
 *           requests. If a row is created between the preview request and the
 *           import request, the import's own parseAndValidate call re-discovers
 *           the row and the plan correctly says 'update', not 'create'. This
 *           verifies correct two-request sequencing.
 *
 *           NOTE: this is NOT the intra-request race window (applyPlan called
 *           with a plan that says 'create' for an already-existing row). That
 *           window is covered by UC-2 in data-import.upsert.spec.ts, which calls
 *           applyPlan directly with a stale 'create' plan.
 *
 * Uses createE2ETestApp() so it runs against the same real Postgres as all other
 * e2e specs. All data is isolated to a dedicated company slug and torn down in
 * afterAll.
 */

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { loginAs, bearer } from '../helpers/login';

// ── Constants ─────────────────────────────────────────────────────────────────

const SLUG = 'e2e-data-import-test';

// ── Binary parser (captures xlsx response bytes) ──────────────────────────────

function binaryParser(
  res: { on: (event: string, cb: (chunk?: unknown) => void) => void },
  callback: (err: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: unknown) => chunks.push(chunk as Buffer));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (err: unknown) => callback(err as Error, Buffer.alloc(0)));
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

type XminSnapshot = {
  projects:  string[];
  phases:    string[];
  buildings: string[];
  units:     string[];
  customers: string[];
  leads:     string[];
};

// Primary assertion: xmin catches any UPDATE, even a no-op UPDATE with identical values.
// Phase and Building have no updatedAt (FG-15), so this is the only write-detection
// mechanism for them.
//
// $queryRawUnsafe is used (rather than the tagged-template $queryRaw) because the
// "companyId" column is typed as uuid in Postgres and Prisma's tagged template passes
// string interpolations as `text`, producing "operator does not exist: uuid = text".
// $queryRawUnsafe with $1::uuid applies the cast explicitly. The value is still
// parameterized — there is no string interpolation into the query text.
async function snapshotXmin(raw: TestApp['rawPrisma'], companyId: string): Promise<XminSnapshot> {
  const [projects, phases, buildings, units, customers, leads] = await Promise.all([
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "Project"  WHERE "companyId" = $1::uuid ORDER BY id`, companyId),
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "Phase"    WHERE "companyId" = $1::uuid ORDER BY id`, companyId),
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "Building" WHERE "companyId" = $1::uuid ORDER BY id`, companyId),
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "Unit"     WHERE "companyId" = $1::uuid ORDER BY id`, companyId),
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "User"     WHERE "companyId" = $1::uuid AND role = 'CLIENT' ORDER BY id`, companyId),
    raw.$queryRawUnsafe<Array<{ id: string; xmin: string }>>(
      `SELECT id, xmin::text FROM "Lead"     WHERE "companyId" = $1::uuid ORDER BY id`, companyId),
  ]);
  return {
    projects:  projects.map((r) => `${r.id}:${r.xmin}`),
    phases:    phases.map((r) => `${r.id}:${r.xmin}`),
    buildings: buildings.map((r) => `${r.id}:${r.xmin}`),
    units:     units.map((r) => `${r.id}:${r.xmin}`),
    customers: customers.map((r) => `${r.id}:${r.xmin}`),
    leads:     leads.map((r) => `${r.id}:${r.xmin}`),
  };
}

type UpdatedAtSnapshot = { projects: string[]; units: string[]; customers: string[]; leads: string[] };

// Secondary assertion: updatedAt on Project, Unit, User (CLIENT), and Lead — an independent check.
// A discrepancy between this and xmin (one changes, the other doesn't) is itself diagnostic.
async function snapshotUpdatedAt(raw: TestApp['rawPrisma'], companyId: string): Promise<UpdatedAtSnapshot> {
  const [projects, units, customers, leads] = await Promise.all([
    raw.project.findMany({ where: { companyId }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    raw.unit.findMany({   where: { companyId }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    raw.user.findMany({   where: { companyId, role: 'CLIENT' }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    raw.lead.findMany({   where: { companyId }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
  ]);
  return {
    projects:  projects.map((r) => `${r.id}:${r.updatedAt.getTime()}`),
    units:     units.map((r) => `${r.id}:${r.updatedAt.getTime()}`),
    customers: customers.map((r) => `${r.id}:${r.updatedAt.getTime()}`),
    leads:     leads.map((r) => `${r.id}:${r.updatedAt.getTime()}`),
  };
}

// ── Shared state ──────────────────────────────────────────────────────────────

let testApp: TestApp;
let http: () => ReturnType<typeof request>;
let adminToken: string;
let companyId: string;

// IDs created in beforeAll — all torn down in afterAll
let project1Id: string;
let unit1Id: string;   // BLD-A / U1 — used for updatedAt spot-check
let leadAId: string;   // has sourceId — used in not-found manual test
let leadBId: string;   // has assignedSalesId — used in not-found manual test

beforeAll(async () => {
  testApp = await createE2ETestApp();
  http = () => request(testApp.app.getHttpServer());

  const raw = testApp.rawPrisma;

  // Pre-clean any leftover from a prior run
  const existing = await raw.company.findFirst({ where: { slug: SLUG } });
  if (existing) {
    await raw.lead.deleteMany({ where: { companyId: existing.id } });
    await raw.leadSource.deleteMany({ where: { companyId: existing.id } });
    await raw.unit.deleteMany({ where: { companyId: existing.id } });
    await raw.building.deleteMany({ where: { companyId: existing.id } });
    await raw.phase.deleteMany({ where: { companyId: existing.id } });
    await raw.project.deleteMany({ where: { companyId: existing.id } });
    await raw.user.deleteMany({ where: { companyId: existing.id } });
    await raw.company.delete({ where: { id: existing.id } });
  }

  const company = await raw.company.create({
    data: { name: 'E2E Import Test Co', slug: SLUG, isActive: true, country: 'EG' },
  });
  companyId = company.id;

  const hash = await (await import('argon2')).hash('ImportTest123!');
  const admin = await raw.user.create({
    data: {
      email: `admin-import-test@${SLUG}.test`,
      passwordHash: hash,
      fullName: 'Import Admin',
      role: 'ADMIN',
      active: true,
      companyId,
    },
  });

  // ── Fixture tree ─────────────────────────────────────────────────────────────
  // Two projects. One has two phases (phase-1 has two buildings, phase-2 one).
  // One building has three units. One project has Arabic-only name (en=null).
  // One phase has Arabic-only name. One project has null description.

  const project1 = await raw.project.create({
    data: {
      companyId,
      code: 'IMP-PROJ-1',
      name: { ar: 'مشروع الاستيراد', en: 'Import Project' },
      description: { ar: 'وصف', en: 'desc' },
      city: 'Cairo',
      lat: 30.0,
      lng: 31.0,
      status: 'PUBLISHED',
    },
  });
  project1Id = project1.id;

  // Arabic-only name, empty description
  await raw.project.create({
    data: {
      companyId,
      code: 'IMP-PROJ-2',
      name: { ar: 'مشروع عربي فقط', en: null },
      description: { ar: '', en: '' },
      city: 'Alexandria',
      lat: 31.2,
      lng: 29.9,
      status: 'DRAFT',
    },
  });

  // Phase 1-A (under project 1)
  const phase1A = await raw.phase.create({
    data: {
      companyId,
      projectId: project1.id,
      code: 'IMP-PH1',
      name: { ar: 'مرحلة 1', en: 'Phase 1' },
      order: 0,
    },
  });

  // Phase 1-B (under project 1) — Arabic-only name
  const phase1B = await raw.phase.create({
    data: {
      companyId,
      projectId: project1.id,
      code: 'IMP-PH2',
      name: { ar: 'المرحلة الثانية', en: null },
      order: 1,
    },
  });

  // Phase 2-A (under project 2)
  const project2 = await raw.project.findFirstOrThrow({ where: { code: 'IMP-PROJ-2', companyId } });
  const phase2A = await raw.phase.create({
    data: {
      companyId,
      projectId: project2.id,
      code: 'IMP-PH3',
      name: { ar: 'مرحلة أ', en: 'Phase A' },
      order: 0,
    },
  });

  // Building A (under phase 1-A) — has 3 units
  const bldA = await raw.building.create({
    data: {
      companyId,
      phaseId: phase1A.id,
      code: 'IMP-BLD-A',
      name: 'Tower A',
      totalFloors: 5,
      order: 0,
    },
  });

  // Building B (under phase 1-A) — 1 unit
  const bldB = await raw.building.create({
    data: {
      companyId,
      phaseId: phase1A.id,
      code: 'IMP-BLD-B',
      name: 'Tower B',
      totalFloors: 3,
      order: 1,
    },
  });

  // Building C (under phase 1-B) — 0 units seeded (tests only need ≥1 per path)
  await raw.building.create({
    data: {
      companyId,
      phaseId: phase1B.id,
      code: 'IMP-BLD-C',
      name: 'Villa Block',
      totalFloors: 2,
      order: 0,
    },
  });

  // Building D (under phase 2-A) — 1 unit
  const bldD = await raw.building.create({
    data: {
      companyId,
      phaseId: phase2A.id,
      code: 'IMP-BLD-D',
      name: 'Block 1',
      totalFloors: 4,
      order: 0,
    },
  });

  // Three units in Building A
  const unit1 = await raw.unit.create({
    data: {
      companyId,
      buildingId: bldA.id,
      code: 'IMP-U1',
      type: '2BR',
      floor: 2,
      area: 110.5,
      bedrooms: 2,
      bathrooms: 1,
      price: 1_200_000,
      status: 'AVAILABLE',
    },
  });
  unit1Id = unit1.id;

  await raw.unit.create({
    data: {
      companyId,
      buildingId: bldA.id,
      code: 'IMP-U2',
      type: '3BR',
      floor: 3,
      area: 145.0,
      bedrooms: 3,
      bathrooms: 2,
      price: 1_800_000,
      status: 'AVAILABLE',
    },
  });

  await raw.unit.create({
    data: {
      companyId,
      buildingId: bldA.id,
      code: 'IMP-U3',
      type: 'STUDIO',
      floor: 1,
      area: 55.0,
      bedrooms: 0,
      bathrooms: 1,
      price: 650_000,
      status: 'AVAILABLE',
    },
  });

  // One unit in Building B
  await raw.unit.create({
    data: {
      companyId,
      buildingId: bldB.id,
      code: 'IMP-U4',
      type: '1BR',
      floor: 1,
      area: 80.0,
      bedrooms: 1,
      bathrooms: 1,
      price: 900_000,
      status: 'AVAILABLE',
    },
  });

  // One unit in Building D (project 2)
  await raw.unit.create({
    data: {
      companyId,
      buildingId: bldD.id,
      code: 'IMP-U5',
      type: '4BR',
      floor: 4,
      area: 200.0,
      bedrooms: 4,
      bathrooms: 3,
      price: 3_500_000,
      status: 'AVAILABLE',
    },
  });

  // ── Phase 2 fixture: customer + lead ─────────────────────────────────────────
  // One CLIENT user so the round-trip covers the Customers sheet.
  // One SALES user so the Leads sheet assignedSales reference resolves correctly.

  const clientUser = await raw.user.create({
    data: {
      fullName: 'عميل اختبار',
      phone: '01001234567',
      role: 'CLIENT',
      active: true,
      companyId,
      locale: 'ar',
    },
  });

  const salesUser = await raw.user.create({
    data: {
      fullName: 'مندوب مبيعات',
      role: 'SALES',
      active: true,
      companyId,
    },
  });

  const leadSource = await raw.leadSource.create({
    data: {
      companyId,
      name: { ar: 'زيارة الموقع', en: 'Site Visit' },
      active: true,
    },
  });

  await raw.lead.create({
    data: {
      companyId,
      clientId: clientUser.id,
      fullName: 'عميل اختبار',
      phone: '01001234567',
      stage: 'NEW',
      sourceId: leadSource.id,
      assignedSalesId: salesUser.id,
      projectInterestId: project1Id,
      unitInterestId: unit1Id,
    },
  });

  // Null-phone CLIENT — must be excluded from the Customers export sheet.
  // If the filter `phone: { not: null }` is removed, this user appears in the
  // xlsx with an empty phone cell and the reimport fails with "Phone is required".
  await raw.user.create({
    data: { fullName: 'عميل بلا هاتف', phone: null, role: 'CLIENT', active: true, companyId, locale: 'ar' },
  });

  // ── Additional leads for DI-E2E-1 gap coverage ─────────────────────────────
  //
  // salesUser2 has the same fullName as salesUser.  After this the name
  // 'مندوب مبيعات' is ambiguous: any lookup returns two results.  That makes
  // the round-trip exercise the ambiguous-sales-rep branch (case c).
  await raw.user.create({
    data: { fullName: 'مندوب مبيعات', role: 'SALES', active: true, companyId },
  });

  // Lead A: sourceId set → used in the manual "source not found" test to verify
  // that a non-existent source name in the xlsx does not clear the DB value.
  const leadA = await raw.lead.create({
    data: { companyId, clientId: clientUser.id, fullName: 'عميل أ', phone: '01001111101', stage: 'NEW', sourceId: leadSource.id },
  });
  leadAId = leadA.id;

  // Lead B: assignedSalesId set → used in the manual "sales rep not found" test.
  const leadB = await raw.lead.create({
    data: { companyId, clientId: clientUser.id, fullName: 'عميل ب', phone: '01001111102', stage: 'NEW', assignedSalesId: salesUser.id },
  });
  leadBId = leadB.id;

  // Lead C: assignedSalesId set → round-trip exercises ambiguous branch
  // (salesUser + salesUser2 both have the same name → ambiguous lookup).
  await raw.lead.create({
    data: { companyId, clientId: clientUser.id, fullName: 'عميل ج', phone: '01001111103', stage: 'NEW', assignedSalesId: salesUser.id },
  });

  // Lead D: all optional refs null → control case (no reference lookups needed).
  await raw.lead.create({
    data: { companyId, clientId: clientUser.id, fullName: 'عميل د', phone: '01001111104', stage: 'NEW' },
  });

  adminToken = await loginAs(testApp.app as INestApplication, admin.email!, 'ImportTest123!');
}, 90_000);

afterAll(async () => {
  const raw = testApp.rawPrisma;
  await raw.auditLog.deleteMany({ where: { companyId } });
  await raw.otpCode.deleteMany({ where: { companyId } });
  await raw.lead.deleteMany({ where: { companyId } });
  await raw.leadSource.deleteMany({ where: { companyId } });
  await raw.unit.deleteMany({ where: { companyId } });
  await raw.building.deleteMany({ where: { companyId } });
  await raw.phase.deleteMany({ where: { companyId } });
  await raw.project.deleteMany({ where: { companyId } });
  await raw.user.deleteMany({ where: { companyId } });
  await raw.company.delete({ where: { id: companyId } });
});

// ── DI-E2E-1: Round-trip idempotency ─────────────────────────────────────────

describe('DI-E2E-1 — round-trip idempotency (real Postgres, full fixture)', () => {
  let xlsxBuffer: Buffer;
  let xminBefore: XminSnapshot;
  let updatedAtBefore: UpdatedAtSnapshot;

  it('captures xmin and updatedAt snapshots before import', async () => {
    xminBefore      = await snapshotXmin(testApp.rawPrisma, companyId);
    updatedAtBefore = await snapshotUpdatedAt(testApp.rawPrisma, companyId);

    // Verify fixture has the expected shape: 2 projects / 3 phases / 4 buildings / 5 units
    // 1 customer (the null-phone CLIENT is excluded by the export filter) / 5 leads
    // Leads: original (all refs resolvable) + A (sourceId) + B (assignedSalesId) + C (ambiguous) + D (all null)
    expect(xminBefore.projects).toHaveLength(2);
    expect(xminBefore.phases).toHaveLength(3);
    expect(xminBefore.buildings).toHaveLength(4);
    expect(xminBefore.units).toHaveLength(5);
    // 2 CLIENTs: one with phone (exported), one without (excluded by export filter phone:{not:null}).
    // The snapshot tracks both so any accidental write to either is detected.
    expect(xminBefore.customers).toHaveLength(2);
    expect(xminBefore.leads).toHaveLength(5);
  });

  it('export endpoint returns 200 with an xlsx buffer', async () => {
    const res = await http()
      .get('/v1/data-export/export.xlsx')
      .set('Authorization', bearer(adminToken))
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    xlsxBuffer = res.body as unknown as Buffer;
    expect(xlsxBuffer.length).toBeGreaterThan(0);
  });

  it('preview endpoint returns 200 and reports 0 creates, 0 updates, 0 locked across all sheets', async () => {
    const res = await http()
      .post('/v1/data-import/preview')
      .set('Authorization', bearer(adminToken))
      .attach('file', xlsxBuffer, {
        filename: 'export.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    const body = res.body as {
      hasErrors: boolean;
      projects:  { toCreate: number; toUpdate: number; locked: number };
      phases:    { toCreate: number; toUpdate: number; locked: number };
      buildings: { toCreate: number; toUpdate: number; locked: number };
      units:     { toCreate: number; toUpdate: number; locked: number };
      customers: { toCreate: number; toUpdate: number; locked: number };
      leads:     { toCreate: number; toUpdate: number; locked: number };
    };

    expect(body.hasErrors).toBe(false);

    for (const sheet of [body.projects, body.phases, body.buildings, body.units, body.customers, body.leads]) {
      expect(sheet.toCreate).toBe(0);
      expect(sheet.toUpdate).toBe(0);
      expect(sheet.locked).toBe(0);
    }
  });

  it('import endpoint returns 200 with success and 0 created / 0 updated / 0 locked', async () => {
    const res = await http()
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminToken))
      .attach('file', xlsxBuffer, {
        filename: 'export.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    const body = res.body as {
      success: boolean;
      totalCreated: number;
      totalUpdated: number;
      totalUnchanged: number;
      units: { locked: number };
    };

    expect(body.success).toBe(true);
    expect(body.totalCreated).toBe(0);
    expect(body.totalUpdated).toBe(0);
    expect(body.totalUnchanged).toBeGreaterThan(0);
    expect(body.units.locked).toBe(0);
  });

  it('(primary) xmin is unchanged on all four tables — no UPDATE ran on any row', async () => {
    const xminAfter = await snapshotXmin(testApp.rawPrisma, companyId);
    // Any UPDATE — even one that writes identical values — bumps xmin in Postgres.
    // This catches a row misclassified as 'update' instead of 'unchanged',
    // which field-value comparison cannot see.
    expect(xminAfter).toEqual(xminBefore);
  });

  it('(secondary) updatedAt on Project and Unit rows is also unchanged', async () => {
    const updatedAtAfter = await snapshotUpdatedAt(testApp.rawPrisma, companyId);
    // Independent of xmin: Prisma bumps updatedAt on any UPDATE.
    // Both mechanisms must agree — a discrepancy is itself a diagnostic signal.
    expect(updatedAtAfter).toEqual(updatedAtBefore);
  });

  // ── (not-found path) manual xlsx with wrong reference names ──────────────
  //
  // The round-trip above exercises the ambiguous-sales-rep branch (leads B, C,
  // and the original lead all see two users for 'مندوب مبيعات').  That branch is
  // sufficient to catch the null→undefined bug.  This block additionally covers
  // the *not-found* branch:
  //
  //   lead A row: source = 'مصدر غير موجود' (no LeadSource has this name)
  //   lead B row: sales rep = 'مندوب غير موجود' (no User has this name)
  //
  // With the fix (undefined): field left unchanged → op = 'unchanged' → 0 updates.
  // With the bug (null):
  //   lead A: sourceId = null ≠ leadSource.id → op = 'update' → xmin bumps → FAIL
  //   lead B: assignedSalesId = null ≠ salesUser.id → op = 'update' → xmin bumps → FAIL

  it('(not-found path) import xlsx with unresolvable refs → 0 updates, xmin unchanged on leads A and B', async () => {
    const { Workbook } = await import('exceljs');
    const { LEADS_SHEET: LS } = await import('../../src/common/utils/import-headers');

    // Snapshot xmin for leads A and B before the import
    const [rowA_before, rowB_before] = await Promise.all([
      testApp.rawPrisma.$queryRawUnsafe<Array<{ xmin: string }>>(
        `SELECT xmin::text FROM "Lead" WHERE id = $1::uuid`, leadAId),
      testApp.rawPrisma.$queryRawUnsafe<Array<{ xmin: string }>>(
        `SELECT xmin::text FROM "Lead" WHERE id = $1::uuid`, leadBId),
    ]);
    const xminA = rowA_before[0]?.xmin;
    const xminB = rowB_before[0]?.xmin;
    expect(xminA).toBeDefined();
    expect(xminB).toBeDefined();

    const wb = new Workbook();
    const ws = wb.addWorksheet(LS.name);
    ws.addRow([...LS.headers]);

    // Lead A: correct _ImportId, correct other fields, but source name not in DB
    const rA = ws.addRow([
      leadAId,             // _ImportId (col 1)
      null,                // _Ref      (col 2, read-only)
      'عميل أ',            // fullName  (col 3)
      '01001111101',       // phone     (col 4)
      null,                // email     (col 5)
      'NEW',               // stage     (col 6)
      'مصدر غير موجود',   // source    (col 7) — triggers not-found
      null,                // sales rep (col 8)
      null,                // proj AR   (col 9)
      null,                // proj EN   (col 10)
      null,                // unit code (col 11)
      null,                // createdAt (col 12, read-only)
      null,                // updatedAt (col 13, read-only)
    ]);
    rA.getCell(1).numFmt = '@'; // keep UUID as text
    rA.getCell(4).numFmt = '@'; // keep phone as text

    // Lead B: correct _ImportId, correct other fields, but sales rep name not in DB
    const rB = ws.addRow([
      leadBId,
      null,
      'عميل ب',
      '01001111102',
      null,
      'NEW',
      null,                // source (empty)
      'مندوب غير موجود',  // sales rep — triggers not-found
      null, null, null, null, null,
    ]);
    rB.getCell(1).numFmt = '@';
    rB.getCell(4).numFmt = '@';

    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const res = await http()
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminToken))
      .attach('file', buf, {
        filename: 'not-found-test.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    expect((res.body as { success: boolean }).success).toBe(true);
    expect((res.body as { totalUpdated: number }).totalUpdated).toBe(0);

    // Primary assertion: xmin must not have changed on either lead
    const [rowA_after, rowB_after] = await Promise.all([
      testApp.rawPrisma.$queryRawUnsafe<Array<{ xmin: string }>>(
        `SELECT xmin::text FROM "Lead" WHERE id = $1::uuid`, leadAId),
      testApp.rawPrisma.$queryRawUnsafe<Array<{ xmin: string }>>(
        `SELECT xmin::text FROM "Lead" WHERE id = $1::uuid`, leadBId),
    ]);
    expect(rowA_after[0]?.xmin).toBe(xminA);
    expect(rowB_after[0]?.xmin).toBe(xminB);
  });
});

// ── DI-E2E-2: Stale-forecast safety ──────────────────────────────────────────
//
// Scenario: admin calls preview (forecast says 'create'), then a row appears in
// the DB before the admin calls import. The import is a fresh HTTP request, so
// parseAndValidate runs again and finds the row — the plan correctly says 'update',
// not 'create'. No P2002, no abort.
//
// This tests that two sequential requests each re-parse correctly.
// It does NOT test the intra-request window (applyPlan given a stale 'create'
// plan for an already-existing row) — see UC-2 in data-import.upsert.spec.ts.

describe('DI-E2E-2 — stale-forecast: row inserted between preview and import requests', () => {
  const STALE_PROJECT_CODE = `STALE-${Date.now()}`;

  afterAll(async () => {
    await testApp.rawPrisma.project.deleteMany({
      where: { code: STALE_PROJECT_CODE, companyId },
    });
  });

  it('import request succeeds even when a new row appears after preview was run', async () => {
    // Build an xlsx with a project code that does not yet exist
    const { Workbook } = await import('exceljs');
    const { PROJECTS_SHEET: PS } = await import('../../src/common/utils/import-headers');

    const wb = new Workbook();
    const ws = wb.addWorksheet(PS.name);
    ws.addRow(PS.headers);
    const r2 = ws.getRow(2);
    r2.getCell(1).value = STALE_PROJECT_CODE;
    r2.getCell(1).numFmt = '@';
    r2.getCell(3).value = 'Stale Project';  // nameEn (col 3)
    r2.getCell(6).value = 'Cairo';          // city (col 6)
    r2.getCell(7).value = 'DRAFT';          // status (col 7)
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    // Preview: plan says toCreate=1 for this project
    const previewRes = await http()
      .post('/v1/data-import/preview')
      .set('Authorization', bearer(adminToken))
      .attach('file', buf, { filename: 'stale.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(200);

    expect((previewRes.body as any).projects.toCreate).toBe(1);

    // The row is now inserted directly in the DB (simulating any concurrent write)
    await testApp.rawPrisma.project.create({
      data: {
        companyId,
        code: STALE_PROJECT_CODE,
        name: { ar: '', en: 'Pre-inserted' },
        description: { ar: '', en: '' },
        city: 'Cairo',
        lat: 0,
        lng: 0,
        status: 'DRAFT',
      },
    });

    // Import re-runs parseAndValidate — finds the row → plan says 'update', not 'create'.
    // applyPlan upserts correctly (update branch). No P2002.
    const importRes = await http()
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminToken))
      .attach('file', buf, { filename: 'stale.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(200);

    expect((importRes.body as any).success).toBe(true);
  });
});

// ── DI-E2E-3: E.164 phone format — silent-merge guard on real Postgres ────────
//
// This test proves the fix for the E.164 / 01... phone format mismatch
// (storedToImportPhone + expanded IN clause) against real Postgres.
//
// The unit-test PG-1 proves the logic on a mock. A mock cannot prove that
// the database query returns the row. This test does:
//
//   1. Seed a CLIENT with phone '+201062800394' (E.164, as written by auth service).
//   2. Import a Customers sheet whose phone cell reads '1062800394' (10-digit,
//      repairable to '01062800394').
//   3. Assert: blocking row error (repair-escalation guard fired), no user
//      created, no user updated.
//
// Without the fix (before storedToImportPhone + expanded IN clause), step 3
// would pass no error and create a second user with phone '01062800394',
// silently giving one mobile number two accounts.

describe('DI-E2E-3 — E.164 stored phone: silent-merge guard on real Postgres', () => {
  const E164_PHONE = '+201062800394';
  let e164UserId: string;

  beforeAll(async () => {
    // Seed a CLIENT with an E.164 phone (as written by the auth service / OTP flow).
    const user = await testApp.rawPrisma.user.create({
      data: {
        fullName: 'E.164 Test User',
        phone: E164_PHONE,
        role: 'CLIENT',
        active: true,
        companyId,
        locale: 'ar',
      },
    });
    e164UserId = user.id;
  });

  afterAll(async () => {
    await testApp.rawPrisma.user.deleteMany({ where: { id: e164UserId } });
  });

  it('repairable cell "1062800394" against E.164-stored user → blocking error, no user created or updated', async () => {
    const { Workbook } = await import('exceljs');
    const { CUSTOMERS_SHEET: CS, PROJECTS_SHEET: PS } = await import('../../src/common/utils/import-headers');

    const wb = new Workbook();
    // Minimal Projects sheet so the file parses without a missing-sheet error
    const pws = wb.addWorksheet(PS.name);
    pws.addRow(PS.headers);

    // Customers sheet: one row with the repairable 10-digit form
    const cws = wb.addWorksheet(CS.name);
    cws.addRow([CS.fields.fullName, CS.fields.phone]);
    cws.getRow(2).getCell(1).value = 'E.164 Test User';
    cws.getRow(2).getCell(2).value = '1062800394'; // TEXT cell, 10-digit, repaired → 01062800394

    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    // Snapshot user count before import
    const usersBefore = await testApp.rawPrisma.user.count({ where: { companyId, role: 'CLIENT' } });

    const res = await http()
      .post('/v1/data-import/preview')
      .set('Authorization', bearer(adminToken))
      .attach('file', buf, {
        filename: 'e164.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    const body = res.body as {
      hasErrors: boolean;
      customers: { toCreate: number; toUpdate: number; errorCount: number; errors: Array<{ message: string }> };
    };

    // The repair-escalation guard must fire: normalised '01062800394' matches
    // the E.164-stored user once the IN query includes '+201...' forms.
    expect(body.hasErrors).toBe(true);
    expect(body.customers.errorCount).toBeGreaterThan(0);

    const errorMsg = body.customers.errors[0]?.message ?? '';
    expect(errorMsg).toMatch(/normalised/i);

    // No create or update was planned (the row was rejected)
    expect(body.customers.toCreate).toBe(0);
    expect(body.customers.toUpdate).toBe(0);

    // User count must not have changed (preview never writes; and the row was rejected)
    const usersAfter = await testApp.rawPrisma.user.count({ where: { companyId, role: 'CLIENT' } });
    expect(usersAfter).toBe(usersBefore);
  });
});

// ── DI-E2E-4: Write-side E.164 + OTP login round-trip ────────────────────────
//
// This test proves the write-path fix: applyPlan must store phone in E.164
// format (canonicalPhone) so that the OTP login flow — which normalises the
// incoming phone to E.164 before the DB lookup — finds the imported user
// rather than creating a second empty account.
//
// Flow:
//   1. Import a Customers sheet row with phone '01099887766' (local EG format).
//   2. Assert user count increased by exactly 1 and stored phone is '+201099887766'.
//   3. Seed an OtpCode for '+201099887766' (bypass SMS, SHA-256 hash of '123456').
//   4. POST /v1/auth/tenant/otp/verify with { slug, phone: '01099887766', code: '123456' }.
//   5. Assert 200, user count still N+1 (no second account created),
//      and JWT sub equals the imported user's ID.
//
// Without the write-side fix, step 2 would store '01099887766', step 4 would
// fail the findFirst (E.164 ≠ local) and create a second ghost account.

describe('DI-E2E-4 — write-side E.164 + OTP login round-trip', () => {
  const OTP_PHONE_LOCAL = '01099887766';
  const OTP_PHONE_E164  = '+201099887766';
  const OTP_CODE        = '123456';
  let importedUserId: string;

  afterAll(async () => {
    // User + OtpCode both cleaned up by the outer afterAll.
    // This inner afterAll only exists as a safety net for beforeAll failures.
    await testApp.rawPrisma.otpCode.deleteMany({ where: { phone: OTP_PHONE_E164, companyId } });
    await testApp.rawPrisma.user.deleteMany({ where: { phone: OTP_PHONE_E164, companyId } });
  });

  it('import stores phone as E.164 and OTP verify resolves to the imported user', async () => {
    const { Workbook } = await import('exceljs');
    const { CUSTOMERS_SHEET: CS, PROJECTS_SHEET: PS } = await import('../../src/common/utils/import-headers');
    const { createHash } = await import('crypto');

    const wb = new Workbook();
    // Minimal Projects sheet (required by parser)
    const pws = wb.addWorksheet(PS.name);
    pws.addRow(PS.headers);

    // Customers sheet: one new customer
    const cws = wb.addWorksheet(CS.name);
    cws.addRow([CS.fields.fullName, CS.fields.phone]);
    const row = cws.getRow(2);
    row.getCell(1).value = 'OTP Test Customer';
    row.getCell(2).value = OTP_PHONE_LOCAL; // text cell, local EG format

    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    // ── Snapshot before import ──────────────────────────────────────────────
    const countBefore = await testApp.rawPrisma.user.count({ where: { companyId, role: 'CLIENT' } });

    // ── Run import (write path) ─────────────────────────────────────────────
    const importRes = await http()
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminToken))
      .attach('file', buf, {
        filename: 'otp-import.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(200);

    expect((importRes.body as any).success).toBe(true);
    expect((importRes.body as any).totalCreated).toBe(1);

    // ── Verify E.164 was stored ─────────────────────────────────────────────
    const countAfter = await testApp.rawPrisma.user.count({ where: { companyId, role: 'CLIENT' } });
    expect(countAfter).toBe(countBefore + 1);

    const importedUser = await testApp.rawPrisma.user.findFirst({
      where: { phone: OTP_PHONE_E164, companyId },
      select: { id: true, phone: true },
    });
    expect(importedUser).not.toBeNull();
    expect(importedUser!.phone).toBe(OTP_PHONE_E164);
    importedUserId = importedUser!.id;

    // ── Seed OtpCode (bypass SMS) ───────────────────────────────────────────
    const codeHash = createHash('sha256').update(OTP_CODE).digest('hex');
    await testApp.rawPrisma.otpCode.create({
      data: {
        phone: OTP_PHONE_E164,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
        companyId,
      },
    });

    // ── Flush capability cache so verifyOtpV2 gate reads fresh DB state ─────
    await testApp.flushCapabilities(companyId);

    // ── Call verifyOtpV2 ────────────────────────────────────────────────────
    const verifyRes = await http()
      .post('/v1/auth/tenant/otp/verify')
      .send({ slug: SLUG, phone: OTP_PHONE_LOCAL, code: OTP_CODE })
      .expect(201);

    // Tokens issued means the OTP was accepted; response shape is { tokens: { accessToken }, user: { id } }
    expect(verifyRes.body).toHaveProperty('tokens.accessToken');
    expect(verifyRes.body.user.id).toBe(importedUserId);

    // Decode the JWT sub to confirm it resolves to the imported user
    const { decode } = await import('jsonwebtoken');
    const payload = decode(verifyRes.body.tokens.accessToken) as { sub?: string } | null;
    expect(payload?.sub).toBe(importedUserId);

    // No second account was created
    const countFinal = await testApp.rawPrisma.user.count({ where: { companyId, role: 'CLIENT' } });
    expect(countFinal).toBe(countBefore + 1);
  });
});

// ── DI-E2E-5: Corrupt / non-XLSX upload → 400, not 500 ───────────────────────
//
// Before the fix, wb.xlsx.load() threw an unhandled exception when fed a buffer
// that is not a valid ZIP/XLSX. The API returned 500. The fix wraps the call in
// try/catch and throws BadRequestException → 400 with an Arabic message.
//
// This test was missing from the original suite; the manual test step (Part 0,
// step 6: "upload .csv renamed .xlsx") found the regression. Adding it here so
// any future removal of the try/catch would be caught immediately.

describe('DI-E2E-5 — corrupt file → 400 Bad Request (not 500)', () => {
  it('preview: uploading a .csv renamed .xlsx returns 400 with Arabic error', async () => {
    const csvBytes = Buffer.from('col1,col2\nval1,val2\n');

    const res = await http()
      .post('/v1/data-import/preview')
      .set('Authorization', bearer(adminToken))
      .attach('file', csvBytes, {
        filename: 'not-really.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);

    const body = res.body as { message?: string };
    expect(body.message).toMatch(/xlsx/i);
  });

  it('import: uploading a corrupt buffer returns 400 with Arabic error', async () => {
    const garbage = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]);

    const res = await http()
      .post('/v1/data-import/import')
      .set('Authorization', bearer(adminToken))
      .attach('file', garbage, {
        filename: 'garbage.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);

    const body = res.body as { message?: string };
    expect(body.message).toMatch(/xlsx/i);
  });
});
