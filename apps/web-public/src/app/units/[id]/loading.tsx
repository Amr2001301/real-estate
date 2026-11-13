import { SkeletonDetailPage } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** The detail page while it loads, in the page's own layout (deep photo hero, text beside the booking card). */
export default async function DetailLoading() {
  const t = accountT(await getLocale());
  return (
    <>
      <span className="sr-only">{t.loading}</span>
      <SkeletonDetailPage />
    </>
  );
}
