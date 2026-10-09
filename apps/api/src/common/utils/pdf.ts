import PDFDocumentCtor from 'pdfkit';
type PDFDocument = InstanceType<typeof PDFDocumentCtor>;
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { arabicCurrencySymbol, normalizeCurrency } from '../currency/currency';

// Resolved relative to this file so it works from both src (ts-jest / dev) and dist.
const FONT_PATH = resolve(__dirname, '../assets/fonts/NotoSansArabic.ttf');
const LOGO_PATH = resolve(__dirname, '../../../assets/brand/devora-logo.png');

// Load assets once at module level — readFileSync is fine for small static files.
let fontBuffer: Buffer | undefined;
let logoBuffer: Buffer | null | undefined;

function getFont(): Buffer {
  if (!fontBuffer) {
    fontBuffer = readFileSync(FONT_PATH);
  }
  return fontBuffer;
}

function getLogo(): Buffer | null {
  if (logoBuffer === undefined) {
    try {
      logoBuffer = readFileSync(LOGO_PATH);
    } catch {
      logoBuffer = null;
    }
  }
  return logoBuffer;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const BRAND_NAVY = '#0A1628';
const BRAND_GOLD = '#D4A843';
const SLATE_700 = '#334155';
const SLATE_400 = '#94A3B8';
const HAIRLINE  = '#E2E8F0';
const PAGE_W    = 595.28; // A4 pts
const MARGIN    = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Row = (string | number)[];

/** Shared helper — creates a PDFDocument with the Arabic font pre-registered. */
function createDoc(title: string): PDFDocument {
  const doc = new PDFDocumentCtor({
    size: 'A4',
    margin: MARGIN,
    info: { Title: title, Author: 'Devora Platform', Creator: 'Devora API' },
    pdfVersion: '1.5',
  });
  doc.registerFont('Arabic', getFont());
  return doc;
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
const LTR_RUN = /[([]?[A-Za-z0-9][A-Za-z0-9.,:%/+\-_@ ]*[A-Za-z0-9%)\]]?|[([][A-Za-z0-9]+[)\]]/g;
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

function drawHeader(doc: PDFDocument, title: string, subtitle?: string) {
  // Navy banner strip
  doc.rect(0, 0, PAGE_W, 72).fill(BRAND_NAVY);

  // Logo (if available)
  const logo = getLogo();
  if (logo) {
    doc.image(logo, MARGIN, 14, { height: 44, fit: [120, 44] });
  } else {
    doc.font('Arabic').fontSize(14).fillColor(BRAND_GOLD).text('Devora', MARGIN, 24);
  }

  // Title text (right-aligned, RTL)
  doc.font('Arabic').fontSize(16).fillColor('#FFFFFF');
  put(doc, title, MARGIN, 18, { width: CONTENT_W, align: 'right', lineBreak: false });

  if (subtitle) {
    doc.font('Arabic').fontSize(10).fillColor(BRAND_GOLD);
    put(doc, subtitle, MARGIN, 42, { width: CONTENT_W, align: 'right', lineBreak: false });
  }

  doc.moveDown(0.5);
}

function drawSectionTitle(doc: PDFDocument, label: string) {
  const y = doc.y + 8;
  doc.font('Arabic').fontSize(11).fillColor(BRAND_NAVY);
  put(doc, label, MARGIN, y, { width: CONTENT_W, align: 'right' });
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + CONTENT_W, doc.y + 2)
    .strokeColor(BRAND_GOLD)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.5);
}

function drawKpiRow(
  doc: PDFDocument,
  items: Array<{ label: string; value: string | number }>,
) {
  const colW = CONTENT_W / items.length;
  const startY = doc.y + 4;
  const boxH = 42;

  items.forEach((item, i) => {
    const x = MARGIN + i * colW;
    doc.rect(x + 2, startY, colW - 4, boxH).fill('#F8FAFC').stroke(HAIRLINE);
    doc.font('Arabic').fontSize(8).fillColor(SLATE_400);
    put(doc, item.label, x + 4, startY + 6, { width: colW - 8, align: 'center' });
    doc.font('Arabic').fontSize(13).fillColor(BRAND_NAVY);
    put(doc, String(item.value), x + 4, startY + 20, {
      width: colW - 8,
      align: 'center',
      lineBreak: false,
    });
  });

  doc.y = startY + boxH + 8;
}

