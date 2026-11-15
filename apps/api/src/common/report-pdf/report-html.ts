import { reportIssuer } from './report-issuer';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { arabicCurrencySymbol, normalizeCurrency } from '../currency/currency';
import { monogram, type ReportBrand } from '../utils/report-brand';
import { formatStamp } from '../utils/xlsx';

/**
 * The design system for presentation reports (HTML printed to PDF by
 * Chromium — see ReportPdfService). Small pure builders that return markup:
 * a report is `reportDocument({ brand, title, meta, body })` where the body
 * is made of `section`, `kpiGrid`, `chartPanel`/`panelGrid` and `dataTable`.
 *
 * Every dynamic string goes through `esc` — the HTML carries tenant data.
 * Colours from the brand are accepted only as #RRGGBB. The Arabic font is
 * embedded (servers ship without one) and nothing is fetched at render time.
 */

const FONT_PATH = resolve(__dirname, '../assets/fonts/NotoSansArabic.ttf');
let fontDataUrl: string | null | undefined;

export function fontFace(): string {
  if (fontDataUrl === undefined) {
    try {
      fontDataUrl = `data:font/ttf;base64,${readFileSync(FONT_PATH).toString('base64')}`;
    } catch {
      fontDataUrl = null;
    }
  }
  return fontDataUrl
    ? `@font-face{font-family:'ReportArabic';src:url(${fontDataUrl}) format('truetype');font-weight:100 900;}`
    : '';
}

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function hex(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

/** "1,250,000 ج.م" — grouped, no decimals unless there are some. */
export function moneyText(value: number | string, currency: string): string {
  const n = Number(value) || 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${n.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: 2 })} ${arabicCurrencySymbol(currency)}`;
}

export function countText(value: number): string {
  return (Number(value) || 0).toLocaleString('en');
}

export function percentText(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

// ── Building blocks ──────────────────────────────────────────────────────────

export interface Kpi {
  label: string;
  /** Already formatted (moneyText / countText / percentText). */
  value: string;
  /** A short line under the value ("من 30 وحدة"). */
  hint?: string;
  /** `warn` tints the card (an amount that needs attention). */
  tone?: 'default' | 'warn' | 'good';
}

/** Smaller type for figures too long for their card, so they are never cut. */
function kpiValueSize(value: string, columns: number): string {
  const room = columns >= 4 ? 13 : columns === 3 ? 18 : 26;
  if (value.length > room + 4) return ' xs';
  if (value.length > room) return ' sm';
  return '';
}

export function kpiGrid(cards: Kpi[], columns = 4): string {
  // minmax(0,1fr): a long figure must not widen its column past the page edge.
  return `<div class="kpis" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">${cards
    .map(
      (k) => `<div class="kpi ${k.tone ?? 'default'}">
  <div class="kpi-label">${esc(k.label)}</div>
  <div class="kpi-value${kpiValueSize(k.value, columns)}" dir="ltr">${esc(k.value)}</div>
  ${k.hint ? `<div class="kpi-hint">${esc(k.hint)}</div>` : ''}
</div>`,
    )
    .join('')}</div>`;
}

export function section(title: string, inner: string, note?: string): string {
  return `<section class="section">
  <h2>${esc(title)}${note ? `<span class="note">${esc(note)}</span>` : ''}</h2>
  ${inner}
</section>`;
}

/**
 * A framed chart; `svg` comes from svg-charts.ts (empty → a quiet note).
 * Charts are drawn at their printed size so text stays legible: CHART_FULL
 * wide for a full-width panel, CHART_HALF for one of two side by side.
 */
export const CHART_FULL = 680;
export const CHART_HALF = 320;

export function chartPanel(title: string, svg: string, empty = 'لا توجد بيانات لعرضها'): string {
  return `<div class="panel">
  <div class="panel-title">${esc(title)}</div>
  ${svg || `<div class="empty">${esc(empty)}</div>`}
