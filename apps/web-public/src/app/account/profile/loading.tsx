import { Skeleton, SkeletonForm } from '@/components/ui/skeleton';
import { PremiumCard } from '@/components/ui/PremiumCard';

export default function ProfileLoading() {
  return (
    <div className="space-y-8">
      <span className="sr-only">جارٍ التحميل…</span>
      <Skeleton className="h-7 w-40 rounded-full" />

      {/* Read-only account info */}
      <PremiumCard className="p-6 sm:p-8">
        <Skeleton className="h-5 w-32 rounded-full" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-4 w-40 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Editable fields */}
      <PremiumCard className="p-6 sm:p-8">
        <Skeleton className="mb-5 h-5 w-32 rounded-full" />
        <SkeletonForm fields={2} />
      </PremiumCard>
    </div>
  );
}
