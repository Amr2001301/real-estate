import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

const BAR: Record<Tone, string> = {
  brand:   'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-amber-400',
  danger:  'bg-danger-500',
  info:    'bg-info-500',
  accent:  'bg-purple-500',
  neutral: 'bg-slate-300',
};

const ICON_CLS: Record<Tone, string> = {
  brand:   'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-amber-50 text-amber-600',
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
}

export function PageKpiCard({ label, value, sub, icon, tone = 'brand' }: PageKpiCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-soft overflow-hidden">
      <div className={cn('h-0.5', BAR[tone])} />
      <div className="px-4 py-4 flex items-start gap-3">
        {icon && (
          <div className={cn(
            'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg',
            'ring-1 ring-inset ring-black/5 shrink-0 [&_svg]:h-4 [&_svg]:w-4',
            ICON_CLS[tone],
          )}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400 leading-tight uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight tabular-nums text-slate-900 truncate">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
