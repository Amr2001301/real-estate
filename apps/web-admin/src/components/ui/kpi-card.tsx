import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './card';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

const TONE_ICON: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  accent: 'bg-accent-50 text-accent-700 ring-accent-100',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  className?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
  delta,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      {icon && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset shrink-0',
              '[&_svg]:h-[18px] [&_svg]:w-[18px]',
              TONE_ICON[tone],
            )}
          >
            {icon}
          </div>
          {delta && <DeltaPill {...delta} />}
        </div>
      )}
      <p className="text-[13px] font-medium text-slate-500 leading-tight">
        {label}
      </p>
      <p className="mt-1.5 text-[28px] leading-none font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {sub && !delta && (
        <p className="mt-2 text-xs text-slate-500">{sub}</p>
      )}
      {sub && delta && !icon && (
        <p className="mt-2 text-xs text-slate-500">{sub}</p>
      )}
      {delta && !icon && (
        <div className="mt-2">
          <DeltaPill {...delta} />
        </div>
      )}
    </Card>
  );
}

function DeltaPill({ value, direction }: { value: string; direction: 'up' | 'down' | 'flat' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 h-5 text-2xs font-semibold',
        direction === 'up' && 'bg-success-50 text-success-700',
        direction === 'down' && 'bg-danger-50 text-danger-700',
        direction === 'flat' && 'bg-slate-100 text-slate-600',
      )}
    >
      <span aria-hidden className="text-[10px]">
        {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•'}
      </span>
      {value}
    </span>
  );
}