</div>`;
}

/** Panels side by side (stacks on its own when there is one). */
export function panelGrid(...panels: string[]): string {
  return `<div class="panels" style="grid-template-columns:repeat(${Math.max(1, panels.length)},1fr)">${panels.join('')}</div>`;
}

export interface Column {
  label: string;
  /** Numbers / amounts / dates: aligned to the end, LTR digits, tabular. */
  numeric?: boolean;
  /** Relative width (fr-like weight). */
  width?: number;
}

export function dataTable(
  columns: Column[],
  rows: Array<Array<string | number>>,
  opts: { totals?: Array<string | number>; empty?: string } = {},
): string {
  const total = columns.reduce((a, c) => a + (c.width ?? 1), 0);
  const colgroup = columns
    .map((c) => `<col style="width:${(((c.width ?? 1) / total) * 100).toFixed(2)}%">`)
    .join('');
  const cell = (v: string | number, c: Column | undefined, tag: 'td' | 'th') =>
    `<${tag}${c?.numeric ? ' class="num" dir="ltr"' : ''}>${esc(v)}</${tag}>`;
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((v, i) => cell(v, columns[i], 'td')).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${columns.length}">${esc(opts.empty ?? 'لا توجد بيانات')}</td></tr>`;
  const foot = opts.totals
    ? `<tfoot><tr>${opts.totals.map((v, i) => cell(v, columns[i], 'td')).join('')}</tr></tfoot>`
    : '';
  return `<table class="data"><colgroup>${colgroup}</colgroup>
<thead><tr>${columns.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${body}</tbody>${foot}</table>`;
}

/** A calm "all clear" line (e.g. no pending alerts). */
export function notice(text: string, tone: 'good' | 'muted' = 'good'): string {
  return `<div class="notice ${tone}">${esc(text)}</div>`;
}

// ── The document ─────────────────────────────────────────────────────────────

export interface ReportDocument {
  brand: ReportBrand;
  title: string;
  /** Under the title ("الفترة: …"). */
  subtitle?: string;
  body: string;
  /** Extra header facts ([label, value]); the issue time and currency are always shown. */
  meta?: Array<[string, string]>;
  /** Wide tables: print the page sideways (A4 landscape). */
  landscape?: boolean;
}

