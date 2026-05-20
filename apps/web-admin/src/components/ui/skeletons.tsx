// Tiny skeleton primitives used by `loading.tsx` segments in app/.
// Style follows the same tokens as the rest of the dashboard:
//   * `bg-surface` + `border-hairline` + `rounded-2xl` + `shadow-xs` for cards
//   * `animate-pulse` shimmer (built-in Tailwind; no extra deps, GPU-friendly)
// Layouts are symmetrical so they work in both RTL and LTR.

import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

/** Base block. Use for any rectangular placeholder. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-slate-200/70', className)}
    />
  );
}

/** Page title + description placeholder. Mirrors the look of PageHeader. */
export function PageHeaderSkeleton() {
  return (
    <header className="mb-8 space-y-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
    </header>
  );
}

/** Row of N KPI card placeholders. Matches PageKpiCard footprint. */
export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-3"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Table card placeholder. `cols`/`rows` are visual only — no data is rendered. */
export function TableCardSkeleton({
  cols = 5,
  rows = 8,
  title = true,
}: {
  cols?: number;
  rows?: number;
  title?: boolean;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      )}
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div
          className="grid gap-3 px-2 pb-3 border-b border-hairline"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-3 w-20" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-3 px-2 py-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={`r-${r}-${c}`} className="h-4 w-full max-w-[160px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two side-by-side card placeholders (e.g. chart + side panel). */
export function ChartsRowSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 mb-8">
      <div className="lg:col-span-2 bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

/** Generic list-page composition: header + KPIs + table. Used by most segments. */
export function ListPageSkeleton({
  kpis = 4,
  cols = 5,
  rows = 8,
}: {
  kpis?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiCardsSkeleton count={kpis} />
      <TableCardSkeleton cols={cols} rows={rows} />
    </div>
  );
}
