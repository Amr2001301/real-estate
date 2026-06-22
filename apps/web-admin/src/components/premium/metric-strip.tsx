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

// Icon container — semantic color signals metric health
const ICON_TONE: Record<Tone, string> = {
  brand:   'bg-brand-100  text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-amber-50   text-amber-600',
  danger:  'bg-danger-50  text-danger-500',
  info:    'bg-info-50    text-info-600',
  neutral: 'bg-slate-100  text-slate-500',
  purple:  'bg-purple-50  text-purple-600',
  teal:    'bg-teal-50    text-teal-600',
};

// Value text — same semantic signal as the icon
const VALUE_TONE: Record<Tone, string> = {
  brand:   'text-brand-700',
  success: 'text-success-700',
  warning: 'text-amber-700',
  danger:  'text-danger-700',
  info:    'text-info-700',
  neutral: 'text-slate-900',
  purple:  'text-purple-700',
  teal:    'text-teal-700',
};

export interface Metric {
  label:     string;
  value:     string | number;
  /** Single focused context line rendered below the value */
  sub?:      string;
  icon?:     ReactNode;
  tone?:     Tone;
  /** Slightly features this tile: warm gold tint + larger value */
  primary?:  boolean;
  /**
   * Controls value font size.
   * - `'auto'` (default): string values longer than 8 chars auto-compact.
   * - `'normal'`: always full size.
   * - `'compact'`: always compact — use for long financial strings.
   */
  valueSize?: 'auto' | 'normal' | 'compact';
  /** Optional trend line (e.g. "↑12% عن الشهر الماضي"). Only rendered when provided. */
  trend?:    string;
  trendCls?: string;
}

// Responsive column classes — 8 maps to 4-wide desktop (balanced 2×4 for 8-item grids)
const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 sm:grid-cols-4',
};

export interface PremiumMetricStripProps {
  metrics:    Metric[];
  /** Desktop column count. Defaults to metrics.length capped at 6. Use 4 for 8-item grids. */
  cols?:      2 | 3 | 4 | 5 | 6 | 8;
  /**
   * `'dashboard'` (default) — rich KPI card ~124px, with prominent icon and optional trend.
   * `'compact'` — tight page-summary card ~88px, horizontal layout. Use on list pages.
   */
  variant?:   'dashboard' | 'compact';
  className?: string;
}

export function PremiumMetricStrip({ metrics, cols, variant = 'dashboard', className }: PremiumMetricStripProps) {
  const effectiveCols = cols ?? (Math.min(metrics.length, 6) as 2 | 3 | 4 | 5 | 6 | 8);

  return (
    <div className={cn(
      'grid gap-px bg-hairline rounded-[20px] overflow-hidden shadow-soft',
      COLS[effectiveCols] ?? COLS[4],
      className,
    )}>
      {metrics.map((m, i) => {
        const tone = m.tone ?? 'neutral';

        // Auto-compact: numeric values stay full size; strings > 8 chars (currency) go compact
        const isLongString =
          m.valueSize === 'compact' ||
          (m.valueSize !== 'normal' &&
            typeof m.value === 'string' &&
            m.value.length > 8);

        if (variant === 'compact') {
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-4 px-5 py-4 min-h-[88px]',
                m.primary ? 'bg-brand-50/40' : 'bg-surface',
              )}
            >
              {/* Icon — rounded-square badge, first DOM child = RIGHT in RTL */}
              {m.icon && (
                <span className={cn(
                  'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5',
                  ICON_TONE[tone],
                )}>
                  {m.icon}
                </span>
              )}

              {/* Text group — label above value, sits to LEFT of icon in RTL */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 leading-snug line-clamp-2">
                  {m.label}
                </p>
                <p className={cn(
                  'mt-1.5 font-black tabular-nums leading-none tracking-tight',
                  isLongString ? 'text-[18px]' : 'text-[24px]',
                  VALUE_TONE[tone],
                )}>
                  {m.value}
                </p>
                {m.sub && (
                  <p className="mt-1 text-[10px] text-slate-400 leading-snug">{m.sub}</p>
                )}
              </div>
            </div>
          );
        }

        // ── dashboard variant (default) ──────────────────────────────────────
        return (
          <div
            key={i}
            className={cn(
              'flex flex-col px-5 py-5 min-h-[124px]',
              m.primary ? 'bg-brand-50/40' : 'bg-surface',
            )}
          >
            {/* ① icon (RIGHT in RTL, first DOM child) + label */}
            <div className="flex items-start justify-between gap-2">
              {m.icon && (
                <span className={cn(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px]',
                  ICON_TONE[tone],
                )}>
                  {m.icon}
                </span>
              )}
              <p className="text-[11px] font-semibold text-slate-400 text-end leading-snug line-clamp-2">
                {m.label}
              </p>
            </div>

            {/* ② hero value */}
            <p className={cn(
              'mt-3 font-black tabular-nums leading-none tracking-tight',
              isLongString
                ? m.primary ? 'text-[22px]' : 'text-[20px]'
                : m.primary ? 'text-[28px]' : 'text-[26px]',
              VALUE_TONE[tone],
            )}>
              {m.value}
            </p>

            {/* ③ sub */}
            {m.sub && (
              <p className="mt-2 text-[11px] text-slate-400 leading-snug">{m.sub}</p>
            )}

            {/* ④ trend — only rendered when data exists, no dead placeholder */}
            {m.trend && (
              <p className={cn('mt-auto pt-2 text-[10px] font-semibold leading-none', m.trendCls ?? 'text-slate-400')}>
                {m.trend}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
