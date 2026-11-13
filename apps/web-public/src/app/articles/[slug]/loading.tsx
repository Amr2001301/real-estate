import { Container } from '@/components/ui/Container';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** An article while it loads: date, title and summary, the cover, then the text — as the page lays them out. */
export default async function ArticleLoading() {
  const locale = await getLocale();
  return (
    <section className="bg-canvas pb-20 pt-24 sm:pt-28">
      <span className="sr-only">{accountT(locale).loading}</span>
      <Container>
        <div aria-hidden className="mx-auto max-w-3xl">
          <Skeleton className="h-3.5 w-16 rounded-full" />
          <Skeleton className="mt-6 h-3.5 w-40 rounded-full" />
          <Skeleton className="mt-4 h-10 w-full rounded-full sm:h-12" />
          <Skeleton className="mt-3 h-10 w-2/3 rounded-full sm:h-12" />
          <Skeleton className="mt-5 h-4 w-3/4 rounded-full" />
        </div>
        <Skeleton className="mx-auto mt-10 aspect-[16/8] w-full max-w-5xl rounded-[1.75rem]" />
        <div aria-hidden className="mx-auto mt-10 max-w-3xl space-y-8">
          <SkeletonText lines={4} />
          <SkeletonText lines={3} />
        </div>
      </Container>
    </section>
  );
}
