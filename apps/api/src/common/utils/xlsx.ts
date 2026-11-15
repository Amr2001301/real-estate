/**
 * Shared styled-XLSX foundation (P15.2). One professional Arabic/RTL theme used
 * by every workbook export across the platform — table lists and board reports
 * alike — so the look stays consistent and the styling logic lives in one place.
 *
 * Pure `exceljs`; no chart/canvas dependency here (charts live in xlsx-chart.ts
 * so simple table exports never pull in the canvas binary). The CSV utility in
 * ./csv.ts is the untouched raw-data fallback.
 */
import { Workbook, type Cell, type Row, type Worksheet } from 'exceljs';
import { arabicCurrencySymbol, normalizeCurrency } from '../currency/currency';
import { argb, fitInto, imageSize, type ReportBrand } from './report-brand';
import { reportIssuer } from '../report-pdf/report-issuer';

// ── Brand + palette (ARGB) ───────────────────────────────────────────────────
export const XLSX_BRAND = 'Devora';
export const XLSX_NAVY = 'FF0F1A33'; // header fill / titles
export const XLSX_GOLD = 'FFB8892F'; // accent
export const XLSX_GOLD_TINT = 'FFF6EEDC'; // totals row fill
export const XLSX_MUTED = 'FF64748B'; // secondary text
export const XLSX_ZEBRA = 'FFFBF8F2'; // alternating row fill (cream)
export const XLSX_CARD_BG = 'FFFBF8F2'; // KPI card fill (cream)
export const XLSX_CARD_BORDER = 'FFE8E1D2'; // KPI card edge
export const XLSX_ALERT_BG = 'FFFBF3DE'; // alert/risk card fill (gold tint)

export const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

/** Hairline bottom-only border for data rows (replaces THIN_BORDER in data sheets). */
export const HAIRLINE_BORDER = {
  bottom: { style: 'thin' as const, color: { argb: 'FFE4E7EC' } },
};

// ── Tab colour palette (ARGB) ─────────────────────────────────────────────────
export const XLSX_TAB_README    = 'FFC8A24B'; // README cover       → gold
export const XLSX_TAB_CATALOG   = 'FF1E3348'; // Projects/Phases/Buildings/Units → navy
export const XLSX_TAB_PEOPLE    = 'FF17696B'; // Customers/Leads    → teal
export const XLSX_TAB_FINANCIAL = 'FF1F6F43'; // Contracts/InstallmentPlans/Installments → green
export const XLSX_TAB_PAYMENTS  = 'FF8A2E3B'; // Deposits/PaymentInstruments/Refunds → burgundy
export const XLSX_TAB_BROKERS   = 'FF5B3E8E'; // Brokers/Commissions → purple
export const XLSX_TAB_OPS       = 'FF4A5568'; // Maintenance        → slate

export const XLSX_META_FILL  = 'FFF2F4F7'; // metadata label cell background
export const XLSX_GOLD_COVER = 'FFC8A24B'; // README cover gold (same as TAB_README)

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The wall-clock fields of `d` in `timeZone` (the server's own zone without
 * one). Reports state times in the company's zone, not the server's (UTC in
 * production).
 */
function wallClock(d: Date, timeZone?: string) {
  if (!timeZone) {
    return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(d);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: n('year'), mo: n('month'), d: n('day'), h: n('hour'), mi: n('minute'), s: n('second') };
}

/** "2026-10-09 12:35" — a timestamp as the company reads it. */
export function formatStamp(d: Date, timeZone?: string): string {
  const w = wallClock(d, timeZone);
  return `${w.y}-${pad2(w.mo)}-${pad2(w.d)} ${pad2(w.h)}:${pad2(w.mi)}`;
}

/**
 * A Date to write into an XLSX cell so Excel shows the company's local time:
 * Excel has no time zones and ExcelJS writes a Date's UTC fields, so shift the
 * wall clock into them.
 */
export function excelLocalDate(d: Date, timeZone?: string): Date {
  const w = wallClock(d, timeZone);
  return new Date(Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s));
}

