/**
 * Inline SVG charts for HTML reports (printed by Chromium — vector, sharp at
 * any zoom, Arabic shaped by the browser). Pure functions: data in, markup out.
 *
 * Coordinates are LTR (the root sets direction="ltr" so `text-anchor` means
 * the same inside an RTL page); the layout is drawn right-to-left by hand.
 *
 * One look, matching the report: right-to-left (categories start on the right,
 * the value axis sits on the right, share bars grow leftwards), thin bars with
 * rounded data ends, the value written on each bar, a recessive grid, no
 * legend (single series — the section heading names the chart).
 */

export interface SvgPoint {
  label: string;
  value: number;
}

const INK = '#0f172a';
const MUTED = '#64748b';
const GRID = '#e2e8f0';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A colour safe to put in an attribute (#RRGGBB only). */
function safeColor(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

/** 950 · 12,500 · 950K · 18.5M */
export function compact(v: number): string {
  const abs = Math.abs(v);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (abs >= 100_000) return `${trim(v / 1_000)}K`;
  return Math.round(v).toLocaleString('en');
}

/** A round axis maximum and its tick step (1-2-5 steps, ~4 intervals). */
export function niceScale(max: number): { max: number; step: number } {
  if (max <= 0) return { max: 4, step: 1 };
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const niceStep = Math.max(step, max < 4 ? 1 : step);
  return { max: Math.ceil(max / niceStep) * niceStep, step: niceStep };
}

/** A bar with only its data end rounded (r px), from the baseline. */
function bar(x: number, y: number, w: number, h: number, r: number, end: 'top' | 'left'): string {
  if (h <= 0 || w <= 0) return '';
  if (end === 'top') {
    const rr = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  }
  const rr = Math.min(r, h / 2, w);
  return `M${x + w},${y}H${x + rr}Q${x},${y} ${x},${y + rr}V${y + h - rr}Q${x},${y + h} ${x + rr},${y + h}H${x + w}Z`;
}

/** Vertical bars — a trend or a comparison. Right-to-left. */
export function barChartSvg(opts: {
  series: SvgPoint[];
  width?: number;
  height?: number;
  color?: string;
  format?: (v: number) => string;
}): string {
  const W = opts.width ?? 520;
  const H = opts.height ?? 240;
  const color = safeColor(opts.color, '#1e3348');
  const format = opts.format ?? compact;
  const n = opts.series.length;
  if (!n) return '';

  const axisW = 44; // value labels on the right
  const top = 22;
  const bottom = 28;
  const plotW = W - axisW - 8;
  const plotH = H - top - bottom;
  // ~10% headroom so the value written above the tallest bar fits.
  const { max, step } = niceScale(Math.max(0, ...opts.series.map((p) => p.value)) * 1.1);
  const y = (v: number) => top + plotH - (v / max) * plotH;

  const grid: string[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    const gy = y(v).toFixed(1);
    grid.push(
      `<line x1="8" x2="${8 + plotW}" y1="${gy}" y2="${gy}" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${W - 4}" y="${gy}" dy="0.35em" text-anchor="end" font-size="10" fill="${MUTED}" direction="ltr">${esc(compact(v))}</text>`,
    );
  }

  const band = plotW / n;
  const bw = Math.min(40, band * 0.56);
  const marks = opts.series.map((p, i) => {
    // RTL: the first category sits at the right edge.
    const cx = 8 + plotW - band * (i + 0.5);
    const h = (Math.max(0, p.value) / max) * plotH;
    const by = top + plotH - h;
    const value = p.value
      ? `<text x="${cx.toFixed(1)}" y="${(by - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${INK}" direction="ltr">${esc(format(p.value))}</text>`
      : '';
    return `<path d="${bar(cx - bw / 2, by, bw, h, 4, 'top')}" fill="${color}"/>${value}
<text x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10.5" fill="${INK}">${esc(p.label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto" direction="ltr" role="img">
${grid.join('\n')}
<line x1="8" x2="${8 + plotW}" y1="${top + plotH}" y2="${top + plotH}" stroke="#cbd5e1" stroke-width="1"/>
${marks.join('\n')}
</svg>`;
}

/**
 * Shares of a whole — a horizontal bar ranked largest first, each labelled
 * "value · percent". Zero rows are dropped. Right-to-left.
 */
export function shareChartSvg(opts: {
  series: SvgPoint[];
  width?: number;
  color?: string;
  format?: (v: number) => string;
  /** Most rows shown; the rest fold into «أخرى». */
  limit?: number;
}): string {
  const color = safeColor(opts.color, '#1e3348');
  const format = opts.format ?? compact;
  const sorted = opts.series.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (!sorted.length) return '';
  const limit = opts.limit ?? 8;
  const rows =
    sorted.length > limit
      ? [
          ...sorted.slice(0, limit - 1),
          { label: 'أخرى', value: sorted.slice(limit - 1).reduce((a, p) => a + p.value, 0) },
        ]
      : sorted;
  const total = rows.reduce((a, p) => a + p.value, 0);
  const max = rows[0]!.value;

  const W = opts.width ?? 520;
  const rowH = 30;
  const H = rows.length * rowH + 8;
  const labelW = Math.min(150, W * 0.3);
  const valueW = 92; // room for "12.5M · 61%" past the longest bar
  const barRight = W - labelW - 10;
  const barMax = barRight - valueW;

  const marks = rows.map((p, i) => {
    const cy = 4 + i * rowH + rowH / 2;
    const w = Math.max(2, (p.value / max) * barMax);
    const x = barRight - w;
    const pct = Math.round((p.value / total) * 100);
    return `<text x="${W - 2}" y="${cy}" dy="0.35em" text-anchor="end" font-size="11" fill="${INK}">${esc(p.label)}</text>
<path d="${bar(x, cy - 8, w, 16, 4, 'left')}" fill="${color}"/>
<text x="${(x - 6).toFixed(1)}" y="${cy}" dy="0.35em" text-anchor="end" font-size="10.5" font-weight="600" fill="${INK}" direction="ltr">${esc(`${format(p.value)} · ${pct}%`)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto" direction="ltr" role="img">
<line x1="${barRight}" x2="${barRight}" y1="0" y2="${H}" stroke="#cbd5e1" stroke-width="1"/>
${marks.join('\n')}
</svg>`;
}
