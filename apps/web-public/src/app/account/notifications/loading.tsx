import { AccountLoadingPage } from '@/components/account/AccountLoading';
import { AccountCard } from '@/components/account/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الإشعارات» while it loads: heading with «mark all read», the list card, the preferences card. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.notifications;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
      action
    >
      <AccountCard className="">
        <div className="divide-y divide-hairline">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
          ))}
        </div>
      </AccountCard>
      <AccountCard className="mt-6 p-6">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="mt-3 h-3 w-2/3 rounded-full" />
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      </AccountCard>
    </AccountLoadingPage>
  );
}
