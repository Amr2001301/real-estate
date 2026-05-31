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
 */
import type { ChartItem } from 'chart.js';

export interface ChartPoint {
  /** Category label (x-axis). */
  label: string;
  /** Numeric value (y-axis). */
  value: number;
}

interface BarChartOptions {
  series: ChartPoint[];
  title?: string;
  width?: number;
  height?: number;
  /** Bar fill (CSS color). Defaults to the brand navy. */
  color?: string;
}

const NAVY = '#1E3348';

async function renderChartPng(
  type: 'bar' | 'doughnut',
  labels: string[],
  values: number[],
  opts: { title?: string; width: number; height: number; colors: string | string[] },
): Promise<Buffer | null> {
  try {
    const { createCanvas } = await import('@napi-rs/canvas');
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    const canvas = createCanvas(opts.width, opts.height);
    const ctx = canvas.getContext('2d');
    // chart.js falls back to its Basic platform when no DOM/window exists, so a
    // static render (responsive off, animation off) draws straight to the canvas.
    const chart = new Chart(ctx as unknown as ChartItem, {
      type,
      data: { labels, datasets: [{ data: values, backgroundColor: opts.colors }] },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 1,
        plugins: {
          legend: { display: type === 'doughnut', position: 'right' },
          title: { display: Boolean(opts.title), text: opts.title ?? '' },
        },
        ...(type === 'bar'
          ? { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
          : {}),
      },
    });
    const buf = canvas.toBuffer('image/png');
    chart.destroy();
    return Buffer.from(buf);
  } catch {
    return null; // graceful fallback — caller renders tables only
  }
}

/** Vertical bar chart → PNG, or `null` on any rendering failure. */
export async function renderBarChartPng(opts: BarChartOptions): Promise<Buffer | null> {
  if (!opts.series.length) return null;
  return renderChartPng(
    'bar',
    opts.series.map((p) => p.label),
    opts.series.map((p) => p.value),
    {
      title: opts.title,
      width: opts.width ?? 800,
      height: opts.height ?? 360,
      colors: opts.color ?? NAVY,
    },
  );
}

const PIE_PALETTE = ['#1E3348', '#C99A2E', '#2F6F4F', '#7A5195', '#BC5090', '#64748B'];

/** Doughnut chart → PNG, or `null` on any rendering failure. */
export async function renderDoughnutChartPng(opts: BarChartOptions): Promise<Buffer | null> {
  if (!opts.series.length) return null;
  return renderChartPng(
    'doughnut',
    opts.series.map((p) => p.label),
    opts.series.map((p) => p.value),
    {
      title: opts.title,
      width: opts.width ?? 480,
      height: opts.height ?? 360,
      colors: opts.series.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]!),
    },
  );
}
