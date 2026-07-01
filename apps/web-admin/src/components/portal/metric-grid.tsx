import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function MetricGrid({
  cols = 4,
  className,
  children,
}: {
  cols?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(
      'grid gap-3',
      cols === 2 && 'grid-cols-2',
      cols === 3 && 'grid-cols-3',
      cols === 4 && 'grid-cols-2 md:grid-cols-4',
      className,
    )}>
      {children}
    </div>
  );
}

const GOLD_BAR = { background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' } as const;

export function MetricTile({
  label,
  value,
  sub,
  /** Kept for API compatibility — no longer affects background color. */
  variant = 'default',
  size = 'sm',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  variant?: 'default' | 'accent' | 'highlight';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
      <div className="h-[3px] w-full shrink-0" style={GOLD_BAR} />
      <div className="px-4 py-4">
        <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={cn(
          'mt-2 font-bold tabular-nums text-slate-900',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-3xl leading-none',
        )}>
          {value}
        </p>
        {sub && <p className="mt-1 text-2xs tabular-nums text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}
