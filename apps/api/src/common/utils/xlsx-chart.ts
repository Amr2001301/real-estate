/**
 * Server-side chart → PNG rendering for board/proposal reports (P15.2 foundation;
 * consumed by P15.4). Uses chart.js + @napi-rs/canvas (prebuilt binaries — no
 * native cairo/pango/system dependency) so it builds cleanly on macOS, CI, and
 * Docker.
 *
 * GRACEFUL FALLBACK CONTRACT: every renderer returns `Buffer | null` and NEVER
 * throws. The canvas binary, font availability, or chart.js can all fail at
 * runtime; on any failure we return `null` and the caller emits the report with
 * KPI/data tables only — the export still succeeds and the file is never broken.
 *
 * Deps are imported dynamically inside the try/catch so a missing/broken native
 * binding degrades to `null` instead of crashing module load.
 *
 * Presentation (one look for every report chart):
 *   • rendered at 2× the display size, so it stays sharp when Excel or a PDF
 *     scales it; callers embed it at `width × height`, so it is never stretched;
 *   • the bundled Noto Sans Arabic font (servers ship without Arabic fonts);
 *   • thin bars with rounded data ends, the value written on each bar, a
 *     recessive grid, muted axis text — no chart title (the report's section
 *     heading names the chart) and no legend (one series; the axis names it);
 *   • shares (part-to-whole) are a ranked horizontal bar labelled
 *     "count · percent", which reads better than a doughnut;
 *   • right-to-left like the report around it: the category labels and the
 *     value axis sit on the right, time runs from the right, bars grow leftwards.
 */
import { resolve } from 'path';
import type { ChartItem, Plugin } from 'chart.js';

export interface ChartPoint {
  /** Category label (x-axis). */
  label: string;
  /** Numeric value (y-axis). */
  value: number;
}

interface BarChartOptions {
  series: ChartPoint[];
  /** Display size in px (the PNG is 2× this). */
  width?: number;
  height?: number;
  /** Bar fill (#RRGGBB). Defaults to the brand navy. */
  color?: string;
  /** How a value is written on its bar (default: grouped, compact when large). */
  format?: (v: number) => string;
}

const NAVY = '#1E3348';
const INK_MUTED = '#64748B';
const INK = '#1E293B';
const GRID = '#E2E8F0';
const SCALE = 2;
const FONT_FAMILY = 'Noto Sans Arabic';
const FONT_PATH = resolve(__dirname, '../assets/fonts/NotoSansArabic.ttf');

let fontReady: Promise<void> | null = null;

/** Register the bundled Arabic font with the canvas once (best effort). */
function ensureFont(): Promise<void> {
  fontReady ??= import('@napi-rs/canvas')
    .then(({ GlobalFonts }) => {
      if (!GlobalFonts.has(FONT_FAMILY)) GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    })
    .catch(() => undefined);
  return fontReady;
}

/** 1,250 · 48.5K · 3.2M — short enough to sit on a bar. */
export function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (abs >= 100_000) return `${trim(v / 1_000)}K`;
  return Math.round(v).toLocaleString('en');
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** A white surface (chart.js clears to transparent, which renders black or shows the sheet grid). */
const whiteSurface: Plugin = {
  id: 'whiteSurface',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

/** Writes each non-zero value at the end of its bar. */
function valueLabels(labels: string[]): Plugin {
  return {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const horizontal = chart.options.indexAxis === 'y';
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = `600 12px "${FONT_FAMILY}"`;
      ctx.fillStyle = INK;
      meta.data.forEach((bar, i) => {
        const text = labels[i];
        if (!text) return;
        const { x, y } = bar.getProps(['x', 'y'], true) as { x: number; y: number };
        if (horizontal) {
          // RTL: bars grow leftwards, so the label sits past their left end.
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, x - 6, y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, x, y - 4);
        }
      });
      ctx.restore();
    },
  };
}

