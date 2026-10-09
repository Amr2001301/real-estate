import PDFDocumentCtor from 'pdfkit';
type PDFDocument = InstanceType<typeof PDFDocumentCtor>;
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { arabicCurrencySymbol, normalizeCurrency } from '../currency/currency';
import { monogram, type ReportBrand } from './report-brand';

// Report PDFs are company documents: the tenant's logo, name and colours on a
// letterhead (the same layout as the printed contracts and receipts), a
// running header on continuation pages and a numbered footer on every page.

// Resolved relative to this file so it works from both src (ts-jest / dev) and dist.
const FONT_PATH = resolve(__dirname, '../assets/fonts/NotoSansArabic.ttf');

let fontBuffer: Buffer | undefined;
function getFont(): Buffer {
  if (!fontBuffer) fontBuffer = readFileSync(FONT_PATH);
  return fontBuffer;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const INK = '#0F172A';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748B';
const SLATE_400 = '#94A3B8';
const HAIRLINE = '#E2E8F0';
const SURFACE = '#F8FAFC';
const PAGE_W = 595.28; // A4 pts
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_BOTTOM = PAGE_H - 64; // content stops above the footer

type Row = (string | number)[];

interface Ctx {
  doc: PDFDocument;
  brand: ReportBrand;
  title: string;
}

/** A buffered document (pages are revisited to write "page x of y"). */
function createDoc(title: string, brand: ReportBrand): Ctx {
  const doc = new PDFDocumentCtor({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: title, Author: brand.name || title, Creator: brand.name || title },
    pdfVersion: '1.5',
  });
  doc.registerFont('Arabic', getFont());
  return { doc, brand, title };
}

/** Flush a PDFDocument to a Buffer (Promise). */
export function docToBuffer(doc: PDFDocument): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => res(Buffer.concat(chunks)));
    doc.on('error', rej);
    doc.end();
  });
}

// ── Arabic text ───────────────────────────────────────────────────────────────
//
// PDFKit has no bidi algorithm. With the `rtla` feature fontkit lays an Arabic
// string out right-to-left, which also mirrors any Latin/digit run inside it
// ("320,000" → "000,023"). So for a string with Arabic in it: reverse each
// left-to-right run first (the layout reverses it back), and lead with an
// Arabic Letter Mark so a Latin-first string still takes the Arabic path.
// Strings without Arabic are drawn as they are.

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_RUN = /[+([]?[A-Za-z0-9][A-Za-z0-9.,:%/+\-_@ ]*[A-Za-z0-9%)\]]?|[([][A-Za-z0-9]+[)\]]/g;
const ALM = '\u061C';

// eslint-disable-next-line no-undef -- ambient namespace from @types/pdfkit
type TextOptions = PDFKit.Mixins.TextOptions;

/** The string and options to hand PDFKit so mixed Arabic text reads correctly. */
export function bidi(text: string, opts: TextOptions = {}): [string, TextOptions] {
  if (!ARABIC.test(text)) return [text, opts];
  const prepared = text.replace(LTR_RUN, (run) => {
    const trail = /\s+$/.exec(run)?.[0] ?? '';
    const core = run.slice(0, run.length - trail.length);
    return [...core].reverse().join('') + trail;
  });
  return [ALM + prepared, { ...opts, features: ['rtla'] }];
}

