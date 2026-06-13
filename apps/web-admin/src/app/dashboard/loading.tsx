import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardHomeLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-52 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>

      {/* Action bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* KPI strip — 6 cards (matches SALES layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Shortcuts strip */}
      <Skeleton className="h-12 rounded-2xl" />

      {/* 3-col section cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