async function renderChartPng(opts: {
  labels: string[];
  values: number[];
  valueText: string[];
  horizontal: boolean;
  width: number;
  height: number;
  color: string;
}): Promise<Buffer | null> {
  try {
    await ensureFont();
    const { createCanvas } = await import('@napi-rs/canvas');
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    // Display size: chart.js scales the backing store by devicePixelRatio itself.
    const canvas = createCanvas(opts.width, opts.height);
    const ctx = canvas.getContext('2d');

    const max = Math.max(0, ...opts.values);
    const valueAxis = {
      // RTL: a horizontal chart's value axis runs right-to-left; a vertical one sits on the right.
      ...(opts.horizontal ? { reverse: true } : { position: 'right' as const }),
      beginAtZero: true,
      // Headroom so the value written above the tallest bar is not clipped.
      suggestedMax: max > 0 ? max * (opts.horizontal ? 1.25 : 1.15) : 1,
      grid: { display: !opts.horizontal, color: GRID, drawTicks: false },
      border: { display: false },
      // A ranked share chart carries its values on the bars: no value axis.
      ticks: opts.horizontal
        ? { display: false }
        : {
            precision: 0,
            color: INK_MUTED,
            padding: 6,
            callback: (v: number | string) => compactNumber(Number(v)),
          },
    };
    const categoryAxis = {
      ...(opts.horizontal ? { position: 'right' as const } : { reverse: true }),
      grid: { display: false },
      border: { color: GRID },
      ticks: { color: INK, padding: 6, font: { size: 12 } },
    };

    Chart.defaults.font.family = FONT_FAMILY;
    Chart.defaults.font.size = 11;
    // chart.js falls back to its Basic platform when no DOM/window exists, so a
    // static render (responsive off, animation off) draws straight to the canvas.
    const chart = new Chart(ctx as unknown as ChartItem, {
      type: 'bar',
      data: {
        labels: opts.labels,
        datasets: [
          {
            data: opts.values,
            backgroundColor: opts.color,
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: opts.horizontal ? 26 : 44,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        responsive: false,
        animation: false,
        devicePixelRatio: SCALE,
        layout: { padding: { top: 18, right: 14, bottom: 4, left: 16 } },
        plugins: {
          legend: { display: false },
          title: { display: false },
          tooltip: { enabled: false },
        },
        scales: opts.horizontal
          ? { x: valueAxis, y: categoryAxis }
          : { x: categoryAxis, y: valueAxis },
      },
      plugins: [whiteSurface, valueLabels(opts.valueText)],
    });
    const buf = canvas.toBuffer('image/png');
    chart.destroy();
    return Buffer.from(buf);
  } catch {
    return null; // graceful fallback — caller renders tables only
  }
}

/** Vertical bars (a trend or a comparison) → PNG, or `null` on any failure. */
export async function renderBarChartPng(opts: BarChartOptions): Promise<Buffer | null> {
  if (!opts.series.length) return null;
  const format = opts.format ?? compactNumber;
  return renderChartPng({
    labels: opts.series.map((p) => p.label),
    values: opts.series.map((p) => p.value),
    valueText: opts.series.map((p) => (p.value ? format(p.value) : '')),
    horizontal: false,
    width: opts.width ?? 800,
    height: opts.height ?? 360,
    color: opts.color ?? NAVY,
  });
}

/**
 * Shares of a whole (lead sources, payment types…) → a horizontal bar ranked
 * largest first, each labelled "value · percent". `null` on any failure.
 */
export async function renderShareChartPng(opts: BarChartOptions): Promise<Buffer | null> {
  const series = opts.series.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (!series.length) return null;
  const format = opts.format ?? compactNumber;
  const total = series.reduce((acc, p) => acc + p.value, 0);
  return renderChartPng({
    labels: series.map((p) => p.label),
    values: series.map((p) => p.value),
    valueText: series.map((p) => `${format(p.value)} · ${Math.round((p.value / total) * 100)}%`),
    horizontal: true,
    width: opts.width ?? 560,
    height: opts.height ?? Math.max(160, 48 + series.length * 40),
    color: opts.color ?? NAVY,
  });
}