/** `doc.text` for possibly-Arabic text at a fixed position. */
function put(doc: PDFDocument, text: string, x: number, y: number, opts: TextOptions): void {
  const [t, o] = bidi(text, opts);
  doc.text(t, x, y, o);
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/**
 * First-page letterhead (RTL): logo + company on the right, report title on
 * the left, then the brand rule — mirrors the printed documents.
 */
function drawLetterhead({ doc, brand, title }: Ctx, subtitle: string) {
  const top = 34;
  const logoBox = { w: 110, h: 46 };
  const right = PAGE_W - MARGIN;
  let nameRight = right;

  if (brand.logo) {
    doc.image(brand.logo.buffer, right - logoBox.w, top, {
      fit: [logoBox.w, logoBox.h],
      align: 'right',
      valign: 'center',
    });
    nameRight = right - logoBox.w - 12;
  } else if (brand.name) {
    doc.roundedRect(right - 46, top, 46, 46, 10).fill(brand.primary);
    doc.font('Arabic').fontSize(16).fillColor('#FFFFFF');
    put(doc, monogram(brand.name), right - 46, top + 12, { width: 46, align: 'center', lineBreak: false });
    nameRight = right - 46 - 12;
  }

  const half = CONTENT_W / 2;
  if (brand.name) {
    const w = nameRight - (MARGIN + half);
    doc.font('Arabic').fontSize(15).fillColor(brand.primary);
    put(doc, brand.name, MARGIN + half, top + 6, { width: w, align: 'right', lineBreak: false });
    // C.R. and phone only — a long e-mail does not fit beside the logo.
    const details = [brand.registrationNumber && `س.ت ${brand.registrationNumber}`, brand.contactPhone]
      .filter(Boolean)
      .join('  ·  ');
    if (details) {
      doc.font('Arabic').fontSize(7.5).fillColor(SLATE_500);
      put(doc, details, MARGIN + half, top + 28, { width: w, align: 'right', lineBreak: false });
    }
  }

  doc.font('Arabic').fontSize(7.5).fillColor(brand.accent);
  put(doc, 'تقرير', MARGIN, top, { width: half, align: 'left', lineBreak: false });
  doc.font('Arabic').fontSize(17).fillColor(INK);
  put(doc, title, MARGIN, top + 11, { width: half, align: 'left', lineBreak: false });
  doc.font('Arabic').fontSize(8.5).fillColor(SLATE_500);
  put(doc, subtitle, MARGIN, top + 36, { width: half, align: 'left', lineBreak: false });

  doc.rect(MARGIN, top + 58, CONTENT_W, 2.5).fill(brand.primary);
  doc.rect(MARGIN, top + 62, CONTENT_W, 0.8).fill(brand.accent);
  doc.y = top + 78;
}

/** Continuation pages: a slim company / title line. */
function drawRunningHeader({ doc, brand, title }: Ctx) {
  const y = 26;
  doc.font('Arabic').fontSize(8.5).fillColor(brand.primary);
  put(doc, brand.name || title, MARGIN, y, { width: CONTENT_W, align: 'right', lineBreak: false });
  doc.font('Arabic').fontSize(8.5).fillColor(SLATE_500);
  put(doc, title, MARGIN, y, { width: CONTENT_W, align: 'left', lineBreak: false });
  doc.rect(MARGIN, y + 16, CONTENT_W, 0.8).fill(brand.accent);
  doc.y = y + 28;
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  drawRunningHeader(ctx);
}

function ensureSpace(ctx: Ctx, height: number) {
  if (ctx.doc.y + height > BODY_BOTTOM) newPage(ctx);
}

function drawSectionTitle(ctx: Ctx, label: string) {
  ensureSpace(ctx, 60);
  const { doc, brand } = ctx;
  const y = doc.y + 10;
  doc.rect(PAGE_W - MARGIN - 3, y + 2, 3, 12).fill(brand.accent);
  doc.font('Arabic').fontSize(11).fillColor(brand.primary);
  put(doc, label, MARGIN, y, { width: CONTENT_W - 9, align: 'right', lineBreak: false });
  doc.y = y + 24;
}

function drawKpiRow(ctx: Ctx, items: Array<{ label: string; value: string | number }>) {
  ensureSpace(ctx, 56);
  const { doc, brand } = ctx;
  const gap = 8;
  const colW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const startY = doc.y;
  const boxH = 48;

  // RTL: the first card sits at the right edge.
  items.forEach((item, i) => {
    const x = PAGE_W - MARGIN - (i + 1) * colW - i * gap;
    doc.roundedRect(x, startY, colW, boxH, 6).fillAndStroke(SURFACE, HAIRLINE);
    doc.font('Arabic').fontSize(7.5).fillColor(SLATE_500);
    put(doc, item.label, x + 8, startY + 8, { width: colW - 16, align: 'right', lineBreak: false });
    doc.font('Arabic').fontSize(14).fillColor(brand.primary);
    put(doc, String(item.value), x + 8, startY + 22, { width: colW - 16, align: 'right', lineBreak: false });
  });

  doc.y = startY + boxH + gap;
}

function drawTable(ctx: Ctx, headers: string[], rows: Row[], opts: { colWidths?: number[] } = {}) {
  const { doc, brand } = ctx;
  if (rows.length === 0) {
    ensureSpace(ctx, 30);
    doc.font('Arabic').fontSize(10).fillColor(SLATE_400);
    put(doc, 'لا توجد بيانات', MARGIN, doc.y + 6, { width: CONTENT_W, align: 'center' });
    doc.y += 30;
    return;
  }

  const cols = headers.length;
  const colWidths = opts.colWidths?.length === cols ? opts.colWidths : Array(cols).fill(CONTENT_W / cols);
  const rowH = 22;

  // RTL: the first column sits at the right edge; each column keeps its width.
  const drawRow = (cells: string[], y: number) => {
    let x = MARGIN + CONTENT_W;
    cells.forEach((cell, i) => {
      const cw = colWidths[i]!;
      x -= cw;
      put(doc, cell, x + 6, y + 6, { width: cw - 12, align: 'right', lineBreak: false });
    });
  };
  const drawHead = () => {
    const y = doc.y;
    doc.roundedRect(MARGIN, y, CONTENT_W, rowH, 4).fill(brand.primary);
    doc.font('Arabic').fontSize(8.5).fillColor('#FFFFFF');
    drawRow(headers, y);
    doc.y = y + rowH;
  };

  ensureSpace(ctx, rowH * 3);
  drawHead();
  rows.forEach((row, ri) => {
    if (doc.y + rowH > BODY_BOTTOM) {
      newPage(ctx);
      drawHead(); // the header row repeats on every page
    }
    const y = doc.y;
    if (ri % 2 === 1) doc.rect(MARGIN, y, CONTENT_W, rowH).fill(SURFACE);
    doc.rect(MARGIN, y + rowH - 0.5, CONTENT_W, 0.5).fill(HAIRLINE);
    doc.font('Arabic').fontSize(9).fillColor(SLATE_700);
    drawRow(row.map((c) => (typeof c === 'number' ? c.toLocaleString('en') : String(c))), y);
    doc.y = y + rowH;
  });
  doc.y += 10;
}

/** Footer on every page: company + issue date, and "page x of y". */
function finalize(ctx: Ctx) {
  const { doc, brand } = ctx;
  const range = doc.bufferedPageRange();
  // Latin digits: Arabic-Indic ones are not a left-to-right run for bidi().
  const issued = new Date().toLocaleDateString('en-GB');
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Writing below the bottom margin would make PDFKit open a new page.
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = PAGE_H - 40;
    doc.rect(MARGIN, y, CONTENT_W, 0.6).fill(HAIRLINE);
    doc.font('Arabic').fontSize(7.5).fillColor(SLATE_400);
    const left = [brand.name, brand.registrationNumber && `س.ت ${brand.registrationNumber}`, `صدر بتاريخ ${issued}`]
      .filter(Boolean)
      .join('  ·  ');
    put(doc, left, MARGIN, y + 8, { width: CONTENT_W, align: 'right', lineBreak: false });
    put(doc, `صفحة ${i + 1} من ${range.count}`, MARGIN, y + 8, { width: CONTENT_W, align: 'left', lineBreak: false });
    doc.page.margins.bottom = margin;
  }
}