function drawTable(
  doc: PDFDocument,
  headers: string[],
  rows: Row[],
  opts: { colWidths?: number[] } = {},
) {
  if (rows.length === 0) {
    doc.font('Arabic').fontSize(10).fillColor(SLATE_400);
    put(doc, 'لا توجد بيانات', MARGIN, doc.y + 4, { width: CONTENT_W, align: 'center' });
    doc.moveDown(1);
    return;
  }

  const cols = headers.length;
  const colWidths =
    opts.colWidths?.length === cols
      ? opts.colWidths
      : Array(cols).fill(CONTENT_W / cols);

  const rowH = 20;
  const hdrY = doc.y + 4;

  // Header row
  doc.rect(MARGIN, hdrY, CONTENT_W, rowH).fill(BRAND_NAVY);
  // RTL: the first column sits at the right edge; each column keeps its width.
  let cx = MARGIN + CONTENT_W;
  headers.forEach((h, i) => {
    const cw = colWidths[i]!;
    cx -= cw;
    doc.font('Arabic').fontSize(9).fillColor('#FFFFFF');
    put(doc, h, cx, hdrY + 5, { width: cw - 4, align: 'right', lineBreak: false });
  });
  doc.y = hdrY + rowH;

  rows.forEach((row, ri) => {
    if (doc.y + rowH > doc.page.height - MARGIN) {
      doc.addPage();
      drawHeader(doc, '');
    }
    const ry = doc.y;
    const bg = ri % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    doc.rect(MARGIN, ry, CONTENT_W, rowH).fill(bg).stroke(HAIRLINE).lineWidth(0.5);

    let x = MARGIN + CONTENT_W;
    row.forEach((cell, i) => {
      const cw = colWidths[i]!;
      x -= cw;
      const val = typeof cell === 'number' ? cell.toLocaleString('en') : String(cell);
      doc.font('Arabic').fontSize(9).fillColor(SLATE_700);
      put(doc, val, x, ry + 5, { width: cw - 4, align: 'right', lineBreak: false });
    });
    doc.y = ry + rowH;
  });

  doc.moveDown(0.5);
}

function drawFooter(doc: PDFDocument) {
  const y = doc.page.height - 30;
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_W, y)
    .strokeColor(HAIRLINE)
    .lineWidth(0.5)
    .stroke();
  doc.font('Arabic').fontSize(8).fillColor(SLATE_400);
  put(doc, `تقرير مُنشأ بتاريخ ${new Date().toLocaleDateString('ar-EG')} · Devora Platform`, MARGIN, y + 6, {
    width: CONTENT_W,
    align: 'center',
  });
}

// ── Public PDF builders ───────────────────────────────────────────────────────

/** "1,250,000 ج.م" — report amounts in the company currency. */
function money(value: number | string, currency: string): string {
  return `${Number(value).toLocaleString('en')} ${arabicCurrencySymbol(currency)}`;
}

/** Header subtitle: the period, then the currency every amount is in. */
function subtitle(dateLabel: string, currency: string): string {
  const code = normalizeCurrency(currency);
  return `الفترة: ${dateLabel} · العملة: ${arabicCurrencySymbol(code)} (${code})`;
}

export interface SalesPdfData {
  /** Company currency (ISO 4217) — every amount in the report is in it. */
  currency: string;
  contracts: number;
  total: number | string;
  byProject: Array<{ name: string; count: number; total: number }>;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}

export async function buildSalesPdf(data: SalesPdfData): Promise<Buffer> {
  const dateLabel =
    data.period ?? (data.dateFrom && data.dateTo ? `من ${data.dateFrom} إلى ${data.dateTo}` : 'الكل');
  const doc = createDoc('تقرير المبيعات');
  drawHeader(doc, 'تقرير المبيعات', subtitle(dateLabel, data.currency));
  doc.moveDown(0.5);

  drawSectionTitle(doc, 'ملخص');
  drawKpiRow(doc, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد العقود', value: data.contracts },
    { label: 'إجمالي القيمة', value: money(data.total, data.currency) },
  ]);

  doc.moveDown(0.5);
  drawSectionTitle(doc, 'المبيعات حسب المشروع');
  drawTable(
    doc,
    ['المشروع', 'عدد العقود', 'إجمالي القيمة'],
    data.byProject.map((p) => [p.name, p.count, money(p.total, data.currency)]),
    { colWidths: [CONTENT_W * 0.55, CONTENT_W * 0.2, CONTENT_W * 0.25] },
  );

  drawFooter(doc);
  return docToBuffer(doc);
}

