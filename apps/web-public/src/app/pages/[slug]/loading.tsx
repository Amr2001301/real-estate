import { Container } from '@/components/ui/Container';
import { SkeletonListHero, SkeletonText, Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** A company page while it loads: the deep header and the white text card over its edge. */
export default async function CustomPageLoading() {
  const locale = await getLocale();
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <SkeletonListHero />
      <section aria-hidden className="relative z-10 -mt-16 pb-16 sm:-mt-20">
        <Container>
          <div className="mx-auto max-w-4xl space-y-8 rounded-[1.75rem] border border-hairline bg-surface p-7 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-14">
            <Skeleton className="h-6 w-1/3 rounded-full" />
            <SkeletonText lines={4} />
            <SkeletonText lines={3} />
          </div>
        </Container>
      </section>
    </>
  );
}
