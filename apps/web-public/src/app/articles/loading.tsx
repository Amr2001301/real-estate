import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** «المقالات» while it loads: the header, the lead article (text beside a photo) and a grid of cards. */
export default async function ArticlesLoading() {
  const locale = await getLocale();
  const isRtl = locale === 'ar';
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <ListHero
        homeLabel={isRtl ? 'الرئيسية' : 'Home'}
        title={isRtl ? 'مقالات ونصائح عقارية' : 'Articles & insights'}
        subtitle={isRtl ? 'أدلة ومقارنات ونصائح تساعدك تختار وتشتري بثقة.' : 'Guides, comparisons and tips to choose and buy with confidence.'}
      />
      <section aria-hidden className="relative z-10 -mt-16 pb-16 sm:-mt-20">
        <Container>
          <div className="grid overflow-hidden rounded-[1.75rem] border border-hairline bg-surface lg:grid-cols-2">
            <div className="space-y-4 p-8 sm:p-10">
              <Skeleton className="h-3.5 w-24 rounded-full" />
              <Skeleton className="h-8 w-3/4 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
              <Skeleton className="mt-10 h-4 w-28 rounded-full" />
            </div>
            <Skeleton className="aspect-[16/10] h-full w-full rounded-none" />
          </div>
          <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface">
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="space-y-3 p-6">
                  <Skeleton className="h-3 w-1/4 rounded-full" />
                  <Skeleton className="h-5 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