/** A new workbook stamped with the brand as creator. */
/** "العملة: ج.م (EGP)" — stated once in every workbook header. */
export function currencyNote(currency: string): string {
  const code = normalizeCurrency(currency);
  return `العملة: ${arabicCurrencySymbol(code)} (${code})`;
}

/**
 * Number format for money cells: the company currency's symbol after the
 * number, so the value stays a real number (sums, sorting) but reads as money.
 */
export function amountFormat(currency?: string, decimals: '0.00' | '0.##' = '0.00'): string {
  const base = `#,##${decimals}`;
  return currency ? `${base} "${arabicCurrencySymbol(currency)}"` : base;
}

export function createReportWorkbook(): Workbook {
  const wb = new Workbook();
  wb.creator = XLSX_BRAND;
  wb.created = new Date();
  return wb;
}

/** Navy fill + white bold — the shared table-header look. */
export function styleHeaderCell(cell: Cell): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_NAVY } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = { bottom: { style: 'medium', color: { argb: XLSX_GOLD } } };
}

/** Bold cream totals row under a gold rule. */
export function styleTotalsRow(row: Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: XLSX_NAVY } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_GOLD_TINT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'medium', color: { argb: XLSX_GOLD } } };
  });
}

/**
 * Merged navy title row (row 1) + a muted "generated on" stamp (row 2), spanning
 * `spanCols` columns. The caller owns column widths / frozen views.
 */
export function addReportTitle(
  ws: Worksheet,
  title: string,
  spanCols = 2,
  currency?: string,
  company?: string,
  timeZone?: string,
): void {
  ws.mergeCells(1, 1, 1, spanCols);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: XLSX_NAVY } };
  t.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, spanCols);
  const g = ws.getCell(2, 1);
  g.value = [company, `تاريخ التوليد: ${formatStamp(new Date(), timeZone)}`, currency && currencyNote(currency)]
    .filter(Boolean)
    .join(' · ');
  g.font = { italic: true, size: 10, color: { argb: XLSX_MUTED } };
  g.alignment = { horizontal: 'right' };
}

/** Standard footer line: "صادر عن <company>" (the platform name without one). */
export function addFooter(ws: Worksheet, brand?: Pick<ReportBrand, 'name'>): void {
  ws.addRow([]);
  const issuer = reportIssuer();
  const from = brand?.name ? `صادر عن ${brand.name}` : `Generated by ${XLSX_BRAND}`;
  const footer = ws.addRow([issuer ? `${from} · أصدره: ${issuer}` : from]);
  footer.getCell(1).font = { italic: true, size: 9, color: { argb: XLSX_MUTED } };
}

/**
 * Append a styled header row + data rows (borders + zebra striping) at the
 * worksheet's CURRENT position — no view/column reset, so it composes under a
 * title/filters block. Emits a merged "لا توجد بيانات" row when there is no data.
 */
export function appendTable(
  ws: Worksheet,
  headers: string[],
  rows: Array<Array<string | number | Date>>,
  emptyText = 'لا توجد بيانات',
): void {
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell(styleHeaderCell);

  if (rows.length === 0) {
    const empty = ws.addRow([emptyText]);
    ws.mergeCells(empty.number, 1, empty.number, Math.max(1, headers.length));
    const c = empty.getCell(1);
    c.font = { italic: true, color: { argb: XLSX_MUTED } };
    c.alignment = { horizontal: 'center' };
    c.border = THIN_BORDER;
    return;
  }

  rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    row.height = 20;
    row.eachCell((cell, col) => {
      cell.border = { bottom: { style: 'thin', color: { argb: XLSX_CARD_BORDER } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      // The first column names the row: bold, like the HR exports.
      if (col === 1) cell.font = { bold: true, color: { argb: XLSX_NAVY } };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_ZEBRA } };
      }
    });
  });
}

/**
 * A clean RTL table that IS the sheet content: sets the RTL view, freezes the
 * header at row 1, applies column widths, then renders the table. Mutates the
 * sheet.
 */
