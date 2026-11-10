import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { ContactCta } from '@/components/marketing/ContactCta';
import { ButtonLink } from '@/components/ui/Button';
import { ListHero, type ListHeroStat } from '@/components/layout/ListHero';
import { fetchBranding } from '@/lib/branding';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { Pagination } from '@/components/projects/Pagination';
import { currencySymbol, formatCompact, formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import { UnitsFilterBar, UnitsToolbar, type UnitsFilterValues } from '@/components/units/UnitsFilterBar';
import { UnitsExplorer } from '@/components/units/UnitsExplorer';
import { derivePriceValue, deriveAreaValue } from '@/lib/unit-filters';

export async function generateMetadata() {
  return pageMeta('units', { path: '/units' });
}

const PAGE_SIZE = 9;
const REVALIDATE = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

// Compare ids carried over from /compare (?compareIds=A,B). Dedupe + trim and
// cap at the 3-unit compare limit (mirrors MAX_COMPARE in CompareContext).
const COMPARE_MAX = 3;
function parseCompareIds(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen].slice(0, COMPARE_MAX);
}

/** The "handed over by" date for a delivery choice ('now' | years ahead). */
function deliveryByDate(choice: string): string | null {
  if (!choice) return null;
  const d = new Date();
  if (choice !== 'now') {
    const years = Number(choice);
    if (!Number.isInteger(years) || years < 1 || years > 10) return null;
    d.setUTCFullYear(d.getUTCFullYear() + years);
  }
  return d.toISOString().slice(0, 10);
}

