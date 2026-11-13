import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { SkeletonFilterBar, SkeletonListingGrid, SkeletonToolbar } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { accountT } from '@/messages/account';

/** «المشاريع» while it loads: the page's own header, filter bar and project cards. */
export default async function ProjectsLoading() {
  const locale = await getLocale();
  const m = siteT(locale);
  return (
    <>
      <span className="sr-only">{accountT(locale).loading}</span>
      <ListHero homeLabel={m.listing.home} title={m.projects.title} subtitle={m.projects.subtitle} />
      <Container className="relative z-10 -mt-14 px-6 sm:px-10 lg:px-12">
        <SkeletonFilterBar fields={4} />
      </Container>
      <Container className="pt-8 pb-20">
        <SkeletonToolbar />
        <SkeletonListingGrid count={6} />
      </Container>
    </>
  );
}
