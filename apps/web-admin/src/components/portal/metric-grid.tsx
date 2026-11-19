import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A row of figure cards (the same light look as the KPI cards on the lists). */
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
    <div
      className={cn(
        'grid gap-4',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-2 md:grid-cols-3',
        cols === 4 && 'grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  /** Kept for API compatibility — the band shows every value in one colour. */
  variant: _variant = 'default',
  size = 'sm',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  variant?: 'default' | 'accent' | 'highlight';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="min-w-0 rounded-[22px] border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none">
      <p className="text-[13px] font-medium leading-snug text-slate-500">{label}</p>
      <p
        className={cn(
          'num mt-3 font-semibold leading-none text-slate-900',
          size === 'sm' && 'text-[22px]',
          size === 'md' && 'text-[30px]',
          size === 'lg' && 'text-[40px]',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2.5 text-[12px] text-slate-500">{sub}</p>}
    </div>
  );
}
