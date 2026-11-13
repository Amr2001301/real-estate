import { AccountLoadingPage } from '@/components/account/AccountLoading';
import { AccountCard } from '@/components/account/AccountCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «طلب صيانة جديد» while it loads: the request form card. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.maintenanceNew;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.subtitle}
      loadingLabel={accountT(locale).loading}
    >
      <AccountCard className="p-6">
        <div className="space-y-5">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <div className="h-11 w-32 rounded-full bg-navy" />
        </div>
      </AccountCard>
    </AccountLoadingPage>
  );
}
