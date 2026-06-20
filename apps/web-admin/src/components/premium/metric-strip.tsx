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

const ICON_TONE: Record<Tone, string> = {
  brand:   'bg-brand-50   ring-1 ring-brand-200/70   text-brand-600',
  success: 'bg-success-50 ring-1 ring-success-200/70 text-success-600',
  warning: 'bg-warning-50 ring-1 ring-warning-200/70 text-warning-600',
  danger:  'bg-danger-50  ring-1 ring-danger-200/70  text-danger-600',
  info:    'bg-info-50    ring-1 ring-info-200/70    text-info-600',
  neutral: 'bg-slate-50   ring-1 ring-slate-200/70   text-slate-500',
  purple:  'bg-purple-50  ring-1 ring-purple-200/70  text-purple-600',
  teal:    'bg-teal-50    ring-1 ring-teal-200/70    text-teal-600',
};

export interface Metric {
  label: string;
  value: string | number;
  /** Small supporting text rendered below the value */
  sub?: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Slightly features this tile — subtle warm tint + larger value size. */
  primary?: boolean;
  /**
   * Controls value font size.
   * - `'auto'` (default): numeric values use full size; string values longer than
   *   8 chars (e.g. formatted currency) automatically use compact sizing.
   * - `'normal'`: always full size.
   * - `'compact'`: always compact — use for long financial strings.
   */
  valueSize?: 'auto' | 'normal' | 'compact';
}

const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

export interface PremiumMetricStripProps {
  metrics: Metric[];
  /** Number of columns. Defaults to metrics.length capped at 6. */
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function PremiumMetricStrip({
  metrics,
  cols,
  className,
}: PremiumMetricStripProps) {
  const effectiveCols = cols ?? (Math.min(metrics.length, 6) as 2 | 3 | 4 | 5 | 6);

  return (
    <div
      className={cn(
        'grid gap-px bg-hairline rounded-[20px] overflow-hidden shadow-soft',
        COLS[effectiveCols] ?? COLS[4],
        className,
      )}
    >
      {metrics.map((m, i) => {
        const tone = m.tone ?? 'neutral';

        // Auto-detect: numeric values (counts) stay full size.
        // String values longer than 8 chars (formatted currency, etc.) go compact.
        const isCompact =
          m.valueSize === 'compact' ||
          (m.valueSize !== 'normal' &&
            typeof m.value === 'string' &&
            m.value.length > 8);

        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 px-5 py-5',
              m.primary ? 'bg-[#FEFAF3]' : 'bg-surface',
            )}
          >
            {/* Icon container — first in DOM = right in RTL */}
            {m.icon && (
              <span
                className={cn(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                  '[&_svg]:h-5 [&_svg]:w-5',
                  ICON_TONE[tone],
                )}
              >
                {m.icon}
              </span>
            )}

            {/* Text group: label → value → sub */}
            <div className="flex flex-col min-w-0 flex-1 gap-0.5 pt-0.5">
              <span className="text-[13px] font-bold text-navy/70 leading-snug truncate">
                {m.label}
              </span>

              <span
                className={cn(
                  'font-black text-navy tabular-nums leading-none mt-1 break-words',
                  isCompact
                    ? m.primary
                      ? 'text-[20px] sm:text-[23px]'
                      : 'text-[18px] sm:text-[21px]'
                    : m.primary
                      ? 'text-[28px] sm:text-[32px]'
                      : 'text-[24px] sm:text-[28px]',
                )}
              >
                {m.value}
              </span>

              {m.sub && (
                <span className="text-xs text-slate-400 leading-snug mt-0.5">
                  {m.sub}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
