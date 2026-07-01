import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Kept for API compatibility — no longer affects visual output. */
type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'teal' | 'red' | 'neutral';

const GOLD_BAR = { background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' } as const;

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
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
      {/* Gold accent bar — same on every card */}
      <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />

      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-tight truncate">
            {label}
          </p>
          <p className={cn(
            'mt-1 font-bold tracking-tight tabular-nums text-slate-900',
            compact ? 'text-xl leading-tight' : 'text-3xl leading-none',
          )}>
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] leading-tight text-slate-400">{sub}</p>
          )}
        </div>

        {icon && (
          <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
