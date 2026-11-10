import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { ButtonLink } from '@/components/ui/Button';
import { ContactCta } from '@/components/marketing/ContactCta';
import { ListHero, type ListHeroStat } from '@/components/layout/ListHero';
import { fetchBranding } from '@/lib/branding';
import { formatNumber } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import { ProjectsFilterBar, ProjectsToolbar } from '@/components/projects/ProjectsFilterBar';
import { Pagination } from '@/components/projects/Pagination';
import { ProjectCard } from '@/components/home/ProjectCard';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { Stagger } from '@/components/motion/Stagger';

export async function generateMetadata() {
  return pageMeta('projects', { path: '/projects' });
}

const PAGE_SIZE = 9;
const REVALIDATE = 60;

type SearchParams = Promise<{ q?: string; city?: string; featured?: string; sort?: string; page?: string; type?: string }>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const [tenant, sp] = await Promise.all([getResolvedTenant(), searchParams]);
  if (!tenant) notFound();
  const q = firstStr(sp.q).trim();
  const city = firstStr(sp.city).trim();
  const type = firstStr(sp.type).trim();
  const featured = firstStr(sp.featured) === 'true';
  const sort = firstStr(sp.sort);
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (q) params.set('q', q);
  if (city) params.set('city', city);
  if (type) params.set('type', type);
  if (featured) params.set('featured', 'true');
  if (sort) params.set('sort', sort);

  const [result, citiesResult, locale, branding] = await Promise.all([
    apiFetch<Paginated<PublicProjectListItem>>(
      `/public/projects?${params.toString()}`,
      { revalidate: REVALIDATE, tenantSlug: tenant.slug },
    ),
    apiFetch<{ cities: string[] }>('/public/projects/cities', { revalidate: 300, tenantSlug: tenant.slug }),
    getLocale(),
    fetchBranding(tenant.slug),
  ]);
  const m = siteT(locale);

  const projects = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const cities = citiesResult.ok ? citiesResult.data.cities : [];
  const hasFilters = q !== '' || city !== '' || featured || type !== '';

  function buildHref(nextPage: number): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (city) p.set('city', city);
    if (type) p.set('type', type);
    if (featured) p.set('featured', 'true');
    if (sort) p.set('sort', sort);
    if (nextPage > 1) p.set('page', String(nextPage));
    const qs = p.toString();
    return qs ? `${routes.projects}?${qs}` : routes.projects;
  }

  const query = { q, city, type, featured, sort };
  const statsAll: Array<ListHeroStat | null> = [
    meta ? { value: formatNumber(meta.total, locale), label: m.listing.projectsStat } : null,
    cities.length > 0 ? { value: formatNumber(cities.length, locale), label: m.listing.citiesStat } : null,
  ];
  const stats = statsAll.filter((x): x is ListHeroStat => x !== null);
  const photo = projects.find((p) => p.coverImage)?.coverImage ?? null;

  return (
    <>
      <ListHero homeLabel={m.listing.home} title={m.projects.title} subtitle={m.projects.subtitle} stats={stats} />

      {/* Filter bar overlapping the header's lower edge, like the homepage search. */}
      <Container className="relative z-10 -mt-14 px-6 sm:px-10 lg:px-12">
        <ProjectsFilterBar initial={query} cities={cities} locale={locale} />
      </Container>

      <Container className="pt-8">
        {!result.ok ? (
          <ErrorState title={m.projects.errorTitle} message={m.projects.errorMsg} className="mx-auto max-w-2xl" />
        ) : projects.length === 0 ? (
          <EmptyState
            title={hasFilters ? m.projects.emptyFiltered : m.projects.emptyAll}
            message={hasFilters ? m.projects.emptyFilteredMsg : m.projects.emptyAllMsg}
            className="mx-auto max-w-2xl"
            action={
              hasFilters ? (
                <ButtonLink href={routes.projects} variant="outline" size="md">
                  {m.projects.clearFilters}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <ProjectsToolbar query={query} shown={projects.length} total={meta?.total ?? projects.length} locale={locale} />
            <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} locale={locale} />
              ))}
            </Stagger>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} locale={locale} />}
          </>
        )}
      </Container>

      <ContactCta locale={locale} branding={branding} image={photo} />
    </>
  );
}
