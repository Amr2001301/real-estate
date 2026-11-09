import { pageMeta } from '@/lib/page-meta';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Hero } from '@/components/home/Hero';
import { SearchPanel } from '@/components/home/SearchPanel';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { FeaturedUnits } from '@/components/home/FeaturedUnits';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { InvestmentCategories } from '@/components/home/InvestmentCategories';
import { HomeBanner } from '@/components/home/HomeBanner';
import { HomeBanners } from '@/components/home/HomeBanners';
import { fetchBanners } from '@/lib/cms';
import { HowWeHelp } from '@/components/home/HowWeHelp';
import { HomeContact } from '@/components/home/HomeContact';
import { LeadCtaBand } from '@/components/home/LeadCtaBand';
import { MobileAppPromo } from '@/components/marketing/MobileAppPromo';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationLd } from '@/lib/jsonld';

export async function generateMetadata() {
  return pageMeta('home', { path: '/' });
}

// Re-fetch public feeds at most once a minute (ISR).
const REVALIDATE = 60;

export default async function HomePage() {
  const tenant = await getResolvedTenant();
  const locale = await getLocale();
  if (!tenant) {
    // No company behind this address: say so, instead of the generic «page not found» (F-001).
    const u = siteT(locale).siteUnavailable;
    return (
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <h1 data-testid="site-unavailable" className="text-display-2 text-ink-strong">{u.title}</h1>
        <p className="mt-3 max-w-md text-ink-muted">{u.message}</p>
      </Container>
    );
  }
  const [projects, units, cities, banners] = await Promise.all([
    // No `featured` filter: the API already orders featured-first, so this one
    // request returns featured projects first then fills with normal published
    // ones (single source ⇒ inherently deduped) — up to 8 for the carousel.
    apiFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=8', {
      revalidate: REVALIDATE,
      tenantSlug: tenant.slug,
    }),
    // Homepage shows 6 featured units (two rows); the full catalogue lives on /units.
    apiFetch<Paginated<PublicUnit>>('/public/units?pageSize=6', {
      revalidate: REVALIDATE,
      tenantSlug: tenant.slug,
    }),
    // The company's own project cities (the search offered Saudi cities to
    // every tenant, an Egyptian developer's included — F37).
    apiFetch<{ cities: string[] }>('/public/projects/cities', {
      revalidate: REVALIDATE,
      tenantSlug: tenant.slug,
    }),
    // The company's own banners (dashboard → المحتوى → البانرات).
    fetchBanners(tenant.slug, locale),
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
      <Hero image={heroImage} projectsCount={projectsCount} unitsCount={unitsCount} locale={locale} />

      {/* Premium search panel overlapping the hero's lower edge. */}
      <Container className="relative z-10 -mt-12 sm:-mt-14">
        <SearchPanel locale={locale} cities={cities.ok ? cities.data.cities : []} />
      </Container>

      <HomeBanners banners={banners} locale={locale} />

      <InvestmentCategories locale={locale} />
      <FeaturedProjects result={projects} locale={locale} />
      <HomeBanner locale={locale} />
      <FeaturedUnits result={units} locale={locale} />
      <WhyChooseUs locale={locale} />
      <MobileAppPromo locale={locale} />
      <HowWeHelp locale={locale} />
      <HomeContact locale={locale} />
      <LeadCtaBand locale={locale} />
    </>
  );
}
