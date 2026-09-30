/**
 * Column-absent vs cell-empty distinction.
 *
 * Half A — column absent:
 *   The Projects sheet has no "الوصف (AR)" or "الوصف (EN)" column at all.
 *   parseAndValidate must mark the project as 'unchanged' — neither field
 *   appears in the op's delta, so applyPlan must not touch description.
 *
 * Half B — column present, cells empty:
 *   The Projects sheet HAS the description columns but both cells are blank.
 *   parseAndValidate must mark the project as 'update' with descAr=null,
 *   descEn=null (the stored JSON sub-fields should be cleared).
 */

import { Workbook } from 'exceljs';
import { DataImportService } from '../data-import.service';
import { PROJECTS_SHEET } from '../../../common/utils/import-headers';

// ── Shared DB state ──────────────────────────────────────────────────────────

const COMPANY_ID = 'ffffffff-0000-0000-0000-000000000001';

const dbProject = {
  id: 'aaaaaaaa-0000-0000-0000-111111111111',
  code: 'NULL-COL-TEST',
  name: { ar: 'اختبار', en: 'Test' },
  description: { ar: 'وصف موجود', en: 'Existing description' },
  city: 'Alexandria',
  status: 'DRAFT' as const,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function buildImportPrisma() {
  const empty = jest.fn().mockResolvedValue([]);
  return {
    project:     { findMany: jest.fn().mockResolvedValue([dbProject]) },
    phase:       { findMany: empty },
    building:    { findMany: empty },
    unit:        { findMany: empty },
    contract:    { findMany: empty },
    reservation: { findMany: empty },
    // Phase 2 preloads — not under test here, return empty
    user:       { findMany: empty },
    lead:       { findMany: empty },
    leadSource: { findMany: empty },
  };
}

// ── Xlsx builders ─────────────────────────────────────────────────────────────

/** Build a Projects sheet xlsx with the given headers and one data row. */
async function buildXlsx(headers: string[], rowValues: (string | number | null)[]): Promise<Buffer> {
  const wb = new Workbook();
  const ws = wb.addWorksheet(PROJECTS_SHEET.name);
  ws.addRow(headers);
  ws.addRow(rowValues);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ── Half A: column absent ─────────────────────────────────────────────────────

describe('DataImportService — column-absent rule', () => {
  it('absent description columns: project is marked unchanged (description not in delta)', async () => {
    // Headers: only _Code, nameAr, nameEn, city, status — NO desc columns
    const headers = [
      PROJECTS_SHEET.fields.code,
      PROJECTS_SHEET.fields.nameAr,
      PROJECTS_SHEET.fields.nameEn,
      PROJECTS_SHEET.fields.city,
      PROJECTS_SHEET.fields.status,
    ];
    const rowValues = ['NULL-COL-TEST', 'اختبار', 'Test', 'Alexandria', 'DRAFT'];

    const buf = await buildXlsx(headers, rowValues);
    const prisma = buildImportPrisma();
    const service = new DataImportService(prisma as never);

    const plan = await service.parseAndValidate(buf, COMPANY_ID);

    expect(plan.hasErrors).toBe(false);
    expect(plan.projects.ops).toHaveLength(1);

    const op = plan.projects.ops[0]!;
    expect(op.op).toBe('unchanged');

    // descAr / descEn must be undefined (column absent — not in plan delta)
    expect(op.descAr).toBeUndefined();
    expect(op.descEn).toBeUndefined();
  });
});

// ── Half B: column present, cells empty ───────────────────────────────────────

describe('DataImportService — cell-empty rule', () => {
  it('present description columns with empty cells: project is marked update with null desc', async () => {
    // All description columns present — cells are empty strings (blank)
    const headers = [
      PROJECTS_SHEET.fields.code,
      PROJECTS_SHEET.fields.nameAr,
      PROJECTS_SHEET.fields.nameEn,
      PROJECTS_SHEET.fields.descAr,
      PROJECTS_SHEET.fields.descEn,
      PROJECTS_SHEET.fields.city,
      PROJECTS_SHEET.fields.status,
    ];
    // Empty strings for descAr and descEn → ExcelJS writes empty cells
    const rowValues = ['NULL-COL-TEST', 'اختبار', 'Test', '', '', 'Alexandria', 'DRAFT'];

    const buf = await buildXlsx(headers, rowValues);
    const prisma = buildImportPrisma();
    const service = new DataImportService(prisma as never);

    const plan = await service.parseAndValidate(buf, COMPANY_ID);

    expect(plan.hasErrors).toBe(false);
    expect(plan.projects.ops).toHaveLength(1);

    const op = plan.projects.ops[0]!;
    // DB has non-null description; file has empty cells → this IS a change
    expect(op.op).toBe('update');

    // descAr and descEn should be null (column present, cell empty)
    expect(op.descAr).toBeNull();
    expect(op.descEn).toBeNull();
  });

  it('present description columns with actual values: project is marked unchanged when values match DB', async () => {
    const headers = [
      PROJECTS_SHEET.fields.code,
      PROJECTS_SHEET.fields.descAr,
      PROJECTS_SHEET.fields.descEn,
    ];
    // Values matching the DB exactly
    const rowValues = ['NULL-COL-TEST', 'وصف موجود', 'Existing description'];

    const buf = await buildXlsx(headers, rowValues);
    const prisma = buildImportPrisma();
    const service = new DataImportService(prisma as never);

    const plan = await service.parseAndValidate(buf, COMPANY_ID);

    expect(plan.hasErrors).toBe(false);
    const op = plan.projects.ops[0]!;
    expect(op.op).toBe('unchanged');
    expect(op.descAr).toBe('وصف موجود');
    expect(op.descEn).toBe('Existing description');
  });
});
