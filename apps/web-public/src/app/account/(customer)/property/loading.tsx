import { AccountCard } from '@/components/account/AccountCard';
import { AccountLoadingPage } from '@/components/account/AccountLoading';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «عقاراتي» while it loads: heading, the unit-value card (three figures and the price line), the construction-progress card. */
export default async function PropertyLoading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.property;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
    >
      <div className="space-y-6">
        <AccountCard className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-56 rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-5 h-20 w-full rounded-2xl" />
        </AccountCard>
        <AccountCard className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded-full" />
          </div>
          <Skeleton className="mt-6 h-3.5 w-1/3 rounded-full" />
          <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
        </AccountCard>
      </div>
    </AccountLoadingPage>
  );
}