export function addTable(
  ws: Worksheet,
  headers: string[],
  rows: Array<Array<string | number | Date>>,
  widths: number[],
): void {
  ws.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  ws.columns = headers.map((_, i) => ({ width: widths[i] ?? 18 }));
  appendTable(ws, headers, rows);
}

// ── Document look (as the Devora HR exports) ─────────────────────────────────
// Company line, big title, a gold rule, fact cards (period / issued / count),
// then a navy header row with a gold underline, cream zebra rows, a bold first
// column and a cream totals row.
export const DOC_INK = 'FF0F1A33';
export const DOC_TEXT = 'FF1F2937';
export const DOC_SUB = 'FF4A5263';
export const DOC_LABEL = 'FF6B7280';
export const DOC_GOLD = 'FFB8892F';
export const DOC_CREAM = 'FFFBF8F2';
export const DOC_TOTAL = 'FFF6EEDC';
export const DOC_RULE = 'FFE8E1D2';
const FONT = 'Arial';

/**
 * Split `span` columns into one run per fact ([from, to], 1-based), each run
 * as wide as its text needs (by the sheet's column widths), so a long value —
 * a date and time — is never cut.
 */
function factRuns(ws: Worksheet, span: number, texts: string[]): Array<[number, number]> {
  const n = texts.length;
  if (n === 0) return [];
  const widths = Array.from({ length: span }, (_, i) => ws.getColumn(i + 1).width ?? 12);
  const total = widths.reduce((a, w) => a + w, 0);
  const need = texts.map((t) => Math.max(8, t.length * 1.15));
  const sumNeed = need.reduce((a, w) => a + w, 0);
  const out: Array<[number, number]> = [];
  let col = 1;
  for (let i = 0; i < n; i++) {
    const left = n - i - 1; // runs still to place after this one
    const target = (need[i]! / sumNeed) * total;
    let to = col;
    let acc = widths[col - 1]!;
    while (to < span - left && acc < target) {
      to++;
      acc += widths[to - 1]!;
    }
    if (i === n - 1) to = span;
    out.push([col, to]);
    col = to + 1;
  }
  return out;
}

/**
 * The document header: company, title, gold rule, fact cards. Returns the
 * row number where the next block (the table) should start.
 */
export function addDocumentHeader(
  ws: Worksheet,
  opts: { span: number; company?: string; title: string; facts: Array<[string, string]> },
): number {
  const span = Math.max(3, opts.span);
  ws.getRow(1).height = 8;
  ws.mergeCells(2, 1, 2, span);
  const c = ws.getCell(2, 1);
  c.value = opts.company ?? '';
  c.font = { name: FONT, bold: true, size: 12, color: { argb: DOC_SUB } };
  c.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(3, 1, 3, span);
  const t = ws.getCell(3, 1);
  // RLM first: a title with a Latin code («عقد E2E-…») keeps Arabic order.
  t.value = `\u200f${opts.title}`;
  t.font = { name: FONT, bold: true, size: 20, color: { argb: DOC_INK } };
  t.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(3).height = 36;

  ws.getRow(4).height = 6;
  for (let col = 1; col <= span; col++) {
    ws.getCell(4, col).border = { bottom: { style: 'medium', color: { argb: DOC_GOLD } } };
  }
  ws.getRow(5).height = 12;

  const facts = opts.facts.slice(0, Math.min(4, span));
  factRuns(ws, span, facts.map(([l, v]) => (v.length > l.length ? v : l))).forEach(([from, to], i) => {
    const [label, value] = facts[i]!;
    if (to > from) {
      ws.mergeCells(6, from, 6, to);
      ws.mergeCells(7, from, 7, to);
    }
    const l = ws.getCell(6, from);
    l.value = label;
    l.font = { name: FONT, size: 9.5, color: { argb: DOC_LABEL } };
    const v = ws.getCell(7, from);
    v.value = value;
    v.font = { name: FONT, bold: true, size: 12, color: { argb: DOC_INK } };
    for (const cell of [l, v]) {
      // shrinkToFit: a long value (a date and time) never spills or gets cut.
      cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, shrinkToFit: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DOC_CREAM } };
    }
  });
  ws.getRow(6).height = 18;
  ws.getRow(7).height = 22;
  ws.getRow(8).height = 14;
  return 9;
}