export interface FinancialPdfData {
  /** Company currency (ISO 4217) — every amount in the report is in it. */
  currency: string;
  deposits: number;
  verified: number;
  total: number | string;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}

export async function buildFinancialPdf(data: FinancialPdfData): Promise<Buffer> {
  const dateLabel =
    data.period ?? (data.dateFrom && data.dateTo ? `من ${data.dateFrom} إلى ${data.dateTo}` : 'الكل');
  const unverified = Math.max(0, data.deposits - data.verified);
  const total = Number(data.total);
  const verifiedPct =
    data.deposits > 0 ? `${Math.round((data.verified / data.deposits) * 100)}%` : '—';

  const doc = createDoc('التقرير المالي');
  drawHeader(doc, 'التقرير المالي', subtitle(dateLabel, data.currency));
  doc.moveDown(0.5);

  drawSectionTitle(doc, 'ملخص');
  drawKpiRow(doc, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد الدفعات', value: data.deposits },
    { label: 'إجمالي المحصّل', value: money(total, data.currency) },
  ]);
  doc.moveDown(0.25);
  drawKpiRow(doc, [
    { label: 'الدفعات الموثّقة', value: data.verified },
    { label: 'غير الموثّقة', value: unverified },
    { label: 'نسبة التوثيق', value: verifiedPct },
  ]);

  doc.moveDown(0.5);
  drawSectionTitle(doc, 'تفاصيل التحصيل');
  drawTable(
    doc,
    ['البيان', 'القيمة'],
    [
      ['إجمالي المبالغ المحصّلة', money(total, data.currency)],
      ['الدفعات الموثّقة', data.verified],
      ['الدفعات غير الموثّقة', unverified],
      ['عدد الدفعات الكلي', data.deposits],
    ],
    { colWidths: [CONTENT_W * 0.65, CONTENT_W * 0.35] },
  );

  drawFooter(doc);
  return docToBuffer(doc);
}

export interface BrokerPdfData {
  /** Company currency (ISO 4217) — every amount in the report is in it. */
  currency: string;
  brokers: Array<{ brokerName: string; count: number; commissionAmount: number }>;
  dateFrom?: string;
  dateTo?: string;
}

export async function buildBrokerPdf(data: BrokerPdfData): Promise<Buffer> {
  const dateLabel =
    data.dateFrom && data.dateTo ? `من ${data.dateFrom} إلى ${data.dateTo}` : 'الكل';
  const totalCommissions = data.brokers.reduce((s, b) => s + b.commissionAmount, 0);

  const doc = createDoc('تقرير الوسطاء');
  drawHeader(doc, 'تقرير الوسطاء', subtitle(dateLabel, data.currency));
  doc.moveDown(0.5);

  drawSectionTitle(doc, 'ملخص');
  drawKpiRow(doc, [
    { label: 'الفترة', value: dateLabel },
    { label: 'عدد الوسطاء', value: data.brokers.length },
    { label: 'إجمالي العمولات', value: money(totalCommissions, data.currency) },
  ]);

  doc.moveDown(0.5);
  drawSectionTitle(doc, 'ترتيب الوسطاء');
  drawTable(
    doc,
    ['#', 'الوسيط', 'عدد العمولات', 'إجمالي العمولات'],
    data.brokers.map((b, i) => [i + 1, b.brokerName, b.count, money(b.commissionAmount, data.currency)]),
    { colWidths: [CONTENT_W * 0.08, CONTENT_W * 0.44, CONTENT_W * 0.18, CONTENT_W * 0.3] },
  );

  drawFooter(doc);
  return docToBuffer(doc);
}