export default async function UnitsPage({ searchParams }: { searchParams: SearchParams }) {
  const [tenant, sp] = await Promise.all([getResolvedTenant(), searchParams]);
  if (!tenant) notFound();
  const projectId = firstStr(sp.projectId);
  const city = firstStr(sp.city);
  const type = firstStr(sp.type);
  const usage = firstStr(sp.usage);
  const finishing = firstStr(sp.finishing);
  const delivery = firstStr(sp.delivery);
  const bedrooms = firstStr(sp.bedrooms);
  const bathrooms = firstStr(sp.bathrooms);
  const status = firstStr(sp.status);
  const priceMin = firstStr(sp.priceMin);
  const priceMax = firstStr(sp.priceMax);
  const areaMin = firstStr(sp.areaMin);
  const areaMax = firstStr(sp.areaMax);
  const sort = firstStr(sp.sort);
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);
  const seedCompareIds = parseCompareIds(firstStr(sp.compareIds));

  const apiParams = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (projectId) apiParams.set('projectId', projectId);
  if (city) apiParams.set('city', city);
  if (type) apiParams.set('type', type);
  if (usage) apiParams.set('usage', usage);
  if (finishing) apiParams.set('finishing', finishing);
  // Handover: ready now (by today), or within N years.
  const deliveryBy = deliveryByDate(delivery);
  if (deliveryBy) apiParams.set('deliveryBy', deliveryBy);
  if (bedrooms) apiParams.set('bedrooms', bedrooms);
  if (bathrooms) apiParams.set('bathrooms', bathrooms);
  if (status) apiParams.set('status', status);
  if (priceMin) apiParams.set('priceMin', priceMin);
  if (priceMax) apiParams.set('priceMax', priceMax);
  if (areaMin) apiParams.set('areaMin', areaMin);
  if (areaMax) apiParams.set('areaMax', areaMax);
  if (sort) apiParams.set('sort', sort);

  const [result, locale, typesRes, projectsRes, citiesRes, cheapestRes, branding] = await Promise.all([
    apiFetch<Paginated<PublicUnit>>(`/public/units?${apiParams.toString()}`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    getLocale(),
    // The company's own unit types (F10) for the type filter.
    apiFetch<Array<{ code: string; name: string | { ar?: string; en?: string } }>>('/public/unit-types', {
      revalidate: REVALIDATE,
      tenantSlug: tenant.slug,
    }),
    // The company's projects (the project filter and the header's count).
    apiFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=50', { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    apiFetch<{ cities: string[] }>('/public/projects/cities', { revalidate: 300, tenantSlug: tenant.slug }),
    // The lowest price on the site, for «تبدأ من».
    apiFetch<Paginated<PublicUnit>>('/public/units?pageSize=1&sort=price_asc', { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    fetchBranding(tenant.slug),
  ]);
  const typeOptions = typesRes.ok
    ? typesRes.data.map((t) => ({ value: t.code, label: unitTypeLabel(t.code, t.name) }))
    : undefined;
  const m = siteT(locale);

  const units = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const hasFilters = Boolean(
    type || usage || finishing || delivery || bedrooms || bathrooms || status || priceMin || priceMax || areaMin || areaMax || city || projectId,
  );

  const initialFilters: UnitsFilterValues = {
    projectId,
    city,
    type,
    usage,
    bedrooms,
    bathrooms,
    price: derivePriceValue(priceMin, priceMax),
    area: deriveAreaValue(areaMin, areaMax),
    finishing,
    delivery,
    status,
    sort,
  };

  function buildHref(nextPage: number): string {
    const p = new URLSearchParams(apiParams);
    p.delete('pageSize');
    if (nextPage > 1) p.set('page', String(nextPage));
    else p.delete('page');
    const qs = p.toString();
    return qs ? `${routes.units}?${qs}` : routes.units;
  }

  const projectOptions = projectsRes.ok
    ? projectsRes.data.data.map((p) => ({ value: p.id, label: pickAr(p.name, '', locale) })).filter((p) => p.label)
    : [];
  const cities = citiesRes.ok ? citiesRes.data.cities : [];
  const cheapest = cheapestRes.ok ? cheapestRes.data.data[0]?.price : undefined;
  const statsAll: Array<ListHeroStat | null> = [
    cheapestRes.ok ? { value: formatNumber(cheapestRes.data.meta.total, locale), label: m.listing.unitsStat } : null,
    projectsRes.ok ? { value: formatNumber(projectsRes.data.meta.total, locale), label: m.listing.projectsStat } : null,
    cheapest ? { value: formatCompact(cheapest, locale), label: m.listing.fromStat(currencySymbol(branding?.currency ?? 'EGP', locale)) } : null,
  ];
  const stats = statsAll.filter((x): x is ListHeroStat => x !== null);
  const photo = units.find((u) => u.coverImage)?.coverImage ?? null;

  return (
    <>
      <ListHero homeLabel={m.listing.home} title={m.units.title} subtitle={m.units.subtitle} stats={stats} />

      {/* Filter bar overlapping the header's lower edge, like the homepage search. */}
      <Container className="relative z-20 -mt-14 px-6 sm:px-10 lg:px-12">
        <UnitsFilterBar initial={initialFilters} types={typeOptions} projects={projectOptions} cities={cities} locale={locale} />
      </Container>

      <Container className="pt-8">
        {!result.ok ? (
          <ErrorState title={m.units.errorTitle} message={m.units.errorMsg} className="mx-auto max-w-2xl" />
        ) : units.length === 0 ? (
          <EmptyState
            title={hasFilters ? m.units.emptyFiltered : m.units.emptyAll}
            message={hasFilters ? m.units.emptyFilteredMsg : m.units.emptyAllMsg}
            className="mx-auto max-w-2xl"
            action={
              hasFilters ? (
                <ButtonLink href={routes.units} variant="outline" size="md">
                  {m.units.clearFilters}
                </ButtonLink>
              ) : (
                <ButtonLink href={routes.contact} variant="outline" size="md">
                  {m.units.advisor}
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <UnitsToolbar values={initialFilters} shown={units.length} total={meta?.total ?? units.length} locale={locale} />
            <UnitsExplorer units={units} seedCompareIds={seedCompareIds} />
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} locale={locale} />}
          </>
        )}
      </Container>

      <ContactCta locale={locale} branding={branding} image={photo} />
    </>
  );
}
