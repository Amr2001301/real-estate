import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

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

function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke="#D8B66A" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`}
      />
    </svg>
  );
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
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
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

/** Trend text on navy: green / red when the caller marked it so, otherwise muted. */
function trendColour(cls?: string): string {
  if (!cls) return 'text-[#A9B0BD]';
  if (/success|emerald|green/.test(cls)) return 'text-[#86C9A0]';
  if (/danger|red|rose/.test(cls)) return 'text-[#F09687]';
  if (/warning|amber/.test(cls)) return 'text-[#E8B96E]';
  return 'text-[#A9B0BD]';
}

/**
 * The navy KPI band (U5): one band divided by gold hairlines; each cell has a
 * thin gold icon in a gold ring, the value in Cormorant in one colour and its
 * unit in small gold text. Fixed in both themes.
 */
export function PremiumMetricStrip({
  metrics,
  cols,
  variant = 'dashboard',
  distribution,
  formatCount = (n) => String(n),
  className,
}: PremiumMetricStripProps) {
  const effectiveCols = cols ?? (Math.min(metrics.length, 6) as 2 | 3 | 4 | 5 | 6 | 8);
  const compact = variant === 'compact';
  const total = distribution?.reduce((a, s) => a + s.value, 0) ?? 0;

  return (
    <section
      data-testid="metric-strip"
      className={cn(
        'overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band text-[#F4ECD8]',
        'shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]',
        className,
      )}
    >
      <div className={cn('grid gap-px bg-[#D8B66A]/[0.16]', COLS[effectiveCols] ?? COLS[4])}>
        {metrics.map((m, i) => {
          const [num, autoUnit] = m.unit !== undefined
            ? [String(m.value), m.unit]
            : compactFigure(...splitAny(m.value), /[\u0600-\u06FF]/.test(m.label));
          const long = m.valueSize === 'compact' || (m.valueSize !== 'normal' && num.length > 7);
          // A name, not a figure (e.g. the top broker): smaller type, at most two lines.
          const isText = !/\d/.test(num) && num !== '—';
          return (
            <div
              key={i}
              className={cn('flex min-w-0 items-center gap-4 bg-navy-band', compact ? 'px-6 py-5' : 'px-6 py-6')}
            >
              {m.icon && (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D8B66A]/45 text-[#D8B66A] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.6]">
                  {m.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-[#A9B0BD] line-clamp-2">{m.label}</p>
                <div className="mt-1 flex items-center gap-3">
                <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
                  <span
                    className={cn(
                      isText
                        ? 'line-clamp-2 font-heading text-[19px] font-bold leading-snug text-[#F4ECD8]'
                        : 'num font-semibold text-[#F4ECD8]',
                      !isText && (long ? 'text-[30px]' : compact ? 'text-[38px]' : 'text-[44px]'),
                    )}
                    title={isText ? num : undefined}
                  >
                    {num}
                  </span>
                  {autoUnit && <span className="text-[13px] font-bold text-[#D8B66A]">{autoUnit}</span>}
                </p>
                {m.ring !== undefined && <Ring pct={m.ring} />}
                </div>
                {m.sub && <p className="mt-2 text-[12px] leading-snug text-[#A9B0BD]">{m.sub}</p>}
                {m.trend && (
                  <p className={cn('mt-1.5 text-[11.5px] font-bold leading-none', trendColour(m.trendCls))}>
                    {m.trend}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {distribution && distribution.length > 0 && (
        <div className="border-t border-[#D8B66A]/[0.16] px-6 py-5">
          <div className="flex h-2 gap-1" role="img" aria-label={distribution.map((s) => `${s.label} ${formatCount(s.value)}`).join('، ')}>
            {distribution.map((s) =>
              s.value > 0 ? (
                <span
                  key={s.label}
                  className="rounded-full"
                  style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
                />
              ) : null,
            )}
            {total === 0 && <span className="flex-1 rounded-full bg-white/10" />}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#A9B0BD]">
            {distribution.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                <span>{s.label}</span>
                <span className="num text-[17px] font-semibold text-[#F4ECD8]">{formatCount(s.value)}</span>
                {total > 0 && <span>· {Math.round((s.value / total) * 100)}%</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
