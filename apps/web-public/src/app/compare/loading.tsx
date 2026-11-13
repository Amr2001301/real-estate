import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «المقارنة» while it loads: the page's header and its white panel with three unit columns. */
export default async function CompareLoading() {
  const locale = await getLocale();
  const m = siteT(locale);
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <ListHero homeLabel={m.unitDetail.breadHome} title={m.compare.title} subtitle={m.compare.subtitle} />
      <section aria-hidden className="relative z-10 -mt-16 pb-20 sm:-mt-20">
        <Container>
          <div className="rounded-[1.75rem] border border-hairline bg-surface p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-10">
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-hairline">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-2/3 rounded-full" />
                    <Skeleton className="h-5 w-1/2 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-3 border-t border-hairline pt-8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-4 rounded-full" />
                  <Skeleton className="h-4 rounded-full" />
                  <Skeleton className="h-4 rounded-full" />
                  <Skeleton className="h-4 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
