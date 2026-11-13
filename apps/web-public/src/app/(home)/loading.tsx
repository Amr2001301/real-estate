import { Container } from '@/components/ui/Container';
import { Skeleton, SkeletonDark, SkeletonDeepPanel, SkeletonListingGrid } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/**
 * The homepage while it loads, in its own shape: the deep hero (words beside
 * the featured photo), the search panel over its lower edge, then a row of
 * project cards. (The site-wide fallback in app/loading.tsx stays neutral.)
 */
export default async function HomeLoading() {
  const t = accountT(await getLocale());
  return (
    <>
      <span className="sr-only">{t.loading}</span>
      <section aria-hidden className="pt-24 sm:pt-28">
        <Container>
          <SkeletonDeepPanel className="flex flex-col rounded-[2rem] lg:min-h-[620px] lg:flex-row">
            <div className="flex flex-1 flex-col justify-center px-6 pb-24 pt-12 sm:px-10 lg:px-16 lg:pb-32">
              <SkeletonDark className="h-3.5 w-36 rounded-full" />
              <SkeletonDark className="mt-7 h-12 w-4/5 rounded-full" />
              <SkeletonDark className="mt-4 h-12 w-3/5 rounded-full" />
              <SkeletonDark className="mt-7 h-4 w-3/4 max-w-[500px] rounded-full" />
              <div className="mt-9 flex gap-3">
                <div className="h-12 w-40 rounded-full bg-gold-400/70" />
                <SkeletonDark className="h-12 w-36 rounded-full" />
              </div>
            </div>
            <SkeletonDark className="min-h-[320px] flex-1 rounded-none sm:min-h-[420px] lg:min-h-0" />
          </SkeletonDeepPanel>
        </Container>
      </section>
      <Container className="relative z-10 -mt-8 px-6 sm:-mt-16 sm:px-10 lg:px-14">
        <div aria-hidden className="rounded-[22px] border border-hairline bg-surface p-4 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.3)] sm:p-5">
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-full bg-navy" />
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 sm:flex-nowrap">
            <Skeleton className="h-12 w-full rounded-2xl sm:flex-[1.6]" />
            <Skeleton className="hidden h-12 flex-1 rounded-2xl sm:block" />
            <Skeleton className="hidden h-12 flex-1 rounded-2xl sm:block" />
            <Skeleton className="hidden h-12 flex-1 rounded-2xl sm:block" />
            <div className="h-12 w-32 shrink-0 rounded-2xl bg-navy" />
          </div>
        </div>
      </Container>
      <Container className="pb-20 pt-20">
        <div aria-hidden className="mb-8 space-y-3">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-8 w-64 rounded-full" />
        </div>
        <SkeletonListingGrid count={3} />
      </Container>
    </>
  );
}
