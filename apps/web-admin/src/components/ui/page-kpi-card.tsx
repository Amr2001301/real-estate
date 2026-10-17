import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Kept for API compatibility — no longer affects visual output. */
type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'teal' | 'red' | 'neutral';


export interface PageKpiCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  /** Kept for API compatibility — no longer affects background or icon color. */
  tone?: Tone;
  compact?: boolean;
}

export function PageKpiCard({ label, value, sub, icon, compact = false }: PageKpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[#D8B66A]/[0.28] bg-navy-band">

      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A9B0BD] leading-tight truncate">
            {label}
          </p>
          <p className={cn(
            'mt-1 num font-semibold text-[#F4ECD8]',
            compact ? 'text-xl leading-tight' : 'text-3xl leading-none',
          )}>
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] leading-tight text-[#A9B0BD]">{sub}</p>
          )}
        </div>

        {icon && (
          <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-400/50 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
