import { toCsv, type CsvCell } from './csv';
import { MAX_PAGE_SIZE } from './pagination';
import type { ReportBrand } from './report-brand';
import { addFooter, addTitledTable, createReportWorkbook, formatMoneyColumns, workbookToBuffer } from './xlsx';

/**
 * "Export this list" for admin list pages (units, clients, customers): the
 * same filters as the screen, every page of results, as a branded XLSX or a
 * raw CSV. Sits on the list service's own query so the export can never
 * disagree with what the page shows — and tenant scoping comes with it.
 */

/** Hard cap on exported rows (20 pages of the largest page size). */
export const LIST_EXPORT_MAX_ROWS = 10_000;

export interface ListColumn<T> {
  header: string;
  width: number;
  value: (row: T) => string | number | null | undefined;
  /** An amount in the company currency (number format with the symbol). */
  money?: boolean;
}

/** Every row of a paginated list, page by page, up to the cap. */
export async function collectPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ data: T[] }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; rows.length < LIST_EXPORT_MAX_ROWS; page++) {
    const { data } = await fetchPage(page, MAX_PAGE_SIZE);
    rows.push(...data);
    if (data.length < MAX_PAGE_SIZE) break;
  }
  return rows.slice(0, LIST_EXPORT_MAX_ROWS);
}

export async function listXlsx<T>(opts: {
  title: string;
  sheet: string;
  filters?: Array<[string, string]>;
  columns: ListColumn<T>[];
  rows: T[];
  brand?: ReportBrand;
}): Promise<Buffer> {
  const wb = createReportWorkbook();
  const ws = wb.addWorksheet(opts.sheet);
  addTitledTable(ws, {
    title: opts.title,
    filters: opts.filters,
    headers: opts.columns.map((c) => c.header),
    rows: opts.rows.map((r) => opts.columns.map((c) => c.value(r) ?? '')),
    widths: opts.columns.map((c) => c.width),
    currency: opts.brand?.currency,
    brand: opts.brand,
  });
  const money = opts.columns.flatMap((c, i) => (c.money ? [i + 1] : []));
  if (money.length && opts.brand) formatMoneyColumns(ws, money, opts.brand.currency);
  addFooter(ws, opts.brand);
  return workbookToBuffer(wb);
}

export function listCsv<T>(columns: ListColumn<T>[], rows: T[]): string {
  return toCsv(
    columns.map((c) => c.header),
    rows.map((r) => columns.map((c) => (c.value(r) ?? '') as CsvCell)),
  );
}

/** "2026-10-09" for a date column (locale-independent, sorts correctly). */
export function isoDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

/** The Arabic side of a translatable `{ ar, en }` value (or the plain string). */
export function arText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const t = v as { ar?: unknown; en?: unknown };
    return String(t.ar || t.en || '');
  }
  return String(v);
}
