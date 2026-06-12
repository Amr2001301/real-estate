import { Skeleton } from '@/components/ui/skeletons';

export default function AuditLogsLoading() {
  return (
    <div className="space-y-5">

      {/* Header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-[460px] max-w-full" />
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center shrink-0">
            <div className="flex items-center gap-2.5 px-4 first:ps-0 last:pe-0">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {i < 2 && <div className="hidden sm:block h-8 w-px bg-hairline shrink-0" />}
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-surface-muted/30">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex flex-col gap-1 ${i === 0 ? 'col-span-2' : ''}`}>
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 px-5 py-3 border-b border-hairline bg-surface-muted/60">
          {['w-28', 'w-32', 'w-36', 'w-28', 'w-20', 'w-16', 'w-8'].map((w, i) => (
            <Skeleton key={i} className={`h-2.5 ${w} shrink-0`} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, r) => (
          <div key={r} className="flex gap-4 px-5 py-3.5 border-t border-hairline items-center">
            <Skeleton className="h-3.5 w-28 shrink-0" />
            <div className="w-32 shrink-0 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="w-36 shrink-0 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-4 w-12 rounded" />
            </div>
            <div className="w-28 shrink-0 space-y-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-24 opacity-50" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md shrink-0" />
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-7 w-7 rounded-lg shrink-0 ms-auto" />
          </div>
        ))}
      </div>

    </div>
  );
}
