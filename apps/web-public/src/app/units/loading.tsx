import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { SkeletonFilterBar, SkeletonListingGrid, SkeletonToolbar } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «الوحدات» while it loads: the page's own header, filter bar and unit cards. */
export default async function UnitsLoading() {
  const locale = await getLocale();
  const m = siteT(locale);
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <ListHero homeLabel={m.listing.home} title={m.units.title} subtitle={m.units.subtitle} />
      <Container className="relative z-20 -mt-14 px-6 sm:px-10 lg:px-12">
        <SkeletonFilterBar fields={5} />
      </Container>
      <Container className="pt-8 pb-20">
        <SkeletonToolbar />
        <SkeletonListingGrid count={6} />
      </Container>
    </>
  );
}
