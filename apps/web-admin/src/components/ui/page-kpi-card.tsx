import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'teal' | 'red' | 'neutral';

const ACCENT_BAR: Record<Tone, string> = {
  brand:   'bg-brand-500',
  purple:  'bg-purple-500',
  teal:    'bg-teal-500',
  red:     'bg-danger-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
  info:    'bg-info-500',
  accent:  'bg-purple-500',
  neutral: 'bg-slate-300',
};

const ICON_BG: Record<Tone, string> = {
  brand:   'bg-brand-50 text-brand-600',
  purple:  'bg-purple-50 text-purple-600',
  teal:    'bg-teal-50 text-teal-600',
  red:     'bg-danger-50 text-danger-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  info:    'bg-info-50 text-info-600',
  accent:  'bg-purple-50 text-purple-600',
  neutral: 'bg-slate-100 text-slate-600',
};

export interface PageKpiCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Use for long values (currency, formatted numbers) in narrow grid columns. */
  compact?: boolean;
}

export function PageKpiCard({ label, value, sub, icon, tone = 'brand', compact = false }: PageKpiCardProps) {
  return (
    <div className="relative bg-surface rounded-2xl border border-hairline shadow-soft overflow-hidden transition-all duration-150 ease-smooth hover:shadow-card hover:border-brand-200">
      {/* RTL accent line — right/start side, clipped by overflow-hidden */}
      <div className={cn('absolute inset-y-0 start-0 w-[2px]', ACCENT_BAR[tone])} />

      <div className="ps-5 pe-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold text-slate-500 leading-tight uppercase tracking-widest truncate">
            {label}
          </p>
          <p className={cn(
            'mt-0.5 font-bold tracking-tight tabular-nums text-slate-900',
            compact ? 'text-xl leading-tight' : 'text-3xl leading-none',
          )}>
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] text-slate-400 leading-tight">{sub}</p>
          )}
        </div>

        {icon && (
          <div className={cn(
            'inline-flex items-center justify-center rounded-xl shrink-0 mt-0.5',
            'h-9 w-9 ring-1 ring-inset ring-black/5',
            '[&_svg]:h-[18px] [&_svg]:w-[18px]',
            ICON_BG[tone],
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