// ── Public PDF builders ───────────────────────────────────────────────────────

/** "1,250,000 ج.م" — report amounts in the company currency. */
function money(value: number | string, currency: string): string {
  return `${Number(value).toLocaleString('en')} ${arabicCurrencySymbol(currency)}`;
}

/** Header subtitle: the period, then the currency every amount is in. */
function subtitle(dateLabel: string, currency: string): string {
  const code = normalizeCurrency(currency);
  return `الفترة: ${dateLabel}  ·  العملة: ${arabicCurrencySymbol(code)} (${code})`;
}

function periodLabel(data: { period?: string; dateFrom?: string; dateTo?: string }): string {
  return data.period ?? (data.dateFrom && data.dateTo ? `من ${data.dateFrom} إلى ${data.dateTo}` : 'الكل');
}

export interface SalesPdfData {
  contracts: number;
  total: number | string;
  byProject: Array<{ name: string; count: number; total: number }>;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}

export async function buildSalesPdf(data: SalesPdfData, brand: ReportBrand): Promise<Buffer> {
  const dateLabel = periodLabel(data);
  const ctx = createDoc('تقرير المبيعات', brand);
  drawLetterhead(ctx, subtitle(dateLabel, brand.currency));

  drawSectionTitle(ctx, 'ملخص');
  drawKpiRow(ctx, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد العقود', value: data.contracts },
    { label: 'إجمالي القيمة', value: money(data.total, brand.currency) },
  ]);

  drawSectionTitle(ctx, 'المبيعات حسب المشروع');
  drawTable(
    ctx,
    ['المشروع', 'عدد العقود', 'إجمالي القيمة'],
    data.byProject.map((p) => [p.name, p.count, money(p.total, brand.currency)]),
    { colWidths: [CONTENT_W * 0.55, CONTENT_W * 0.2, CONTENT_W * 0.25] },
  );

  finalize(ctx);
  return docToBuffer(ctx.doc);
}

