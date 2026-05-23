import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { Paginated, PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { PageHero } from '@/components/layout/PageHero';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { Pagination } from '@/components/projects/Pagination';
import { UnitsFilterBar, type UnitsFilterValues } from '@/components/units/UnitsFilterBar';
import { UnitsExplorer } from '@/components/units/UnitsExplorer';
import { derivePriceValue } from '@/lib/unit-filters';

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
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const apiParams = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (projectId) apiParams.set('projectId', projectId);
  if (city) apiParams.set('city', city);
  if (type) apiParams.set('type', type);
  if (bedrooms) apiParams.set('bedrooms', bedrooms);
  if (bathrooms) apiParams.set('bathrooms', bathrooms);
  if (status) apiParams.set('status', status);
  if (priceMin) apiParams.set('priceMin', priceMin);
  if (priceMax) apiParams.set('priceMax', priceMax);

  const result = await safeFetch<Paginated<PublicUnit>>(`/public/units?${apiParams.toString()}`, {
    revalidate: REVALIDATE,
  });

  const units = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const hasFilters = Boolean(type || bedrooms || bathrooms || status || priceMin || priceMax || city || projectId);

  const initialFilters: UnitsFilterValues = {
    projectId,
    city,
    type,
    bedrooms,
    bathrooms,
    price: derivePriceValue(priceMin, priceMax),
    status,
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
        eyebrow="الوحدات السكنية"
        title="وحدات فاخرة جاهزة لاختيارك"
        subtitle="اكتشف مجموعة مختارة من الشقق والفيلات المصممة لتناسب أسلوب حياتك واستثمارك."
        stats={meta ? [{ value: formatNumber(meta.total), label: 'وحدة متاحة' }] : undefined}
      />

      <Section tone="canvas">
        <UnitsFilterBar initial={initialFilters} />

        <div className="mt-12">
          {!result.ok ? (
            <ErrorState
              title="لم نتمكن من تحميل الوحدات حاليًا"
              message="يرجى المحاولة مرة أخرى بعد لحظات."
              className="mx-auto max-w-2xl"
            />
          ) : units.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'لا توجد وحدات مطابقة للفلاتر الحالية' : 'لا توجد وحدات متاحة حاليًا'}
              message={
                hasFilters
                  ? 'جرّب تعديل الفلاتر أو مسحها لعرض جميع الوحدات.'
                  : 'تواصل مع مستشار لمعرفة أحدث الإتاحات.'
              }
              className="mx-auto max-w-2xl"
              action={
                hasFilters ? (
                  <ButtonLink href={routes.units} variant="outline" size="md">
                    مسح الفلاتر
                  </ButtonLink>
                ) : (
                  <ButtonLink href={routes.contact} variant="outline" size="md">
                    تواصل مع مستشار
                  </ButtonLink>
                )
              }
            />
          ) : (
            <>
              {meta && (
                <p className="mb-6 text-sm text-ink-muted">
                  عرض {units.length} من أصل {formatNumber(meta.total)} وحدة
                </p>
              )}
              <UnitsExplorer units={units} />
              {meta && <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />}
            </>
          )}
        </div>
      </Section>

      <Section tone="navy">
        <div className="flex flex-col items-center text-center">
          <SectionHeading invert align="center" eyebrow="بحاجة إلى مساعدة؟" title="دع مستشارينا يساعدونك في الاختيار" />
          <div className="mt-8">
            <ButtonLink href={routes.contact} variant="gold" size="lg">
              تواصل مع مستشار
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
