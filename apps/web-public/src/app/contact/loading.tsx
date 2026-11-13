import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { Skeleton, SkeletonDark, SkeletonDeepPanel } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «تواصل معنا» while it loads: the header, the form card and the deep «reach us» card beside it. */
export default async function ContactLoading() {
  const locale = await getLocale();
  const m = siteT(locale);
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <ListHero homeLabel={m.unitDetail.breadHome} title={m.contactPage.title} subtitle={m.contactPage.subtitle} />
      <section aria-hidden className="relative z-10 -mt-16 pb-16 sm:-mt-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="rounded-[1.75rem] border border-hairline bg-surface p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-10">
              <Skeleton className="h-7 w-40 rounded-full" />
              <Skeleton className="mt-3 h-3.5 w-56 rounded-full" />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
              <Skeleton className="mt-5 h-12 rounded-xl" />
              <Skeleton className="mt-5 h-36 rounded-xl" />
              <div className="mt-6 h-12 w-36 rounded-full bg-navy" />
            </div>
            <div className="space-y-6">
              <SkeletonDeepPanel className="p-7 sm:p-8">
                <SkeletonDark className="h-3.5 w-24 rounded-full" />
                <SkeletonDark className="mt-3 h-6 w-48 rounded-full" />
                <div className="mt-6 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <SkeletonDark key={i} className="h-[76px] rounded-2xl" />
                  ))}
                </div>
              </SkeletonDeepPanel>
              <div className="rounded-[1.75rem] border border-hairline bg-surface p-7 sm:p-8">
                <Skeleton className="h-3.5 w-20 rounded-full" />
                <Skeleton className="mt-5 h-10 rounded-xl" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