/**
 * The document table at `startRow`: header + rows (+ optional totals), with a
 * filter on the header, the header frozen and repeated on every printed page.
 */
export function addDocumentTable(
  ws: Worksheet,
  startRow: number,
  opts: {
    headers: string[];
    rows: Array<Array<string | number | Date>>;
    /** 1-based columns that hold numbers / dates: centred. */
    numeric?: number[];
    totals?: Array<string | number | null>;
    emptyText?: string;
  },
): void {
  const span = opts.headers.length;
  const numeric = new Set(opts.numeric ?? []);
  const header = ws.getRow(startRow);
  opts.headers.forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DOC_INK } };
    cell.alignment = { horizontal: numeric.has(i + 1) ? 'center' : 'right', vertical: 'middle', indent: numeric.has(i + 1) ? 0 : 1 };
    cell.border = { bottom: { style: 'medium', color: { argb: DOC_GOLD } } };
  });
  header.height = 30;

  let r = startRow + 1;
  if (opts.rows.length === 0) {
    ws.mergeCells(r, 1, r, span);
    const e = ws.getCell(r, 1);
    e.value = opts.emptyText ?? 'لا توجد بيانات';
    e.font = { name: FONT, italic: true, color: { argb: DOC_LABEL } };
    e.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 24;
    r++;
  }
  opts.rows.forEach((values, idx) => {
    const row = ws.getRow(r);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as never;
      const first = i === 0;
      cell.font = { name: FONT, size: 10.5, bold: first, color: { argb: first ? DOC_INK : DOC_TEXT } };
      cell.alignment = { horizontal: numeric.has(i + 1) ? 'center' : 'right', vertical: 'middle', indent: numeric.has(i + 1) ? 0 : 1 };
      cell.border = { bottom: { style: 'thin', color: { argb: DOC_RULE } } };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DOC_CREAM } };
    });
    row.height = 22;
    r++;
  });

  if (opts.totals) {
    const row = ws.getRow(r);
    for (let i = 0; i < span; i++) {
      const cell = row.getCell(i + 1);
      const v = opts.totals[i];
      if (v != null) cell.value = v;
      cell.font = { name: FONT, bold: true, size: 11, color: { argb: DOC_INK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DOC_TOTAL } };
      cell.alignment = { horizontal: numeric.has(i + 1) ? 'center' : 'right', vertical: 'middle', indent: numeric.has(i + 1) ? 0 : 1 };
      cell.border = { top: { style: 'medium', color: { argb: DOC_GOLD } } };
    }
    row.height = 26;
  }

  ws.views = [{ state: 'frozen', ySplit: startRow, rightToLeft: true, showGridLines: false }];
  if (opts.rows.length) ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: span } };
  ws.pageSetup = {
    orientation: span > 6 ? 'landscape' : 'portrait',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${startRow}:${startRow}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter.oddFooter = '&L&P / &N';
}

/**
 * A titled RTL table sheet in the document look: company, title, gold rule,
 * fact cards (applied filters, issue time, record count), then the table.
 * The default presentation for the simple-list XLSX exports. Mutates the sheet.
 */
