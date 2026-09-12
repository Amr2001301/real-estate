import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { getResolvedTenant } from '@/lib/tenant';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { CtaBand } from '@/components/marketing/CtaBand';
import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Container';
import { ProjectsFilterBar } from '@/components/projects/ProjectsFilterBar';
import { Pagination } from '@/components/projects/Pagination';
import { ProjectCard } from '@/components/home/ProjectCard';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { Stagger } from '@/components/motion/Stagger';

export const metadata = buildMetadata({
  path: '/projects',
  title: 'المشاريع العقارية',
  description:
    'استكشف مجموعة منتقاة من المشاريع السكنية والتجارية الفاخرة المصممة لأسلوب حياة أرقى — مواقع مميزة وتصاميم استثنائية.',
});

const PAGE_SIZE = 9;
const REVALIDATE = 60;

type SearchParams = Promise<{ q?: string; city?: string; featured?: string; sort?: string; page?: string }>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const [tenant, sp] = await Promise.all([getResolvedTenant(), searchParams]);
  if (!tenant) notFound();
  const q = firstStr(sp.q).trim();
  const city = firstStr(sp.city).trim();
  const featured = firstStr(sp.featured) === 'true';
  const sort = firstStr(sp.sort);
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (q) params.set('q', q);
  if (city) params.set('city', city);
  if (featured) params.set('featured', 'true');
  if (sort) params.set('sort', sort);

  const [result, citiesResult, locale] = await Promise.all([
    safeFetch<Paginated<PublicProjectListItem>>(
      `/public/projects?${params.toString()}`,
      { revalidate: REVALIDATE, tenantSlug: tenant.slug },
    ),
    safeFetch<{ cities: string[] }>('/public/projects/cities', { revalidate: 300, tenantSlug: tenant.slug }),
    getLocale(),
  ]);
  const m = siteT(locale);

  const projects = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const cities = citiesResult.ok ? citiesResult.data.cities : [];
  const hasFilters = q !== '' || city !== '' || featured;

  function buildHref(nextPage: number): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (city) p.set('city', city);
    if (featured) p.set('featured', 'true');
    if (sort) p.set('sort', sort);
    if (nextPage > 1) p.set('page', String(nextPage));
    const qs = p.toString();
    return qs ? `${routes.projects}?${qs}` : routes.projects;
  }

  return (
    <>
      <PageHero
        eyebrow={m.projects.eyebrow}
        title={m.projects.title}
        subtitle={m.projects.subtitle}
        overlap
      />

      {/* Filter bar overlapping the hero's lower edge — unified with the homepage. */}
      <Container className="relative z-10 -mt-12 sm:-mt-14">
        <ProjectsFilterBar initialQ={q} initialCity={city} initialFeatured={featured} initialSort={sort} cities={cities} locale={locale} />
      </Container>

      <Section tone="canvas" className="pt-12 pb-12 sm:pt-14 lg:pb-16">
          {!result.ok ? (
            <ErrorState
              title={m.projects.errorTitle}
              message={m.projects.errorMsg}
              className="mx-auto max-w-2xl"
            />
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
              {meta && (
                <p className="mb-6 text-sm text-ink-muted">
                  {m.projects.showing(projects.length, meta.total)}
                </p>
              )}
              <Stagger className="grid gap-7 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </Stagger>
              {meta && <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />}
            </>
          )}
      </Section>

      <CtaBand eyebrow={m.projects.helpEyebrow} title={m.projects.helpTitle}>
        <ButtonLink href={routes.contact} variant="gold" size="lg">
          {m.projects.helpCta}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
