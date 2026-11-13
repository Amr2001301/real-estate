import { AccountLoadingPage } from '@/components/account/AccountLoading';
import { AccountCard } from '@/components/account/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الملف الشخصي» while it loads: the edit card beside the account-info card. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.profile;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AccountCard className="p-6">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="mt-2 h-3 w-48 rounded-full" />
          <div className="mt-6 flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
          <Skeleton className="mt-4 h-14 rounded-xl" />
          <div className="mt-6 h-10 w-32 rounded-full bg-navy" />
        </AccountCard>
        <AccountCard className="p-6">
          <div className="space-y-5">
            <Skeleton className="h-5 w-32 rounded-full" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-16 rounded-full" />
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        </AccountCard>
      </div>
    </AccountLoadingPage>
  );
}
