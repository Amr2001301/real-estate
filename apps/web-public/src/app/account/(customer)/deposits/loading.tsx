import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

export default async function DepositsLoading() {
  const t = accountT(await getLocale());
  return (
    <div className="space-y-6">
      <span className="sr-only">{t.loading}</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>
      {/* Totals summary */}
      <PremiumCard className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-9 w-40 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </PremiumCard>
      {/* Deposit rows */}
      <SkeletonList count={4} />
    </div>
  );
}
