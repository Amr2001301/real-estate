import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FigureCards, type Figure } from '@/components/cockpit/cockpit';

type Tone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'teal';

export interface Metric {
  label:      string;
  value:      string | number;
  /** Small gold text after the value ("مليون ج.م", "وحدة"). Split from a string value when omitted. */
  unit?:      string;
  sub?:       string;
  icon?:      ReactNode;
  /** Kept for API compatibility: the band shows every value in one colour (U5). */
  tone?:      Tone;
  /** Kept for API compatibility — no longer affects the look. */
  primary?:   boolean;
  valueSize?: 'auto' | 'normal' | 'compact';
  trend?:     string;
  trendCls?:  string;
  /** 0–100: a thin gold progress ring beside the value (e.g. a rate). */
  ring?:      number;
}

/** One segment of the band's bottom distribution bar (e.g. sold / reserved / available). */
export interface MetricSegment {
  label: string;
  value: number;
  /** Bar colour (CSS colour). Use UNIT_STATUS_COLORS for unit statuses. */
  color: string;
}

/** One set of unit-status colours on the navy band (U5). */
export const UNIT_STATUS_COLORS = {
  sold:      '#F4ECD8',
  reserved:  '#C79A3B',
  available: '#5E7F6B',
} as const;

const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 sm:grid-cols-4',
};

export interface PremiumMetricStripProps {
  metrics:       Metric[];
  cols?:         2 | 3 | 4 | 5 | 6 | 8;
  /** "compact" = a shorter band for list pages; "dashboard" = taller cells. */
  variant?:      'dashboard' | 'compact';
  /** Optional segmented bar + legend across the bottom of the band. */
  distribution?: MetricSegment[];
  /** Formats a legend count (Western digits). */
  formatCount?:  (n: number) => string;
  className?:    string;
}

/**
 * Split "1.9م ج.م" → ["1.9", "م ج.م"], "35%" → ["35", "%"], "12" → ["12", ""].
 * Values that do not start with a number are shown whole.
 */
export function splitValue(value: string | number): [string, string] {
  if (typeof value === 'number') return [String(value), ''];
  const m = /^([-+]?[\d.,]+)\s*(.*)$/.exec(value.trim());
  return m ? [m[1]!, m[2]!] : [value, ''];
}

/**
 * Large figures read as a short number and a word: 4,850,000 ج.م →
 * ["4.85", "مليون ج.م"]; in English "4.85" + "M EGP". Below 100,000 the full
 * figure is kept. Used for string values the caller did not split itself.
 */
export function compactFigure(num: string, unit: string, arabic: boolean): [string, string] {
  const n = Number(num.replace(/,/g, ''));
  if (!Number.isFinite(n) || Math.abs(n) < 100_000) return [num, unit];
  const trim = (x: number) => String(Number(x.toFixed(2)));
  const scales: Array<[number, string, string]> = [
    [1e9, 'مليار', 'B'],
    [1e6, 'مليون', 'M'],
    [1e3, 'ألف', 'K'],
  ];
  const [div, ar, en] = scales.find(([d]) => Math.abs(n) >= d)!;
  return [trim(n / div), [arabic ? ar : en, unit].filter(Boolean).join(' ')];
}

/** "EGP 4,850,000" (English currency comes first) → ["4,850,000", "EGP"]. */
function splitAny(value: string | number): [string, string] {
  // Intl's Arabic currency output carries direction marks (U+200F) and a
  // no-break space; drop them or the figure never parses as a number.
  if (typeof value === 'string') value = value.replace(/[\u200e\u200f\u061c]/g, '').replace(/\u00a0/g, ' ').trim();
  const [num, unit] = splitValue(value);
  if (typeof value === 'number' || /^[-+]?[\d.,]+$/.test(num)) return [num, unit];
  const m = /^(\D+?)\s*([-+]?[\d.,]+)$/.exec(String(value).trim());
  return m ? [m[2]!, m[1]!] : [num, unit];
}

/** The trend's colour class → the figure card's tone. */
function trendTone(cls?: string): Figure['tone'] | undefined {
  if (!cls) return undefined;
  if (/success|emerald|green/.test(cls)) return 'green';
  if (/danger|red|rose/.test(cls)) return 'red';
  if (/warning|amber/.test(cls)) return 'amber';
  return undefined;
}

/** The unit-status colours were made for navy; on a light card they need a darker pair. */
const ON_LIGHT: Record<string, string> = {
  [UNIT_STATUS_COLORS.sold]: '#0B1220',
};

/**
 * The KPI row: the same light figure cards as every list page (the navy band
 * is retired). Each metric becomes a card — label, figure with its unit, a
 * plain line, and a status chip or a rate bar at the bottom. A distribution
 * (sold / reserved / available) sits under the cards as a segmented bar.
 */
export function PremiumMetricStrip({
  metrics,
  cols,
  distribution,
  formatCount = (n) => String(n),
  className,
}: PremiumMetricStripProps) {
  const effectiveCols = (cols !== undefined && metrics.length < cols && COLS[metrics.length] ? metrics.length : cols) ?? (Math.min(metrics.length, 6) as 2 | 3 | 4 | 5 | 6 | 8);
  const total = distribution?.reduce((a, s) => a + s.value, 0) ?? 0;
  const figures: Figure[] = metrics.map((m) => {
    const [num, autoUnit] = m.unit !== undefined
      ? [String(m.value), m.unit]
      : compactFigure(...splitAny(m.value), /[\u0600-\u06FF]/.test(m.label));
    const tone = trendTone(m.trendCls);
    return {
      label: m.label,
      value: num,
      unit: autoUnit || undefined,
      line: m.sub,
      sub: m.trend,
      tone: tone ?? 'gold',
      warn: tone === 'amber' || tone === 'red',
      icon: m.icon,
      bar: m.ring,
    };
  });

  return (
    <section data-testid="metric-strip" className={cn('flex flex-col gap-4', className)}>
      <FigureCards figures={figures} cols={Math.min(6, effectiveCols) as 4 | 5 | 6} />
      {distribution && distribution.length > 0 && (
        <div className="rounded-[22px] border border-hairline bg-surface px-6 py-5 shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none">
          <div className="flex h-2 gap-1" role="img" aria-label={distribution.map((s) => `${s.label} ${formatCount(s.value)}`).join('، ')}>
            {distribution.map((s) =>
              s.value > 0 ? (
                <span
                  key={s.label}
                  className="rounded-full"
                  style={{ flexGrow: s.value, flexBasis: 0, background: ON_LIGHT[s.color] ?? s.color }}
                />
              ) : null,
            )}
            {total === 0 && <span className="flex-1 rounded-full bg-slate-500/15" />}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-500">
            {distribution.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: ON_LIGHT[s.color] ?? s.color }} aria-hidden />
                <span>{s.label}</span>
                <span className="num text-[17px] font-semibold text-slate-900">{formatCount(s.value)}</span>
                {total > 0 && <span>· {Math.round((s.value / total) * 100)}%</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
