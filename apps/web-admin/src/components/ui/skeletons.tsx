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

// ── Shared primitives for operation-page skeletons ──────────────────────────

/** Compact FilterBar skeleton — matches the single-row filter strip with no visible labels. */
export function FilterBarSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs px-3 py-2.5 flex flex-wrap items-center gap-2">
      {Array.from({ length: fields }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-36 rounded-lg" />
      ))}
      <Skeleton className="h-8 w-20 rounded-lg ms-auto" />
    </div>
  );
}

/** Section card (list of rows + optional footer form). Used for rules/entries panels. */
function SectionCardSkeleton({
  rows = 3,
  hasFooter = false,
  gridCols,
}: {
  rows?: number;
  hasFooter?: boolean;
  gridCols?: number;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-14" />
      </div>
      {gridCols ? (
        <div
          className="px-5 pt-4 pb-3 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="rounded-xl border border-hairline overflow-hidden flex">
              <div className="w-1 bg-slate-200 shrink-0" />
              <div className="flex-1 px-4 py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-8 w-16 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasFooter && (
        <div className="border-t border-hairline bg-surface-muted/40 px-5 py-4 space-y-2.5">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 flex-1 min-w-[160px] rounded-xl" />
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page-specific skeletons ─────────────────────────────────────────────────

/** Full skeleton for /dashboard/maintenance — matches exact section order and card layout. */
export function MaintenancePageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-[420px] max-w-full" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBarSkeleton fields={4} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
            <div className="absolute inset-y-0 start-0 w-0.5 bg-slate-200" />
            <div className="ps-5 pe-4 py-3 flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Analytics panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCardSkeleton rows={5} />
        <SectionCardSkeleton rows={5} />
      </div>

      {/* Requests table */}
      <TableCardSkeleton cols={9} rows={6} />

      {/* Category management */}
      <SectionCardSkeleton rows={3} hasFooter gridCols={3} />
    </div>
  );
}

/** Full skeleton for /dashboard/bonus — matches KPI cards, filter, manual entry, rules, entries table. */
export function BonusPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-[480px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl shrink-0" />
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
            <div className="absolute inset-y-0 start-0 w-0.5 bg-slate-200" />
            <div className="ps-5 pe-4 py-3 flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <FilterBarSkeleton fields={3} />

      {/* Manual entry card — labeled field pairs */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            {(['w-48', 'w-40', 'w-32', 'w-40'] as const).map((w, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className={cn('h-8 rounded-xl', w)} />
              </div>
            ))}
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Commission rules card — banner + rows + labeled add-rule footer */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
        {/* Compact status banner */}
        <div className="mx-5 mt-3">
          <Skeleton className="h-7 w-full rounded-lg" />
        </div>
        {/* Rules rows */}
        <div className="px-5 py-2 divide-y divide-hairline">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-5 w-10 rounded-md" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex gap-2 shrink-0">
                <Skeleton className="h-7 w-14 rounded-xl" />
                <Skeleton className="h-7 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        {/* Add rule footer — unlabeled inline inputs */}
        <div className="border-t border-hairline bg-surface-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 flex-1 min-w-[160px] rounded-xl" />
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-52 mt-2" />
        </div>
      </div>

      {/* Entries table */}
      <TableCardSkeleton cols={8} rows={5} />
    </div>
  );
}

/** Full skeleton for /dashboard/targets — matches filter, KPI cards, form, insights, table. */
export function TargetsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>
      </header>

      {/* Filter bar */}
      <FilterBarSkeleton fields={2} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
            <div className="absolute inset-y-0 start-0 w-0.5 bg-slate-200" />
            <div className="ps-5 pe-4 py-3 flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Add/edit target form card */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="px-5 py-3.5">
          <div className="flex flex-wrap items-end gap-3">
            {(['w-44', 'w-40', 'w-36', 'w-28'] as const).map((w, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className={cn('h-8 rounded-xl', w)} />
              </div>
            ))}
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-80 mt-2" />
        </div>
      </div>

      {/* Performance insights strip */}
      <div className="rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
        <Skeleton className="w-px h-4 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
      </div>

      {/* Targets performance table */}
      <TableCardSkeleton cols={8} rows={5} />
    </div>
  );
}