export interface FinancialPdfData {
  deposits: number;
  verified: number;
  total: number | string;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}

export async function buildFinancialPdf(data: FinancialPdfData, brand: ReportBrand): Promise<Buffer> {
  const dateLabel = periodLabel(data);
  const unverified = Math.max(0, data.deposits - data.verified);
  const total = Number(data.total);
  const verifiedPct = data.deposits > 0 ? `${Math.round((data.verified / data.deposits) * 100)}%` : '—';

  const ctx = createDoc('التقرير المالي', brand);
  drawLetterhead(ctx, subtitle(dateLabel, brand.currency));

  drawSectionTitle(ctx, 'ملخص');
  drawKpiRow(ctx, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد الدفعات', value: data.deposits },
    { label: 'إجمالي المحصّل', value: money(total, brand.currency) },
  ]);
  drawKpiRow(ctx, [
    { label: 'الدفعات الموثّقة', value: data.verified },
    { label: 'غير الموثّقة', value: unverified },
    { label: 'نسبة التوثيق', value: verifiedPct },
  ]);

  drawSectionTitle(ctx, 'تفاصيل التحصيل');
  drawTable(
    ctx,
    ['البيان', 'القيمة'],
    [
      ['إجمالي المبالغ المحصّلة', money(total, brand.currency)],
      ['الدفعات الموثّقة', data.verified],
      ['الدفعات غير الموثّقة', unverified],
      ['عدد الدفعات الكلي', data.deposits],
    ],
    { colWidths: [CONTENT_W * 0.65, CONTENT_W * 0.35] },
  );

  finalize(ctx);
  return docToBuffer(ctx.doc);
}

export interface BrokerPdfData {
  brokers: Array<{ brokerName: string; count: number; commissionAmount: number }>;
  dateFrom?: string;
  dateTo?: string;
}

export async function buildBrokerPdf(data: BrokerPdfData, brand: ReportBrand): Promise<Buffer> {
  const dateLabel = periodLabel(data);
  const totalCommissions = data.brokers.reduce((s, b) => s + b.commissionAmount, 0);

  const ctx = createDoc('تقرير الوسطاء', brand);
  drawLetterhead(ctx, subtitle(dateLabel, brand.currency));

  drawSectionTitle(ctx, 'ملخص');
  drawKpiRow(ctx, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد الوسطاء', value: data.brokers.length },
    { label: 'إجمالي العمولات', value: money(totalCommissions, brand.currency) },
  ]);

  drawSectionTitle(ctx, 'ترتيب الوسطاء');
  drawTable(
    ctx,
    ['#', 'الوسيط', 'عدد العمولات', 'إجمالي العمولات'],
    data.brokers.map((b, i) => [i + 1, b.brokerName, b.count, money(b.commissionAmount, brand.currency)]),
    { colWidths: [CONTENT_W * 0.08, CONTENT_W * 0.44, CONTENT_W * 0.18, CONTENT_W * 0.3] },
  );

  finalize(ctx);
  return docToBuffer(ctx.doc);
}