export function addTitledTable(
  ws: Worksheet,
  opts: {
    title: string;
    /** Applied filters as [label, value] pairs; omitted/empty → «كل البيانات». */
    filters?: Array<[string, string]>;
    headers: string[];
    rows: Array<Array<string | number | Date>>;
    widths: number[];
    /** Company currency — stated in the facts. */
    currency?: string;
    /** Company identity — its name heads the sheet, the time in its zone. */
    brand?: Pick<ReportBrand, 'name' | 'timezone'>;
    /** Shown in place of rows when there are none. */
    emptyText?: string;
    /** 1-based columns holding numbers / dates (centred). */
    numeric?: number[];
    /** A totals row under the table. */
    totals?: Array<string | number | null>;
    /**
     * What the sheet is about ([label, value], e.g. the contract and the
     * customer), shown as the first fact cards in place of the filter card.
     */
    subject?: Array<[string, string]>;
  },
): void {
  ws.columns = opts.widths.map((w) => ({ width: w }));
  const applied = (opts.filters ?? []).filter(([, v]) => v !== '' && v != null);
  // A narrow sheet (a schedule) has no room for «كل البيانات»: show the
  // filter card only when a filter is applied or the sheet is wide.
  const facts: Array<[string, string]> = [
    ...(opts.subject ?? []),
    ...(!opts.subject?.length && (applied.length || opts.headers.length > 6)
      ? ([['التصفية', applied.length ? applied.map(([k, v]) => `${k}: ${v}`).join(' · ') : 'كل البيانات']] as Array<[string, string]>)
      : []),
    ['تاريخ الإصدار', formatStamp(new Date(), opts.brand?.timezone)],
    ['عدد السجلات', String(opts.rows.length)],
  ];
  if (opts.currency) {
    const code = normalizeCurrency(opts.currency);
    facts.push(['العملة', `${arabicCurrencySymbol(code)} (${code})`]);
  }
  const start = addDocumentHeader(ws, {
    span: opts.headers.length,
    company: opts.brand?.name,
    title: opts.title,
    facts,
  });
  addDocumentTable(ws, start, {
    headers: opts.headers,
    rows: opts.rows,
    numeric: opts.numeric,
    totals: opts.totals,
    emptyText: opts.emptyText,
  });
}

// ── Board / proposal report helpers (P15.4) ──────────────────────────────────

/** A navy section-heading row with a full-width gold bottom rule. */
export function addSectionTitle(ws: Worksheet, text: string, span = 4): void {
  ws.addRow([]);
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const goldRule = { bottom: { style: 'medium' as const, color: { argb: XLSX_GOLD } } };
  // Apply the underline across the whole span (a merged cell only renders the
  // border on its anchor otherwise).
  for (let c = 1; c <= span; c++) ws.getCell(row.number, c).border = goldRule;
  const c = row.getCell(1);
  c.value = text;
  c.font = { bold: true, size: 14, color: { argb: XLSX_NAVY } };
  c.alignment = { horizontal: 'right', vertical: 'middle' };
  row.height = 26;
}

// ── Polished board layout (P15.4.1) ──────────────────────────────────────────

/**
 * Prepare a board cover/overview sheet so it reads like a report, not a raw
 * grid: explicit column widths, RTL view with gridlines HIDDEN, and a
 * landscape fit-to-width page setup.
 */
