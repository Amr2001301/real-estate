/**
 * Empty-tenant export invariant.
 *
 * A company with no data must still produce a workbook with all 16 sheets
 * (README + 15 entity sheets) and a non-empty header row on each data sheet.
 * The workbook is the import template — sheet count and column layout must be
 * stable regardless of whether any rows exist.
 */

import { Workbook } from 'exceljs';
import { DataExportService } from '../data-export.service';

// ── Mock PrismaService ────────────────────────────────────────────────────────

function buildEmptyPrisma() {
  const emptyList = jest.fn().mockResolvedValue([]);

  return {
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Empty Corp', displayName: null }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Test Admin' }),
      findMany:   emptyList,
    },
    project:            { findMany: emptyList },
    phase:              { findMany: emptyList },
    building:           { findMany: emptyList },
    unit:               { findMany: emptyList },
    lead:               { findMany: emptyList },
    contract:           { findMany: emptyList },
    installmentPlan:    { findMany: emptyList },
    installment:        { findMany: emptyList },
    deposit:            { findMany: emptyList },
    paymentInstrument:  { findMany: emptyList },
    refund:             { findMany: emptyList },
    broker:             { findMany: emptyList },
    brokerCommission:   { findMany: emptyList },
    maintenanceRequest: { findMany: emptyList },
  };
}

// ── Expected shape ────────────────────────────────────────────────────────────

const DATA_SHEETS: Array<{ name: string; headerCount: number }> = [
  { name: 'Projects',           headerCount:  8 },
  { name: 'Phases',             headerCount:  8 },
  { name: 'Buildings',          headerCount: 11 },
  { name: 'Units',              headerCount: 17 },
  { name: 'Customers',          headerCount:  5 },
  { name: 'Leads',              headerCount: 13 },
  { name: 'Contracts',          headerCount: 19 },
  { name: 'InstallmentPlans',   headerCount:  7 },
  { name: 'Installments',       headerCount:  9 },
  { name: 'Deposits',           headerCount: 11 },
  { name: 'PaymentInstruments', headerCount: 14 },
  { name: 'Refunds',            headerCount: 11 },
  { name: 'Brokers',            headerCount:  9 },
  { name: 'Commissions',        headerCount: 17 },
  { name: 'Maintenance',        headerCount: 17 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataExportService — empty tenant', () => {
  let wb: Workbook;

  beforeAll(async () => {
    const mock    = buildEmptyPrisma();
    const service = new DataExportService(mock as never);
    const result  = await service.generate('test-company-id', 'test-actor-id');

    expect(result.totalRows).toBe(0);

    wb = new Workbook();
    await wb.xlsx.load(result.buffer as unknown as ArrayBuffer);
  });

  it('produces exactly 16 sheets (README + 15 data sheets)', () => {
    expect(wb.worksheets).toHaveLength(16);
  });

  it('README is the first sheet', () => {
    expect(wb.worksheets[0]!.name).toBe('README');
  });

  it.each(DATA_SHEETS)(
    '$name: sheet exists with correct header column count ($headerCount columns)',
    ({ name, headerCount }) => {
      const ws = wb.getWorksheet(name);
      expect(ws).toBeDefined();

      // Row 1 is always the header even with 0 data rows
      const headerRow = ws!.getRow(1);
      const values = (headerRow.values as (string | null | undefined)[]).filter(
        (v, i) => i > 0 && v != null && v !== '',
      );
      expect(values).toHaveLength(headerCount);
    },
  );

  it('all data sheets have exactly 1 row (header only, no data rows)', () => {
    for (const { name } of DATA_SHEETS) {
      const ws = wb.getWorksheet(name)!;
      // rowCount includes only rows that have been added — should be 1 (header)
      expect(ws.rowCount).toBe(1);
    }
  });

  it('each data sheet has RTL view with frozen first row', () => {
    for (const { name } of DATA_SHEETS) {
      const ws = wb.getWorksheet(name)!;
      const view = ws.views[0] as { rightToLeft?: boolean; state?: string; ySplit?: number };
      expect(view?.rightToLeft).toBe(true);
      expect(view?.state).toBe('frozen');
      expect(view?.ySplit).toBe(1);
    }
  });
});
