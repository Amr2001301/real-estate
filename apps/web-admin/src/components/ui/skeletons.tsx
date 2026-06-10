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

// ── Broker section skeletons ────────────────────────────────────────────────

/** Full skeleton for /dashboard/brokers — header + KPI cards + insight strip + filter + table. */
export function BrokersPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-[440px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl shrink-0" />
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
                <Skeleton className="h-8 w-10" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Insight strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
        {[28, 36, 40, 20].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
            <Skeleton className={`h-3 w-${w === 28 ? '24' : w === 36 ? '28' : w === 40 ? '32' : '10'}`} />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <FilterBarSkeleton fields={3} />

      {/* Table — 8 cols (company+code merged, status, city, employees, projects, units, date, actions) */}
      <TableCardSkeleton cols={8} rows={7} />
    </div>
  );
}

/**
 * Generic broker list-page skeleton (leads / reservations / contracts /
 * commissions / payouts) — compact header + filter + table.
 */
export function BrokerListPageSkeleton({
  cols = 8,
  filterFields = 4,
  hasAction = false,
}: {
  cols?: number;
  filterFields?: number;
  hasAction?: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-60" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-[420px] max-w-full" />
          </div>
          {hasAction && <Skeleton className="h-10 w-44 rounded-xl shrink-0" />}
        </div>
      </header>

      {/* Filter bar */}
      <FilterBarSkeleton fields={filterFields} />

      {/* Table */}
      <TableCardSkeleton cols={cols} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-leads — header + status summary strip + filter + table. */
export function BrokerLeadsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-[400px] max-w-full" />
        </div>
      </header>

      {/* Status summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        {/* Total — larger prominent number */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <Skeleton className="h-6 w-8" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="w-px h-5" />
        {/* Status pill chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={`h-6 rounded-full ${['w-28', 'w-24', 'w-16', 'w-16'][i]}`} />
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBarSkeleton fields={5} />

      {/* Table — 8 cols (client, broker, project, review, stage, sales, date, action) */}
      <TableCardSkeleton cols={8} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-reservations — header + action + summary strip + filter + table. */
export function BrokerReservationsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header with primary action */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-72" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-[440px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-52 rounded-xl shrink-0" />
        </div>
      </header>

      {/* Status summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        {/* Total */}
        <div className="flex items-baseline gap-1.5 shrink-0">
          <Skeleton className="h-6 w-8" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="w-px h-5" />
        {/* Status pill chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['w-28', 'w-24', 'w-32'] as const).map((w, i) => (
            <Skeleton key={i} className={`h-6 rounded-full ${w}`} />
          ))}
        </div>
        <Skeleton className="w-px h-5 hidden sm:block" />
        {/* Commission total */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Filter bar — 4 selects */}
      <FilterBarSkeleton fields={4} />

      {/* Table — 9 cols (number, broker, client, unit, status, sales, commission, date, action) */}
      <TableCardSkeleton cols={9} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-contracts — header + action + summary strip + filter + table. */
export function BrokerContractsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header with primary action */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-72" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-[440px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-56 rounded-xl shrink-0" />
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <Skeleton className="h-6 w-8" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="w-px h-5" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 rounded-full w-20" />
          <Skeleton className="h-6 rounded-full w-28" />
        </div>
        <Skeleton className="w-px h-5 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="w-px h-5 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Filter bar — 4 selects + 2 date inputs */}
      <FilterBarSkeleton fields={6} />

      {/* Table — 10 cols (number, broker, client, unit, value, status, sales, commission, date, action) */}
      <TableCardSkeleton cols={10} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-commissions — header + summary strip + filter + table. */
export function BrokerCommissionsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header — no action button */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-[480px] max-w-full" />
        </div>
      </header>

      {/* Summary strip — total + status chips + financial totals */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <Skeleton className="h-6 w-8" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <Skeleton className="w-px h-5" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 rounded-full w-28" />
          <Skeleton className="h-6 rounded-full w-24" />
        </div>
        <Skeleton className="w-px h-5 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Filter bar — 3 selects + 2 date inputs */}
      <FilterBarSkeleton fields={5} />

      {/* Table — 11 cols (number, broker, contract, unit/project, basis, %, gross, net, status, date, action) */}
      <TableCardSkeleton cols={11} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-payouts — header + action + summary strip + filter + table. */
export function BrokerPayoutsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header with primary action */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-64" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-[400px] max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl shrink-0" />
        </div>
      </header>

      {/* Summary strip — total + status chips + financial totals */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <Skeleton className="h-6 w-8" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="w-px h-5" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 rounded-full w-20" />
          <Skeleton className="h-6 rounded-full w-24" />
          <Skeleton className="h-6 rounded-full w-20" />
        </div>
        <Skeleton className="w-px h-5 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Filter bar — 2 selects + period input + 2 date inputs */}
      <FilterBarSkeleton fields={5} />

      {/* Table — 9 cols (number, broker, period, gross, net, status, created, paid, action) */}
      <TableCardSkeleton cols={9} rows={8} />
    </div>
  );
}

/** Full skeleton for /dashboard/broker-reports — premium enterprise redesign. */
export function BrokerReportsPageSkeleton() {
  return (
    <div className="space-y-5">

      {/* Header — title + description + 2 export buttons */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-[440px] max-w-full" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
        </div>
      </header>

      {/* Report control bar — 5 fields */}
      <FilterBarSkeleton fields={5} />

      {/* Executive financial overview — hero card + 3 secondary cards in row */}
      {/* Hero sales card */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="h-0.5 bg-slate-200 w-full" />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-8 gap-y-3">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-11 w-72 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1 items-center">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary financial cards — 3-column row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-4 flex items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          </div>
        ))}
      </div>

      {/* Pipeline summary row — 3 volume tiles */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-3.5 flex items-center gap-3.5">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Section label + Conversion Journey card */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
          <Skeleton className="h-3.5 w-24" />
          <div className="flex-1 h-px bg-hairline" />
        </div>
        <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Stepper pane */}
            <div className="flex-1 px-6 py-5 space-y-3.5">
              <Skeleton className="h-3.5 w-32" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5 pb-1">
                    <div className="flex justify-between gap-3">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-4.5 w-8 shrink-0" />
                    </div>
                    {i > 0 && (
                      <div className="flex items-center gap-2">
                        <Skeleton className="flex-1 h-1.5 rounded-full" />
                        <Skeleton className="h-3 w-10 shrink-0" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Divider */}
            <div className="h-px bg-hairline lg:h-auto lg:w-px shrink-0" aria-hidden />
            {/* Ratios pane */}
            <div className="lg:w-72 shrink-0 px-6 py-5">
              <Skeleton className="h-3.5 w-36 mb-3" />
              <div className="divide-y divide-hairline">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                    <Skeleton className="h-8 w-14 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial realization — Card with header */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded shrink-0" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface px-5 py-5 space-y-2">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Top brokers ranking — 9 cols */}
      <TableCardSkeleton cols={9} rows={5} />

      {/* Project performance — 8 cols */}
      <TableCardSkeleton cols={8} rows={4} />

    </div>
  );
}

// ── Administration section skeletons ────────────────────────────────────────

/**
 * Reusable admin table-page skeleton.
 * Used by: /dashboard/documents, /dashboard/users, /dashboard/audit-logs.
 * Structure: page header · optional action · filter bar · table.
 */
export function AdminTablePageSkeleton({
  cols = 7,
  filterFields = 4,
  rows = 8,
  hasAction = false,
}: {
  cols?: number;
  filterFields?: number;
  rows?: number;
  hasAction?: boolean;
}) {
  return (
    <div className="space-y-5">
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-[420px] max-w-full" />
          </div>
          {hasAction && <Skeleton className="h-10 w-44 rounded-xl shrink-0" />}
        </div>
      </header>

      <FilterBarSkeleton fields={filterFields} />

      <TableCardSkeleton cols={cols} rows={rows} />
    </div>
  );
}

/**
 * Reusable admin cards/content-page skeleton.
 * Used by: /dashboard/operations (hasKpiRow=true), /dashboard/permissions (hasSidePanel=true).
 * Structure varies by props — see usage comments.
 */
export function AdminCardsPageSkeleton({
  hasKpiRow = false,
  hasSidePanel = false,
  sectionCount = 3,
  infoBanner = false,
}: {
  hasKpiRow?: boolean;
  hasSidePanel?: boolean;
  sectionCount?: number;
  infoBanner?: boolean;
}) {
  return (
    <div className="space-y-5">
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-[440px] max-w-full" />
        </div>
      </header>

      {infoBanner && <Skeleton className="h-12 w-full rounded-2xl" />}

      {hasKpiRow && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
              <div className="absolute inset-y-0 start-0 w-0.5 bg-slate-200" />
              <div className="ps-5 pe-4 py-3.5 space-y-2">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {hasSidePanel ? (
        /* Permissions-style: search + grouped cards (2/3) + user panel (1/3) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-hairline bg-surface p-3 shadow-xs flex items-center gap-2">
              <Skeleton className="h-8 flex-1 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
            </div>
            {Array.from({ length: sectionCount }).map((_, i) => (
              <div key={i} className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-2.5 border-b border-hairline bg-surface-muted/40 flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <div className="divide-y divide-hairline">
                  {Array.from({ length: i === 0 ? 4 : 3 }).map((_, j) => (
                    <div key={j} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-14 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-48 max-w-full" />
                        <Skeleton className="h-2.5 w-32" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-surface border border-hairline rounded-2xl shadow-xs p-5 self-start space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-44" />
            <div className="divide-y divide-hairline">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="h-7 w-14 rounded-xl shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Operations-style: activity + quick-links row, then 2-col analysis */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-20 rounded-xl" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-2.5 flex items-start justify-between gap-3 border-b border-hairline last:border-0">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-7 w-14 rounded-xl shrink-0" />
                </div>
              ))}
            </div>
            <div className="bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-surface border border-hairline rounded-2xl shadow-xs p-5 space-y-3">
                <Skeleton className="h-4 w-40" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Full page skeleton for /dashboard/cms.
 * Matches the compact redesign:
 *   page header · summary strip · 3 section cards (header-as-toggle + compact empty/table).
 * Forms are collapsed by default so only the section header rows are shown.
 */
export function AdminCmsPageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-[400px] max-w-full" />
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-3.5 w-3.5 rounded shrink-0" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-5" />
          </div>
        ))}
      </div>

      {/* Pages card — clickable header row (collapsed) + compact empty placeholder */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-20 hidden sm:block" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
        {/* Compact empty state placeholder */}
        <div className="flex flex-col items-center gap-2 py-8">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      {/* Banners card — clickable header row (collapsed) + compact empty placeholder */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-20 hidden sm:block" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
        </div>
        {/* Compact empty state placeholder */}
        <div className="flex flex-col items-center gap-2 py-8">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      {/* Articles card — static header (no toggle) + compact empty placeholder */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded shrink-0" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Compact empty state placeholder */}
        <div className="flex flex-col items-center gap-2 py-8">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full page skeleton for /dashboard/settings.
 * Structure: page header · filter bar · grouped KV setting cards · create card.
 */
export function AdminSettingsPageSkeleton() {
  return (
    <div className="space-y-5">
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-[400px] max-w-full" />
        </div>
      </header>

      {/* Filter bar — key search + group select + submit */}
      <div className="rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 flex-1 min-w-[180px] rounded-xl" />
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>

      {/* Setting group cards (3 groups with varying row counts) */}
      {([4, 3, 3] as const).map((rowCount, gi) => (
        <div key={gi} className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
            <Skeleton className="h-3 w-6" />
          </div>
          <div className="divide-y divide-hairline">
            {Array.from({ length: rowCount }).map((_, si) => (
              <div key={si} className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-16 w-full rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Create new setting card */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="px-5 py-4 space-y-3">
          <Skeleton className="h-8 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full page skeleton for /dashboard/notifications.
 * Structure: page header with templates action button · notification inbox list.
 */
export function AdminNotificationsPageSkeleton() {
  return (
    <div className="space-y-5">
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-[420px] max-w-full" />
          </div>
          <Skeleton className="h-9 w-44 rounded-xl shrink-0" />
        </div>
      </header>

      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="divide-y divide-hairline">
          {(['w-64', 'w-72', 'w-56', 'w-80', 'w-60', 'w-52', 'w-48', 'w-64'] as const).map((w, i) => (
            <div key={i} className="px-5 py-4 flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className={cn('h-4', w)} />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
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
