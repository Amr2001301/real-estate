import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './card';

/** Kept for API compatibility — no longer affects icon or card background. */
type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';


export interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  className?: string;
}

export function KpiCard({ label, value, sub, icon, delta, className }: KpiCardProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[18px] border border-[#D8B66A]/[0.28] bg-navy-band', className)}>

      <div className="px-5 py-4">
        {icon && (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-400/50 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {icon}
            </div>
            {delta && <DeltaPill {...delta} />}
          </div>
        )}
        <p className="text-[13px] font-medium leading-tight text-[#A9B0BD]">{label}</p>
        <p className="mt-1.5 text-[28px] num font-semibold leading-none text-[#F4ECD8]">
          {value}
        </p>
        {sub && (
          <p className="mt-2 text-xs text-[#A9B0BD]">{sub}</p>
        )}
        {delta && !icon && (
          <div className="mt-2">
            <DeltaPill {...delta} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ value, direction }: { value: string; direction: 'up' | 'down' | 'flat' }) {
  return (
    <span className={cn(
      'inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-2xs font-semibold',
      direction === 'up'   && 'bg-success-50 text-success-700',
      direction === 'down' && 'bg-danger-50 text-danger-700',
      direction === 'flat' && 'bg-slate-100 text-slate-600',
    )}>
      <span aria-hidden className="text-[10px]">
        {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•'}
      </span>
      {value}
    </span>
  );
}
