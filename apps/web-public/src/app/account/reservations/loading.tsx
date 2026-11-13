import { AccountLoadingPage, RecordCardSkeleton } from '@/components/account/AccountLoading';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الحجوزات» while it loads: its heading, then reservation cards. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.reservations;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
    >
      <div className="space-y-4">
        <RecordCardSkeleton />
        <RecordCardSkeleton />
      </div>
    </AccountLoadingPage>
  );
}
