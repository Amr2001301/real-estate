import { AccountCard } from '@/components/account/AccountCard';
import { AccountLoadingPage } from '@/components/account/AccountLoading';
import { PaymentsTabs } from '@/components/account/PaymentsTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «المدفوعات» › recorded payments while it loads: heading, tabs, the total card, payment rows. */
export default async function DepositsLoading() {
  const locale = await getLocale();
  const pm = siteT(locale).accountPages.payments;
  return (
    <AccountLoadingPage
      title={pm.title}
      description={pm.description}
      loadingLabel={accountT(locale).loading}
    >
      <PaymentsTabs active="paid" locale={locale} />
      <div className="space-y-4">
        <AccountCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-7 w-36 rounded-full" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-20 rounded-xl" />
              ))}
            </div>
          </div>
        </AccountCard>
        {[0, 1, 2].map((i) => (
          <AccountCard key={i} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
              <Skeleton className="hidden h-4 w-24 rounded-full sm:block" />
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </AccountCard>
        ))}
      </div>
    </AccountLoadingPage>
  );
}
