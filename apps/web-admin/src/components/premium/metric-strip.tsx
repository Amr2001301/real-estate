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

// Value text keeps semantic meaning — only the backgrounds become uniform.
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
  label:      string;
  value:      string | number;
  sub?:       string;
  icon?:      ReactNode;
  tone?:      Tone;
  /** Kept for API compatibility — no longer affects background. */
  primary?:   boolean;
  valueSize?: 'auto' | 'normal' | 'compact';
  trend?:     string;
  trendCls?:  string;
}

const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 sm:grid-cols-4',
};

const GOLD_BAR = { background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' } as const;

export interface PremiumMetricStripProps {
  metrics:    Metric[];
  cols?:      2 | 3 | 4 | 5 | 6 | 8;
  variant?:   'dashboard' | 'compact';
  className?: string;
}

export function PremiumMetricStrip({ metrics, cols, variant = 'dashboard', className }: PremiumMetricStripProps) {
  const effectiveCols = cols ?? (Math.min(metrics.length, 6) as 2 | 3 | 4 | 5 | 6 | 8);

  return (
    <div className={cn('grid gap-3', COLS[effectiveCols] ?? COLS[4], className)}>
      {metrics.map((m, i) => {
        const tone = m.tone ?? 'neutral';
        const isLongString =
          m.valueSize === 'compact' ||
          (m.valueSize !== 'normal' &&
            typeof m.value === 'string' &&
            m.value.length > 8);

        if (variant === 'compact') {
          return (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
              <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />
              <div className="flex items-center gap-4 px-5 py-4">
                {m.icon && (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-5 [&_svg]:w-5">
                    {m.icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold leading-snug text-slate-400 line-clamp-2">
                    {m.label}
                  </p>
                  <p className={cn(
                    'mt-1 font-black tabular-nums leading-none tracking-tight',
                    isLongString ? 'text-[18px]' : 'text-[22px]',
                    VALUE_TONE[tone],
                  )}>
                    {m.value}
                  </p>
                  {m.sub && (
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{m.sub}</p>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // dashboard variant
        return (
          <div key={i} className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
            <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />
            <div className="flex flex-col px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                {m.icon && (
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                    {m.icon}
                  </span>
                )}
                <p className="text-[11px] font-semibold leading-snug text-slate-400 line-clamp-2">
                  {m.label}
                </p>
              </div>
              <p className={cn(
                'mt-4 font-black tabular-nums leading-none tracking-tight',
                isLongString ? 'text-[20px]' : 'text-[26px]',
                VALUE_TONE[tone],
              )}>
                {m.value}
              </p>
              {m.sub && (
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{m.sub}</p>
              )}
              {m.trend && (
                <p className={cn('mt-auto pt-3 text-[10px] font-semibold leading-none', m.trendCls ?? 'text-slate-400')}>
                  {m.trend}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
