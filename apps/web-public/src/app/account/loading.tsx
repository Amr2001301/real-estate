import { Skeleton, SkeletonStat } from '@/components/ui/skeleton';

/** Mirrors a RecentPanel: header (icon + title) over a few list rows. */
function SkeletonPanel({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={`rounded-3xl border border-hairline bg-surface p-4 shadow-card ${className ?? ''}`}>
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-28 rounded-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountDashboardLoading() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <span className="sr-only">جارٍ التحميل…</span>
      {/* Overview heading + quick actions */}
      <div className="space-y-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-9 w-48 rounded-full" />
            <Skeleton className="h-4 w-64 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
        <SkeletonStat count={4} />
      </div>
      {/* Recent activity panels */}
      <div className="space-y-7">
        <div className="space-y-3">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
      </div>
    </div>
  );
}
