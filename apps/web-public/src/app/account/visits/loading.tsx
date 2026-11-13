import { AccountLoadingPage, RowCardsSkeleton } from '@/components/account/AccountLoading';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الزيارات» while it loads. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.visits;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
    >
      <RowCardsSkeleton count={3} />
    </AccountLoadingPage>
  );
}
