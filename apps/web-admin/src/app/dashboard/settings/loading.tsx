import { Skeleton } from '@/components/ui/skeletons';

export default function SettingsLoading() {
  return (
    <div className="space-y-4">

      {/* Header */}
      <header className="mb-0 space-y-3">
        <Skeleton className="h-3 w-52" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-[480px] max-w-full" />
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center shrink-0">
            <div className="flex items-center gap-2.5 px-4 first:ps-0 last:pe-0">
              <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {i < 3 && <div className="hidden sm:block h-8 w-px bg-hairline shrink-0" />}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <Skeleton className="h-10 w-full rounded-2xl" />

      {/* Filter card */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 shadow-xs">
        <Skeleton className="h-8 flex-1 min-w-[200px] rounded-xl" />
        <Skeleton className="h-8 w-48 rounded-xl shrink-0" />
        <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
      </div>

      {/* Setting group cards */}
      {[3, 2, 4].map((rowCount, gi) => (
        <div key={gi} className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline bg-surface-muted/30">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-14 rounded ms-1" />
            <Skeleton className="ms-auto h-5 w-6 rounded-full" />
          </div>
          {/* Rows */}
          <div className="divide-y divide-hairline">
            {Array.from({ length: rowCount }).map((_, si) => (
              <div key={si} className="px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-44" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-10 rounded" />
                  </div>
                  <Skeleton className="h-2.5 w-28" />
                </div>
                <Skeleton className="lg:col-span-5 h-16 w-full rounded-xl" />
                <div className="lg:col-span-3 space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-7 w-16 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add setting collapsible */}
      <div className="rounded-2xl border border-hairline bg-surface shadow-xs">
        <div className="flex items-center gap-2.5 px-5 py-3.5">
          <Skeleton className="h-6 w-6 rounded-md shrink-0" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-4 rounded ms-auto" />
        </div>
      </div>

    </div>
  );
}
