import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Hero } from '@/components/home/Hero';
import { SearchPanel } from '@/components/home/SearchPanel';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { FeaturedUnits } from '@/components/home/FeaturedUnits';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { InvestmentCategories } from '@/components/home/InvestmentCategories';
import { HomeBanner } from '@/components/home/HomeBanner';
import { HowWeHelp } from '@/components/home/HowWeHelp';
import { HomeContact } from '@/components/home/HomeContact';
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
    // No `featured` filter: the API already orders featured-first, so this one
    // request returns featured projects first then fills with normal published
    // ones (single source ⇒ inherently deduped) — up to 8 for the carousel.
    safeFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=8', {
      revalidate: REVALIDATE,
    }),
    // Homepage shows 6 featured units (two rows); the full catalogue lives on /units.
    safeFetch<Paginated<PublicUnit>>('/public/units?pageSize=6', { revalidate: REVALIDATE }),
  ]);

  // Use the first featured project's cover as the hero backdrop when available.
  const heroImage = projects.ok
    ? (projects.data.data.find((p) => p.coverImage)?.coverImage ?? null)
    : null;
  const projectsCount = projects.ok ? projects.data.meta.total : null;
  const unitsCount = units.ok ? units.data.meta.total : null;

  return (
    <>
      <JsonLd data={organizationLd()} />
      <Hero image={heroImage} projectsCount={projectsCount} unitsCount={unitsCount} />

      {/* Premium search panel overlapping the hero's lower edge. */}
      <Container className="relative z-10 -mt-12 sm:-mt-14">
        <SearchPanel />
      </Container>

      <InvestmentCategories />
      <FeaturedProjects result={projects} />
      <HomeBanner />
      <FeaturedUnits result={units} />
      <WhyChooseUs />
      <MobileAppPromo />
      <HowWeHelp />
      <HomeContact />
      <LeadCtaBand />
    </>
  );
}
