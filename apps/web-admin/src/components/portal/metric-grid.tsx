import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────────────────────────
 * MetricGrid
 * Seamless tile grid for financial / KPI sections.
 * Uses gap-px + bg-hairline to create shared borders between tiles.
 *
 * cols=2  → grid-cols-2
 * cols=3  → grid-cols-3
 * cols=4  → grid-cols-2 md:grid-cols-4  (default, most common)
 * ──────────────────────────────────────────────────────────────────────────── */
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
        'grid gap-px bg-hairline rounded-xl overflow-hidden border border-hairline',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        cols === 4 && 'grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
 * MetricTile
 * A single tile inside MetricGrid.
 *
 * variant
 *   "default"   — white bg, slate-900 value
 *   "accent"    — brand-50/40 bg, brand-700 value  (percentages, rates)
 *   "highlight" — emerald-50/40 bg, emerald-700 value  (net / paid amounts)
 *
 * size
 *   "sm" (default) — text-sm   (compact calculation grids)
 *   "md"           — text-xl   (standard summary tiles)
 *   "lg"           — text-3xl  (featured / primary metric)
 * ──────────────────────────────────────────────────────────────────────────── */
export function MetricTile({
  label,
  value,
  sub,
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
    <div
      className={cn(
        'px-4 py-4',
        variant === 'default' && 'bg-white',
        variant === 'accent' && 'bg-brand-50/40',
        variant === 'highlight' && 'bg-emerald-50/40',
      )}
    >
      <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          'font-bold mt-2 tabular-nums',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-3xl leading-none',
          variant === 'default' && 'text-slate-900',
          variant === 'accent' && 'text-brand-700',
          variant === 'highlight' && 'text-emerald-700',
        )}
      >
        {value}
      </p>
      {sub && <p className="text-2xs text-slate-400 mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}
