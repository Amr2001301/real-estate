import { Skeleton, SkeletonStat, SkeletonList } from '@/components/ui/skeleton';

export default function AccountDashboardLoading() {
  return (
    <div className="space-y-8">
      <span className="sr-only">جارٍ التحميل…</span>
      {/* Overview heading + quick actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-4 w-56 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-12 w-32 rounded-full" />
          <Skeleton className="h-12 w-32 rounded-full" />
        </div>
      </div>
      {/* Summary tiles */}
      <SkeletonStat count={3} />
      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonList count={3} />
        <SkeletonList count={3} />
      </div>
    </div>
  );
}
