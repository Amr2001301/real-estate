import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { CtaBand } from '@/components/marketing/CtaBand';
import { PageHero } from '@/components/layout/PageHero';
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

type SearchParams = Promise<{ q?: string; featured?: string; page?: string }>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = firstStr(sp.q).trim();
  const featured = firstStr(sp.featured) === 'true';
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);

  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page) });
  if (q) params.set('q', q);
  if (featured) params.set('featured', 'true');

  const result = await safeFetch<Paginated<PublicProjectListItem>>(
    `/public/projects?${params.toString()}`,
    { revalidate: REVALIDATE },
  );

  const projects = result.ok ? result.data.data : [];
  const meta = result.ok ? result.data.meta : null;
  const hasFilters = q !== '' || featured;

  function buildHref(nextPage: number): string {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (featured) p.set('featured', 'true');
    if (nextPage > 1) p.set('page', String(nextPage));
    const qs = p.toString();
    return qs ? `${routes.projects}?${qs}` : routes.projects;
  }

  return (
    <>
      <PageHero
        eyebrow="مشاريع مختارة"
        title="اكتشف مشاريعنا الاستثنائية"
        subtitle="مجموعة منتقاة من المشاريع السكنية والتجارية المصممة لأسلوب حياة أرقى."
        stats={meta ? [{ value: formatNumber(meta.total), label: 'مشروع متاح' }] : undefined}
      />

      <Section tone="canvas">
        <ProjectsFilterBar initialQ={q} initialFeatured={featured} />

        <div className="mt-12">
          {!result.ok ? (
            <ErrorState
              title="لم نتمكن من تحميل المشاريع حاليًا"
              message="تأكد من تشغيل الخادم أو حاول مرة أخرى بعد لحظات."
              className="mx-auto max-w-2xl"
            />
          ) : projects.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'لا توجد مشاريع مطابقة للبحث حاليًا' : 'لا توجد مشاريع منشورة حاليًا'}
              message={
                hasFilters
                  ? 'جرّب تعديل كلمات البحث أو إزالة الفلاتر لعرض جميع المشاريع.'
                  : 'سيتم عرض المشاريع فور إتاحتها.'
              }
              className="mx-auto max-w-2xl"
              action={
                hasFilters ? (
                  <ButtonLink href={routes.projects} variant="outline" size="md">
                    مسح الفلاتر
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <>
              {meta && (
                <p className="mb-6 text-sm text-ink-muted">
                  عرض {projects.length} من أصل {formatNumber(meta.total)} مشروع
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
        </div>
      </Section>

      <CtaBand eyebrow="بحاجة إلى مساعدة؟" title="دع مستشارينا يرشدونك إلى المشروع الأنسب">
        <ButtonLink href={routes.contact} variant="gold" size="lg">
          تواصل مع مستشار
        </ButtonLink>
      </CtaBand>
    </>
  );
}