export function reportDocument(doc: ReportDocument): string {
  const { brand } = doc;
  const primary = hex(brand.primary, '#0F1E33');
  const accent = hex(brand.accent, '#C8A24B');
  const currency = normalizeCurrency(brand.currency);
  // «الفترة: …» reads best as the first fact card (as on the HR reports).
  // Who asked for it (set per export request; see report-issuer.ts).
  const issuer = reportIssuer();
  const periodMatch = doc.subtitle?.match(/^(.*?)(?:\s*·\s*)?الفترة:\s*(.+)$/);
  const subtitle = periodMatch ? (periodMatch[1] ?? '').trim() || undefined : doc.subtitle;
  const meta: Array<[string, string]> = [
    ...(periodMatch ? ([['الفترة', (periodMatch[2] ?? '').trim()]] as Array<[string, string]>) : []),
    ...(doc.meta ?? []),
    ['تاريخ الإصدار', formatStamp(new Date(), brand.timezone)],
    ...(issuer ? ([['أصدره', issuer]] as Array<[string, string]>) : []),
    ['العملة', `${arabicCurrencySymbol(currency)} (${currency})`],
  ];
  const mark = brand.logo
    ? `<img class="logo" src="data:image/${brand.logo.extension};base64,${brand.logo.buffer.toString('base64')}" alt="">`
    : `<div class="monogram">${esc(monogram(brand.name || 'R'))}</div>`;
  // Phone and e-mail are LTR runs inside an RTL line: isolate them or "+20 2…" reorders.
  const contact = [
    brand.registrationNumber &&
      `<span>س.ت <bdi dir="ltr">${esc(brand.registrationNumber)}</bdi></span>`,
    brand.contactPhone && `<span><bdi dir="ltr">${esc(brand.contactPhone)}</bdi></span>`,
    brand.contactEmail && `<span><bdi dir="ltr">${esc(brand.contactEmail)}</bdi></span>`,
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(doc.title)}</title>
<style>
${fontFace()}
@page { size: A4${doc.landscape ? ' landscape' : ''}; }
:root { --primary:${primary}; --accent:${accent}; --ink:#0f172a; --muted:#64748b; --line:#e8e1d2; --zebra:#fbf8f2; }
* { box-sizing:border-box; }
html, body { margin:0; padding:0; }
body { font-family:'ReportArabic','Noto Sans Arabic','DejaVu Sans',sans-serif; color:var(--ink); font-size:11px; line-height:1.5;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; font-variant-numeric:tabular-nums; }
.head { display:flex; gap:16px; align-items:center; justify-content:space-between; padding:2px 2px 12px; }
.head .titles { min-width:0; }
.company { color:#4a5263; font-weight:700; font-size:12px; }
.title { font-size:24px; font-weight:800; color:var(--primary); margin:2px 0 0; line-height:1.25; }
.subtitle { color:var(--muted); font-size:11px; margin-top:3px; }
.brandbox { display:flex; gap:10px; align-items:center; flex-shrink:0; }
.brandbox .bname { font-weight:800; font-size:13px; color:var(--primary); white-space:nowrap; }
.contact { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; color:var(--muted); font-size:9px; margin-bottom:4px; }
.logo { height:52px; max-width:150px; object-fit:contain; }
.monogram { width:46px; height:46px; border-radius:10px; background:var(--primary); color:var(--accent); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; }
.goldline { height:3px; border-radius:2px; background:linear-gradient(90deg, rgba(200,162,75,.35), var(--accent) 35%, var(--accent) 65%, rgba(200,162,75,.35)); }
.facts { display:grid; gap:10px; margin-top:14px; }
.fact { border:1px solid #e8e1d2; border-radius:12px; padding:8px 14px; background:#fff; }
.fact dt { color:var(--muted); font-size:9.5px; }
.fact dd { margin:2px 0 0; font-weight:800; font-size:13px; color:var(--primary); }
.section { margin-top:18px; }
.section h2 { font-size:13.5px; margin:0 0 10px; color:var(--primary); display:flex; align-items:baseline; gap:8px;
  border-inline-start:3px solid var(--accent); padding-inline-start:8px; break-after:avoid; }
.section h2 .note { color:var(--muted); font-weight:400; font-size:10px; }
.kpis { display:grid; gap:10px; }
.kpi { border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:#fff; break-inside:avoid; min-width:0; }
.kpi.warn { background:#fff7ed; border-color:#fed7aa; }
.kpi.good { background:#f0fdf4; border-color:#bbf7d0; }
.kpi-label { color:var(--muted); font-size:10px; }
.kpi-value { font-size:18px; font-weight:800; color:var(--primary); margin-top:2px; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:clip; }
.kpi-value.sm { font-size:15px; }
.kpi-value.xs { font-size:12.5px; }
.kpi.warn .kpi-value { color:#c2410c; }
.kpi-hint { color:var(--muted); font-size:9.5px; margin-top:1px; }
.panels { display:grid; gap:12px; }
.panel { border:1px solid var(--line); border-radius:12px; padding:10px 12px 8px; break-inside:avoid; }
.panel-title { font-weight:700; font-size:11px; margin-bottom:6px; }
.panel svg { display:block; margin:0 auto; }
.empty { color:var(--muted); text-align:center; padding:18px 0; font-style:italic; }
table.data { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:14px; overflow:hidden; font-size:10.5px; }
table.data thead { display:table-header-group; }
/* The totals once, under the last row: a footer group repeats on every page. */
table.data tfoot { display:table-row-group; }
table.data th { background:var(--primary); color:#fff; font-weight:700; text-align:right; padding:9px 10px; }
table.data td:first-child { font-weight:700; color:var(--primary); }
table.data td { padding:6px 10px; border-top:1px solid var(--line); text-align:right; }
table.data tbody tr:nth-child(even) td { background:var(--zebra); }
table.data tr { break-inside:avoid; }
table.data .num { text-align:left; white-space:nowrap; }
table.data tfoot td { font-weight:800; background:#f6eedc; border-top:2px solid var(--accent); padding:9px 10px; }
table.data td.empty { text-align:center; }
.notice { border-radius:10px; padding:10px 12px; font-size:11px; }
.notice.good { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }
.notice.muted { background:var(--zebra); color:var(--muted); border:1px solid var(--line); }
.endnote { margin-top:22px; color:var(--muted); font-size:9px; text-align:center; }
</style>
</head>
<body>
<header>
  <div class="head">
    <div class="titles">
      ${brand.name ? `<div class="company">${esc(brand.name)}</div>` : ''}
      <h1 class="title">${esc(doc.title)}</h1>
      ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
    </div>
    <div class="brandbox">${mark}</div>
  </div>
  <div class="goldline"></div>
  <dl class="facts" style="grid-template-columns:repeat(${meta.length},minmax(0,1fr))">${meta
    .map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd><bdi dir="auto">${esc(v)}</bdi></dd></div>`)
    .join('')}</dl>
</header>
<main>
${doc.body}
</main>
<div class="endnote">${contact ? `<div class="contact">${contact}</div>` : ''}أُعدّ هذا التقرير آلياً من بيانات النظام${brand.name ? ` · ${esc(brand.name)}` : ''}</div>
</body>
</html>`;
}
