/**
 * Static invariants for every SHEET constant in import-headers.ts.
 *
 * Two independent checks:
 *   (1) widths.length === headers.length — an array that is shorter than the
 *       headers list leaves trailing columns without a width (ExcelJS skips
 *       undefined entries, so the column_dimensions block is simply absent for
 *       those columns in the file).
 *   (2) every entry is a finite positive number — a sparse array (holes written
 *       as `,,`) has the right .length but typeof arr[i] === 'undefined', which
 *       ExcelJS also silently skips.  A length check alone cannot catch this.
 *
 * Both checks are also enforced at runtime in initSheet() so any new inline
 * sheet in DataExportService that violates either invariant throws immediately
 * on the first export call rather than silently producing a clipped column.
 */

import {
  BUILDINGS_SHEET,
  CUSTOMERS_SHEET,
  LEADS_SHEET,
  PHASES_SHEET,
  PROJECTS_SHEET,
  UNITS_SHEET,
} from '../import-headers';

const SHEETS = [
  PROJECTS_SHEET,
  PHASES_SHEET,
  BUILDINGS_SHEET,
  UNITS_SHEET,
  CUSTOMERS_SHEET,
  LEADS_SHEET,
] as const;

describe('import-headers — sheet invariants', () => {
  it.each([...SHEETS])('$name: widths.length === headers.length', (sheet) => {
    expect(sheet.widths).toHaveLength(sheet.headers.length);
  });

  it.each([...SHEETS])('$name: every width is a finite positive number', (sheet) => {
    (sheet.widths as readonly number[]).forEach((w, i) => {
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThan(0);
      // surface the column index in the failure message so the hole is easy to find
      if (!Number.isFinite(w) || w <= 0) {
        throw new Error(`widths[${i}] = ${w} in ${sheet.name} — expected a finite positive number`);
      }
    });
  });
});
