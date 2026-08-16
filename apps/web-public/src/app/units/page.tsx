import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import type { Paginated, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Section } from '@/components/ui/Section';
import { CtaBand } from '@/components/marketing/CtaBand';
import { ButtonLink } from '@/components/ui/Button';
import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { Pagination } from '@/components/projects/Pagination';
import { UnitsFilterBar, type UnitsFilterValues } from '@/components/units/UnitsFilterBar';
import { UnitsExplorer } from '@/components/units/UnitsExplorer';
import { derivePriceValue, deriveAreaValue } from '@/lib/unit-filters';

export const metadata = buildMetadata({
  path: '/units',
  title: 'الوحدات المتاحة',
  description:
    'تصفّح مجموعة مختارة من الشقق والفيلات الفاخرة المتاحة — مواصفات راقية وأسعار شفافة وإمكانية المقارنة بين الوحدات.',
});

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

export default async function UnitsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const projectId = firstStr(sp.projectId);
  const city = firstStr(sp.city);
  const type = firstStr(sp.type);
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
  if (bedrooms) apiParams.set('bedrooms', bedrooms);
  if (bathrooms) apiParams.set('bathrooms', bathrooms);
  if (status) apiParams.set('status', status);
  if (priceMin) apiParams.set('priceMin', priceMin);
  if (priceMax) apiParams.set('priceMax', priceMax);
  if (areaMin) apiParams.set('areaMin', areaMin);
  if (areaMax) apiParams.set('areaMax', areaMax);
  if (sort) apiParams.set('sort', sort);

  const [result, locale] = await Promise.all([
    safeFetch<Paginated<PublicUnit>>(`/public/units?${apiParams.toString()}`, { revalidate: REVALIDATE }),
    getLocale(),
  ]);
  const m = siteT(locale);

  const units = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const hasFilters = Boolean(
    type || bedrooms || bathrooms || status || priceMin || priceMax || areaMin || areaMax || city || projectId,
  );

  const initialFilters: UnitsFilterValues = {
    projectId,
    city,
    type,
    bedrooms,
    bathrooms,
    price: derivePriceValue(priceMin, priceMax),
    area: deriveAreaValue(areaMin, areaMax),
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

  return (
    <>
      <PageHero
        eyebrow={m.units.eyebrow}
        title={m.units.title}
        subtitle={m.units.subtitle}
        overlap
      />

      {/* Filter bar overlapping the hero's lower edge — unified with the homepage. */}
      <Container className="relative z-10 -mt-12 sm:-mt-14">
        <UnitsFilterBar initial={initialFilters} locale={locale} />
      </Container>

      <Section tone="canvas" className="pt-12 pb-12 sm:pt-14 lg:pb-16">
          {!result.ok ? (
            <ErrorState
              title={m.units.errorTitle}
              message={m.units.errorMsg}
              className="mx-auto max-w-2xl"
            />
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
              {meta && (
                <p className="mb-6 text-sm text-ink-muted">
                  {m.units.showing(units.length, meta.total)}
                </p>
              )}
              <UnitsExplorer units={units} seedCompareIds={seedCompareIds} />
              {meta && <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />}
            </>
          )}
      </Section>

      <CtaBand eyebrow={m.units.helpEyebrow} title={m.units.helpTitle}>
        <ButtonLink href={routes.contact} variant="gold" size="lg">
          {m.units.advisor}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
