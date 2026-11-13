import { AccountCard } from '@/components/account/AccountCard';
import {
  AccountLoadingPage,
  ChipsSkeleton,
  FiguresCardSkeleton,
} from '@/components/account/AccountLoading';
import { PaymentsTabs } from '@/components/account/PaymentsTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «المدفوعات» › schedule while it loads: heading, tabs, figures, filters, «due now», the yearly table. */
export default async function InstallmentsLoading() {
  const locale = await getLocale();
  const pm = siteT(locale).accountPages.payments;
  return (
    <AccountLoadingPage
      title={pm.title}
      description={pm.description}
      loadingLabel={accountT(locale).loading}
    >
      <PaymentsTabs active="schedule" locale={locale} />
      <div className="space-y-6">
        <FiguresCardSkeleton count={4} />
        <ChipsSkeleton count={4} />
        <div className="grid gap-3 md:grid-cols-2">
          <AccountCard className="p-5">
            <div className="space-y-4">
              <Skeleton className="h-4 w-32 rounded-full" />
              <div className="flex items-end justify-between">
                <Skeleton className="h-7 w-36 rounded-full" />
                <div className="h-9 w-32 rounded-xl bg-navy" />
              </div>
            </div>
          </AccountCard>
        </div>
        <AccountCard className="p-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5 last:border-0"
            >
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-3.5 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </AccountCard>
      </div>
    </AccountLoadingPage>
  );
}
