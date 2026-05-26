import { Skeleton, SkeletonList } from '@/components/ui/skeleton';

export default function MaintenanceLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-4 w-64 rounded-full" />
        </div>
        <Skeleton className="h-12 w-44 rounded-full" />
      </div>
      <SkeletonList count={4} />
    </div>
  );
}
