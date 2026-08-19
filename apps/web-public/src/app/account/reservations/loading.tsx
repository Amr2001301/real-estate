import { Skeleton, SkeletonList } from '@/components/ui/skeleton';

export default function ReservationsLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>
      <SkeletonList count={4} />
    </div>
  );
}
