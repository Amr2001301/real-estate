import {
  AccountLoadingPage,
  ChipsSkeleton,
  RowCardsSkeleton,
} from '@/components/account/AccountLoading';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «مستنداتي» while it loads: heading, type chips, documents. */
export default async function Loading() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.documents;
  return (
    <AccountLoadingPage
      title={m.title}
      description={m.sectionTitle}
      loadingLabel={accountT(locale).loading}
    >
      <ChipsSkeleton count={4} />
      <div className="mt-6">
        <RowCardsSkeleton count={3} />
      </div>
    </AccountLoadingPage>
  );
}
