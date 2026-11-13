import { AccountLoadingPage, RowCardsSkeleton } from '@/components/account/AccountLoading';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الصيانة» while it loads: heading with its «new request» button, then request cards. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.maintenance;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.description}
      loadingLabel={accountT(locale).loading}
      action
    >
      <RowCardsSkeleton count={3} />
    </AccountLoadingPage>
  );
}
