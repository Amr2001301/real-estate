// Loading placeholders for `loading.tsx` segments in app/. Each one has the
// shape of the page it stands in for (U5): the page hero (breadcrumb, large
// title, actions), the navy metric band, the rounded filter bar and the
// section card of rows — so the page fills in without anything jumping.
// The pulse is the platform's usual one. Layouts are symmetrical, so RTL and
// LTR both hold.

import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

/** Base block. Use for any rectangular placeholder. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}

/** A block on the navy metric band. */
function NavySkeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-[#D8B66A]/15', className)} />;
}

const card = 'overflow-hidden rounded-[22px] border border-hairline bg-surface';

// ── Page parts ──────────────────────────────────────────────────────────────

/** PremiumPageHero: breadcrumb, large title, a muted line, actions on the same row. */
export function PageHeaderSkeleton({ actions = 2, breadcrumb = true }: { actions?: number; breadcrumb?: boolean }) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-3">
        {breadcrumb && <Skeleton className="h-3.5 w-36" />}
        <Skeleton className="h-10 w-64 rounded-lg sm:h-12" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 gap-3">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className={cn('h-10 rounded-full', i === actions - 1 ? 'w-36' : 'w-28')} />
          ))}
        </div>
      )}
    </header>
  );
}

/** PremiumMetricStrip: one navy band, gold hairlines, a ring icon and a large figure per cell. */
export function MetricStripSkeleton({ count = 4 }: { count?: number }) {
  if (count <= 0) return null;
  const cols =
    count >= 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
    : count === 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
    : count === 3 ? 'grid-cols-2 sm:grid-cols-3'
    : count === 2 ? 'grid-cols-2'
    : 'grid-cols-2 lg:grid-cols-4';
  return (
    <section
      aria-hidden
      className="overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]"
    >
      <div className={cn('grid gap-px bg-[#D8B66A]/[0.16]', cols)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-navy-band px-6 py-6">
            <span className="h-12 w-12 shrink-0 rounded-full border border-[#D8B66A]/45" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <NavySkeleton className="h-3 w-24" />
              <NavySkeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Kept for older call sites: the metric band. */
export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return <MetricStripSkeleton count={count} />;
}

/** PremiumFilterBar: one rounded bar with a search field, selects and a trailing action. */
export function FilterBarSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-wrap items-center gap-2.5 rounded-[28px] border border-hairline bg-surface p-2 shadow-[0_10px_30px_-18px_rgb(20_26_38/0.25)] sm:p-2.5"
    >
      <Skeleton className="h-11 min-w-[160px] flex-1 rounded-full" />
      {Array.from({ length: Math.max(0, fields - 1) }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-36 rounded-full" />
      ))}
      <Skeleton className="ms-auto h-11 w-24 rounded-full" />
    </div>
  );
}