export function setupBoardSheet(
  ws: Worksheet,
  opts: { widths: number[]; landscape?: boolean },
): void {
  ws.columns = opts.widths.map((w) => ({ width: w }));
  ws.views = [{ rightToLeft: true, showGridLines: false }];
  ws.pageSetup = {
    orientation: opts.landscape === false ? 'portrait' : 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

/**
 * A full-width navy banner (rows 1–3): gold brand line, large white report
 * title, and a muted generated-on stamp — the "this is an executive report"
 * header. When `opts.logo` (a PNG buffer) is supplied it is embedded on the
 * leading edge of the band; the logo's dark background blends into the navy
 * fill. A null/absent logo simply leaves the text banner (graceful fallback).
 */
export function addBoardBanner(
  ws: Worksheet,
  title: string,
  span: number,
  opts?: { wb?: Workbook; logo?: Buffer | null; currency?: string; brand?: ReportBrand },
): void {
  // The document look (as the HR exports): white, company line, big title,
  // the issue line, a gold rule under it — the logo on the opposite side.
  const brand = opts?.brand;
  const ink = brand ? argb(brand.primary) : DOC_INK;
  const rule = brand ? argb(brand.accent) : DOC_GOLD;
  const currency = brand?.currency ?? opts?.currency;
  ws.mergeCells(1, 1, 1, span);
  ws.mergeCells(2, 1, 2, span);
  ws.mergeCells(3, 1, 3, span);

  const name = ws.getCell(1, 1);
  name.value = brand ? brand.name : XLSX_BRAND;
  name.font = { bold: true, size: 12, color: { argb: DOC_SUB } };
  name.alignment = { horizontal: 'right', vertical: 'bottom' };

  const t = ws.getCell(2, 1);
  t.value = title;
  t.font = { bold: true, size: 20, color: { argb: ink } };
  t.alignment = { horizontal: 'right', vertical: 'middle' };

  const d = ws.getCell(3, 1);
  const issuer = reportIssuer();
  d.value = `تاريخ الإصدار: ${formatStamp(new Date(), brand?.timezone)}${issuer ? ` · أصدره: ${issuer}` : ''}${currency ? ` · ${currencyNote(currency)}` : ''}`;
  d.font = { size: 10, color: { argb: DOC_LABEL } };
  d.alignment = { horizontal: 'right', vertical: 'top' };
  for (let c = 1; c <= span; c++) {
    ws.getCell(3, c).border = { bottom: { style: 'medium', color: { argb: rule } } };
  }

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 36;
  ws.getRow(3).height = 22;

  // The company logo when there is one; the platform logo only for unbranded files.
  const logo = brand ? brand.logo : opts?.logo ? { buffer: opts.logo, extension: 'png' as const } : null;
  if (opts?.wb && logo) {
    const id = opts.wb.addImage({ buffer: logo.buffer as unknown as ArrayBuffer, extension: logo.extension });
    // Anchor on the leading column (the side opposite the right-aligned text).
    const ext = brand ? fitInto(imageSize(logo.buffer), { width: 150, height: 60 }) : { width: 60, height: 60 };
    ws.addImage(id, { tl: { col: span - 1, row: 0 }, ext });
  }
}

/**
 * A KPI card grid: each card shows a large bold value over a muted label on a
 * light fill with a box border. `perRow` cards per row, each spanning an equal
 * slice of `span` columns. Cards read as proposal "stat cards", not table rows.
 */
export function addKpiCards(
  ws: Worksheet,
  /** `currency` marks a money card: its value shows the currency symbol. */
  cards: Array<{ label: string; value: string | number; currency?: string }>,
  opts: { span: number; perRow?: number; bg?: string; emptyText?: string },
): void {
  if (cards.length === 0) {
    const row = ws.addRow([]);
    ws.mergeCells(row.number, 1, row.number, opts.span);
    const c = ws.getCell(row.number, 1);
    c.value = opts.emptyText ?? 'لا توجد بيانات';
    c.font = { italic: true, color: { argb: XLSX_MUTED } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    return;
  }
  const perRow = opts.perRow ?? 3;
  const colsPerCard = Math.max(1, Math.floor(opts.span / perRow));
  const bg = opts.bg ?? XLSX_CARD_BG;
  const edge = { style: 'thin' as const, color: { argb: XLSX_CARD_BORDER } };

  for (let i = 0; i < cards.length; i += perRow) {
    const slice = cards.slice(i, i + perRow);
    const valueRow = ws.addRow([]);
    valueRow.height = 30;
    const labelRow = ws.addRow([]);
    labelRow.height = 18;

    slice.forEach((card, j) => {
      const c1 = j * colsPerCard + 1;
      const c2 = c1 + colsPerCard - 1;

      ws.mergeCells(valueRow.number, c1, valueRow.number, c2);
      ws.mergeCells(labelRow.number, c1, labelRow.number, c2);
      for (let c = c1; c <= c2; c++) {
        const vc = ws.getCell(valueRow.number, c);
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        vc.border = { top: edge, left: edge, right: edge };
        const lc = ws.getCell(labelRow.number, c);
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.border = { bottom: edge, left: edge, right: edge };
      }

      const v = ws.getCell(valueRow.number, c1);
      v.value = card.value;
      v.font = { bold: true, size: 18, color: { argb: XLSX_NAVY } };
      v.alignment = { horizontal: 'center', vertical: 'middle' };
      if (typeof card.value === 'number') v.numFmt = amountFormat(card.currency, '0.##');

      const l = ws.getCell(labelRow.number, c1);
      l.value = card.label;
      l.font = { size: 10, color: { argb: XLSX_MUTED } };
      l.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    ws.addRow([]); // gap between card rows
  }
}

/**
 * A clearly-titled chart block: a section title, then the chart image embedded
 * below it with enough reserved rows that following content never overlaps.
 * If `png` is null (render failure), emits a muted "chart unavailable" note —
 * the report still ships its tables.
 */
export function addChartBlock(
  wb: Workbook,
  ws: Worksheet,
  title: string,
  png: Buffer | null,
  opts: { span: number; width: number; height: number },
): void {
  addSectionTitle(ws, title, opts.span);
  if (!png) {
    const row = ws.addRow([]);
    ws.mergeCells(row.number, 1, row.number, opts.span);
    const c = ws.getCell(row.number, 1);
    // No chart: nothing to draw (all zero) or rendering unavailable.
    c.value = 'لا يتوفر رسم بياني لهذه البيانات';
    c.font = { italic: true, color: { argb: XLSX_MUTED } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    return;
  }
  const anchorRow = ws.rowCount; // 0-indexed anchor = first empty row below the title
  const rowsNeeded = Math.ceil(opts.height / 20) + 1;
  for (let i = 0; i < rowsNeeded; i++) ws.addRow([]);
  addChartImage(wb, ws, png, { col: 0, row: anchorRow, width: opts.width, height: opts.height });
}

/**
 * Embed a pre-rendered PNG chart (from xlsx-chart.ts) as a floating image. Pass
 * `null` and it is a no-op — the graceful-fallback path, so a report still emits
 * its tables when chart rendering is unavailable. Position is top-left-anchored
 * at (col,row) (0-indexed) with a pixel extent.
 */
export function addChartImage(
  wb: Workbook,
  ws: Worksheet,
  png: Buffer | null,
  opts: { col?: number; row: number; width: number; height: number },
): void {
  if (!png) return;
  const imageId = wb.addImage({ buffer: png as unknown as ArrayBuffer, extension: 'png' });
  ws.addImage(imageId, {
    tl: { col: opts.col ?? 0, row: opts.row },
    ext: { width: opts.width, height: opts.height },
  });
}

// ── Data-sheet layout helpers ─────────────────────────────────────────────────

/**
 * Apply the standard catalogue-sheet chrome to a worksheet that already has a
 * header row at row 1: frozen header, RTL, AutoFilter, tab colour, print setup
 * (landscape, fit to 1 page wide, repeat row 1, 0.5-inch margins, page footer).
 *
 * Call AFTER adding the header row so autoFilter correctly references it.
 */
export function applySheetChrome(
  ws: Worksheet,
  opts: {
    headerCount: number;
    tabColor: string;
  },
): void {
  ws.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: opts.headerCount } };
  ws.properties.tabColor = { argb: opts.tabColor };
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter.oddFooter = `&L${ws.name}&R&P / &N`;
}

/**
 * Apply alternating XLSX_ZEBRA fill to even-numbered data rows (0-indexed).
 * `firstDataRow` is the 1-based row number of the first data row (typically 2,
 * immediately after the header at row 1).
 */
export function applyRowStripes(ws: Worksheet, firstDataRow: number): void {
  for (let rowNum = firstDataRow; rowNum <= ws.rowCount; rowNum++) {
    const dataIdx = rowNum - firstDataRow; // 0-based
    if (dataIdx % 2 === 1) {
      ws.getRow(rowNum).eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_ZEBRA } };
      });
    }
  }
}

