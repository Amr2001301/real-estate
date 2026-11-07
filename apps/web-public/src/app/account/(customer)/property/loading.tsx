import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

export default async function PropertyLoading() {
  const t = accountT(await getLocale());
  return (
    <div className="space-y-6">
      <span className="sr-only">{t.loading}</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
      </div>
      <SkeletonList count={3} />
    </div>
  );
}
