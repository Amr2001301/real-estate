import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'teal' | 'red' | 'neutral';

// Top accent bar color for each tone variant
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

// Icon container: background and text color for each tone variant
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
}

export function PageKpiCard({ label, value, sub, icon, tone = 'brand' }: PageKpiCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-soft overflow-hidden transition-all duration-150 ease-smooth hover:shadow-card hover:border-brand-200">
      {/* Accent bar at the top */}
      <div className={cn('h-1 w-full', ACCENT_BAR[tone])} />
      
      {/* Card content */}
      <div className="px-4 py-4 flex items-start gap-3">
        {icon && (
          <div className={cn(
            'inline-flex items-center justify-center rounded-lg shrink-0 flex-none',
            'h-9 w-9 ring-1 ring-inset ring-black/5',
            '[&_svg]:h-5 [&_svg]:w-5',
            ICON_BG[tone],
          )}>
            {icon}
          </div>
        )}
        
        {/* Text content */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 leading-tight uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-1 text-xl leading-tight font-bold tracking-tight tabular-nums text-slate-900 truncate">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