/** A browser-safe `<base>-YYYY-MM-DD.xlsx` download name. Mirrors csvFilename. */
export function xlsxFilename(base: string): string {
  const safe = base.replace(/[^\w.-]+/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe}-${stamp}.xlsx`;
}

// ── Cell-type safety helpers (data export) ────────────────────────────────────
//
// Excel silently mangles cell values on open: "3e7f9c12" → scientific notation,
// "01062800394" → 1062800394, 14-digit IDs get rounded. These helpers enforce
// the correct underlying cell type so the XLSX survives open-save-reopen cycles
// regardless of the viewer's locale or Excel's auto-detection heuristics.

/**
 * Write `value` as an Excel Text cell (numFmt '@').
 *
 * Use for: phone numbers, national IDs, _Ref columns, cheque/contract numbers,
 * or any identifier that is numeric-looking but must not be treated as a number.
 * Passing a `number` is safe — it is coerced to string before assignment so the
 * XLSX cell type is String, not Number.
 */
export function writeTextCell(
  cell: Cell,
  value: string | number | null | undefined,
): void {
  // null/undefined → '' (canonical empty cell; import contract: empty = no value)
  cell.value = value != null ? String(value) : '';
  cell.numFmt = '@';
}

/**
 * Write `value` as an Excel calendar-date cell with format `YYYY-MM-DD`.
 *
 * Use this for date-only fields: due dates, signing dates, cancellation dates,
 * cheque dates — values where the time-of-day component is meaningless.
 * numFmt is always set so the column format is stable even when value is null.
 */
export function writeDateCell(
  cell: Cell,
  value: Date | string | null | undefined,
): void {
  cell.numFmt = 'YYYY-MM-DD';
  if (value == null) { cell.value = null; return; }
  cell.value = value instanceof Date ? value : new Date(value);
}

/**
 * Write `value` as a full UTC timestamp cell with format `YYYY-MM-DD HH:MM:SS`.
 *
 * Use this for system timestamp fields: createdAt, updatedAt, paidAt, resolvedAt,
 * earnedAt — anything that originates as a Prisma `DateTime` and where the time
 * component (seconds precision) is meaningful. The "(UTC)" label on the column
 * header signals that all values are in UTC with no timezone conversion.
 */
export function writeDateTimeCell(
  cell: Cell,
  value: Date | string | null | undefined,
): void {
  cell.numFmt = 'YYYY-MM-DD HH:MM:SS';
  if (value == null) { cell.value = null; return; }
  cell.value = value instanceof Date ? value : new Date(value);
}

/**
 * Write `value` as an Excel Number cell with format `#,##0.00` (plus the currency
 * symbol when `currency` is given — see amountFormat).
 *
 * Accepts a JS `number` or any Prisma `Decimal`-like object that implements
 * `toString()`. numFmt is always set so the column format is stable even when
 * value is null.
 */
export function writeAmountCell(
  cell: Cell,
  value: number | { toString(): string } | null | undefined,
  currency?: string,
): void {
  cell.numFmt = amountFormat(currency);
  if (value == null) { cell.value = null; return; }
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  cell.value = Number.isFinite(n) ? n : null;
}

/** Money columns (1-based) of a sheet: numbers with the currency symbol. */
export function formatMoneyColumns(ws: Worksheet, columns: number[], currency: string): void {
  for (const c of columns) ws.getColumn(c).numFmt = amountFormat(currency, '0.##');
}

/** Write an integer value with `#,##0` format (no decimal places). */
export function writeIntCell(cell: Cell, value: number | null | undefined): void {
  cell.numFmt = '#,##0';
  cell.value = value ?? null;
}

/** Write a decimal number (non-currency) with `#,##0.00` format. */
export function writeDecimalCell(cell: Cell, value: number | null | undefined): void {
  cell.numFmt = '#,##0.00';
  cell.value = value ?? null;
}

/** Serialize a workbook to a Node Buffer for a StreamableFile response. */
export async function workbookToBuffer(wb: Workbook): Promise<Buffer> {
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
