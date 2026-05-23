import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Hero } from '@/components/home/Hero';
import { SearchBar } from '@/components/home/SearchBar';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { FeaturedUnits } from '@/components/home/FeaturedUnits';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { CompareTeaser } from '@/components/home/CompareTeaser';
import { GrowthTeaser } from '@/components/home/GrowthTeaser';
import { LeadCtaBand } from '@/components/home/LeadCtaBand';
import { MobileAppPromo } from '@/components/marketing/MobileAppPromo';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationLd } from '@/lib/jsonld';

export const metadata = buildMetadata({
  path: '/',
  title: 'الرئيسية',
  description:
    'فن العيش الراقي يبدأ من اختيارك الصحيح — اكتشف مشاريع ووحدات عقارية فاخرة مختارة بعناية لتناسب أسلوب حياتك واستثمارك.',
});

// Re-fetch public feeds at most once a minute (ISR).
const REVALIDATE = 60;

export default async function HomePage() {
  const [projects, units] = await Promise.all([
    safeFetch<Paginated<PublicProjectListItem>>('/public/projects?featured=true&pageSize=3', {
      revalidate: REVALIDATE,
    }),
    safeFetch<Paginated<PublicUnit>>('/public/units?pageSize=3', { revalidate: REVALIDATE }),
  ]);

  const projectsCount = projects.ok ? projects.data.meta.total : null;
  const unitsCount = units.ok ? units.data.meta.total : null;

  return (
    <>
      <JsonLd data={organizationLd()} />
      <Hero projectsCount={projectsCount} unitsCount={unitsCount} />

      {/* Search strip overlapping the hero's lower edge. */}
      <Container className="relative z-10 -mt-16 sm:-mt-20">
        <SearchBar />
      </Container>

      <FeaturedProjects result={projects} />
      <FeaturedUnits result={units} />
      <WhyChooseUs />
      <CompareTeaser />
      <GrowthTeaser />
      <MobileAppPromo />
      <LeadCtaBand />
    </>
  );
}
