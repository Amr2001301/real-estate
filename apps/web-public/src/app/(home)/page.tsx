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
import { HomeBanners } from '@/components/home/HomeBanners';
import { fetchArticles, fetchBanners } from '@/lib/cms';
import { HomeArticles } from '@/components/home/HomeArticles';
import { HowWeHelp } from '@/components/home/HowWeHelp';
import { HomeContact } from '@/components/home/HomeContact';
import { MobileAppPromo } from '@/components/marketing/MobileAppPromo';
import { companyApp } from '@/lib/app-links';
import { brandingText, companyName, fetchBranding } from '@/lib/branding';
import { companyContact } from '@/lib/contact';
import { SITE } from '@/lib/seo';
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
  const [projects, units, cities, banners, branding, articles] = await Promise.all([
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
    // The company's own name and app (a company's site never promotes the platform's).
    fetchBranding(tenant.slug),
    // «أحدث المقالات» (dashboard → المحتوى → المقالات); none → no section.
    fetchArticles(tenant.slug, locale),
  ]);
  // How many units each investment field holds (one cheap count per usage).
  const usages = ['RESIDENTIAL', 'ADMINISTRATIVE', 'COMMERCIAL', 'MEDICAL'] as const;
  const usageCounts = await Promise.all(
    usages.map((u) =>
      apiFetch<Paginated<PublicUnit>>(`/public/units?pageSize=1&usage=${u}`, {
        revalidate: REVALIDATE,
        tenantSlug: tenant.slug,
      }),
    ),
  );
  const counts = Object.fromEntries(
    usages.map((u, i) => {
      const r = usageCounts[i]!;
      return [u, r.ok ? r.data.meta.total : null];
    }),
  );
  const contact = companyContact(branding);
  const ownApp = companyApp(branding?.mobileApp);

  // The hero shows the first featured project that has a cover photo.
  const list = projects.ok ? projects.data.data : [];
  const heroProject = list.find((p) => p.featured && p.coverImage) ?? list.find((p) => p.coverImage) ?? list[0] ?? null;
  // «لماذا نحن» borrows another project's photo when there is one.
  const whyImage = list.find((p) => p.coverImage && p.id !== heroProject?.id)?.coverImage ?? null;
  // The consultation panel's photo: a third project's, else one already shown.
  const contactImage =
    list.find((p) => p.coverImage && p.id !== heroProject?.id && p.coverImage !== whyImage)?.coverImage ?? whyImage ?? heroProject?.coverImage ?? null;
  const citiesCount = cities.ok ? cities.data.cities.length : null;
  const projectsCount = projects.ok ? projects.data.meta.total : null;
  const unitsCount = units.ok ? units.data.meta.total : null;

  return (
    <>
      <JsonLd data={organizationLd()} />
      <Hero
        featured={heroProject}
        projectsCount={projectsCount}
        unitsCount={unitsCount}
        citiesCount={citiesCount}
        locale={locale}
      />

      {/* Search panel overlapping the hero's lower edge. */}
      <Container className="relative z-10 -mt-8 px-6 sm:-mt-16 sm:px-10 lg:px-14">
        <SearchPanel locale={locale} cities={cities.ok ? cities.data.cities : []} counts={counts} />
      </Container>

      <HomeBanners banners={banners} locale={locale} />

      <InvestmentCategories locale={locale} counts={counts} />
      <FeaturedProjects result={projects} locale={locale} />
      <FeaturedUnits result={units} locale={locale} />
      <WhyChooseUs locale={locale} image={whyImage} />
      {ownApp ? (
        <MobileAppPromo
          locale={locale}
          appName={ownApp.name ?? companyName(branding, locale, SITE.name)}
          branding={branding ?? undefined}
        />
      ) : null}
      <HowWeHelp locale={locale} />
      <HomeArticles articles={articles} locale={locale} />
      <HomeContact
        locale={locale}
        phone={contact.phone}
        whatsapp={contact.whatsapp}
        image={contactImage}
        hours={brandingText(branding?.officeHours, locale)}
      />
    </>
  );
}