/** PremiumSectionCard of rows: avatar or icon, name with its code, then columns. */
export function TableCardSkeleton({
  cols = 5,
  rows = 8,
  title = true,
}: {
  cols?: number;
  rows?: number;
  title?: boolean;
}) {
  const extra = Math.max(0, Math.min(cols, 7) - 2);
  return (
    <div aria-hidden className={card}>
      {title && (
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      )}
      <ul className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, r) => (
          <li key={r} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 lg:max-w-[28%]">
              <Skeleton className={cn('h-4', r % 3 === 0 ? 'w-3/4' : r % 3 === 1 ? 'w-2/3' : 'w-1/2')} />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: extra }).map((_, c) => (
              <div key={c} className="hidden min-w-0 flex-1 space-y-2 lg:block">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
            <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A card with a title and a chart area. */
function ChartCardSkeleton({ className, height = 'h-56' }: { className?: string; height?: string }) {
  return (
    <div aria-hidden className={cn(card, 'space-y-4 p-6', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className={cn(height, 'w-full rounded-2xl')} />
    </div>
  );
}

/** Two side-by-side cards (chart + side panel). */
export function ChartsRowSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <ChartCardSkeleton className="lg:col-span-2" />
      <ChartCardSkeleton />
    </div>
  );
}

/** A card of label / value lines (detail side panels, settings sections). */
function FieldsCardSkeleton({ lines = 5, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn(card, 'space-y-5 p-6', className)}>
      <Skeleton className="h-5 w-36" />
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page compositions ───────────────────────────────────────────────────────

const page = 'flex flex-col gap-5 lg:gap-6';

/** List page: hero, metric band, filter bar, rows. Used by most segments. */
export function ListPageSkeleton({
  kpis = 4,
  cols = 5,
  rows = 8,
  filterFields = 3,
}: {
  kpis?: number;
  cols?: number;
  rows?: number;
  filterFields?: number;
}) {
  return (
    <div className={page} aria-busy="true">
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={kpis} />
      {filterFields > 0 && <FilterBarSkeleton fields={filterFields} />}
      <TableCardSkeleton cols={cols} rows={rows} />
    </div>
  );
}

/** Detail page: hero with its badge, metric band, main column of cards beside a side panel. */
export function DetailPageSkeleton({ kpis = 4, sections = 2 }: { kpis?: number; sections?: number }) {
  return (
    <div className={page} aria-busy="true">
      <PageHeaderSkeleton actions={3} />
      <MetricStripSkeleton count={kpis} />
      <div className="grid grid-cols-1 items-start gap-5 lg:gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          {Array.from({ length: sections }).map((_, i) =>
            i === 0 ? <FieldsCardSkeleton key={i} lines={6} /> : <TableCardSkeleton key={i} cols={5} rows={5} />,
          )}
        </div>
        <div className="flex flex-col gap-4">
          <FieldsCardSkeleton lines={4} />
          <FieldsCardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}

/** Report page: hero, filter bar, metric band, charts. */
export function ReportPageSkeleton({ kpis = 4, charts = 2 }: { kpis?: number; charts?: number }) {
  return (
    <div className={page} aria-busy="true">
      <PageHeaderSkeleton />
      <FilterBarSkeleton fields={3} />
      <MetricStripSkeleton count={kpis} />
      {Array.from({ length: charts }).map((_, i) => (
        <ChartsRowSkeleton key={i} />
      ))}
      <TableCardSkeleton cols={5} rows={5} />
    </div>
  );
}

/** Settings-style page: hero, then cards of fields (with a side panel when asked). */
export function CardsPageSkeleton({
  sections = 3,
  sidePanel = false,
  kpis = 0,
}: {
  sections?: number;
  sidePanel?: boolean;
  kpis?: number;
}) {
  const cards = Array.from({ length: sections }).map((_, i) => <FieldsCardSkeleton key={i} lines={i % 2 ? 4 : 6} />);
  return (
    <div className={page} aria-busy="true">
      <PageHeaderSkeleton actions={1} />
      <MetricStripSkeleton count={kpis} />
      {sidePanel ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">{cards}</div>
          <FieldsCardSkeleton lines={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">{cards}</div>
      )}
    </div>
  );
}

// ── Named page skeletons (kept so each loading.tsx stays a one-liner) ──────

export const MaintenancePageSkeleton = () => <ListPageSkeleton kpis={4} cols={6} rows={8} />;
export const BonusPageSkeleton = () => <ListPageSkeleton kpis={4} cols={6} rows={8} />;
export const BrokersPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const BrokerListPageSkeleton = ({ kpis = 0, cols = 6, rows = 8 }: { kpis?: number; cols?: number; rows?: number }) => (
  <ListPageSkeleton kpis={kpis} cols={cols} rows={rows} />
);
export const BrokerLeadsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const BrokerReservationsPageSkeleton = () => <ListPageSkeleton kpis={4} cols={6} rows={8} />;
export const BrokerContractsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const BrokerCommissionsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const BrokerPayoutsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const BrokerReportsPageSkeleton = () => <ReportPageSkeleton kpis={4} charts={1} />;
export const AdminTablePageSkeleton = ({
  cols = 6,
  rows = 10,
  filterFields = 3,
}: {
  cols?: number;
  rows?: number;
  filterFields?: number;
  hasAction?: boolean;
}) => <ListPageSkeleton kpis={0} cols={cols} rows={rows} filterFields={filterFields} />;
export const AdminDocumentsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={5} rows={8} />;
export const AdminCardsPageSkeleton = ({
  sectionCount = 3,
  hasSidePanel = false,
}: {
  sectionCount?: number;
  hasSidePanel?: boolean;
  infoBanner?: boolean;
}) => <CardsPageSkeleton sections={sectionCount} sidePanel={hasSidePanel} />;
export const AdminCmsPageSkeleton = () => <CardsPageSkeleton sections={3} />;
export const AdminSettingsPageSkeleton = () => <CardsPageSkeleton sections={4} sidePanel />;
export const AdminNotificationsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={4} rows={8} filterFields={0} />;
export const AdminNotificationsTemplatesPageSkeleton = () => <ListPageSkeleton kpis={0} cols={4} rows={8} filterFields={2} />;
export const TargetsPageSkeleton = () => <ListPageSkeleton kpis={0} cols={6} rows={8} />;
export const AdminReportsPageSkeleton = () => <ReportPageSkeleton kpis={4} charts={2} />;
export const AdminFinancialReportsPageSkeleton = () => <ReportPageSkeleton kpis={5} charts={2} />;

/** Form page (new / edit): hero, then the form card of field pairs and its actions. */
export function FormPageSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className={page} aria-busy="true">
      <PageHeaderSkeleton actions={0} />
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} aria-hidden className={cn(card, 'space-y-5 p-6')}>
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {Array.from({ length: i === 0 ? 6 : 4 }).map((__, f) => (
              <div key={f} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}
