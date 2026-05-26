import { Skeleton, SkeletonForm } from '@/components/ui/skeleton';
import { PremiumCard } from '@/components/ui/PremiumCard';

export default function MaintenanceNewLoading() {
  return (
    <div className="space-y-6">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-7 w-44 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>
      <PremiumCard className="p-6 sm:p-8">
        <SkeletonForm fields={3} />
      </PremiumCard>
    </div>
  );
}
