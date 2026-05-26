import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { PremiumCard } from '@/components/ui/PremiumCard';

export default function MaintenanceDetailLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">جارٍ التحميل…</span>
      {/* Back link */}
      <Skeleton className="h-4 w-32 rounded-full" />

      {/* Detail card */}
      <PremiumCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-8 w-1/2 rounded-full" />
        <SkeletonText lines={2} className="mt-3" />
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-hairline pt-5 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Documents card */}
      <PremiumCard className="p-6 sm:p-8">
        <Skeleton className="h-5 w-24 rounded-full" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
