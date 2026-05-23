import { Scale } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import type { PublicUnit } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { CtaBand } from '@/components/marketing/CtaBand';
import { ButtonLink } from '@/components/ui/Button';
import { PageHero } from '@/components/layout/PageHero';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { CompareView } from '@/components/compare/CompareView';

const MAX = 3;
const REVALIDATE = 60;

export const metadata = buildMetadata({
  title: 'مقارنة الوحدات',
  description: 'قارن بين الوحدات المختارة جنبًا إلى جنب — السعر والمساحة والغرف والمزيد في مكان واحد.',
  robots: { index: false, follow: true },
});

type SearchParams = Promise<{ ids?: string | string[] }>;

function parseIds(raw: string | string[] | undefined): string[] {
  const joined = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const seen = new Set<string>();
  for (const part of joined.split(',')) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen].slice(0, MAX);
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);

  const results = await Promise.all(
    ids.map((id) => safeFetch<PublicUnit>(`/public/units/${id}`, { revalidate: REVALIDATE })),
  );
  const units = results.flatMap((r) => (r.ok ? [r.data] : []));
  const failedCount = ids.length - units.length;

  return (
    <>
      <PageHero
        eyebrow="مقارنة الوحدات"
        title="قارن اختياراتك بثقة"
        subtitle="اجمع أهم التفاصيل في مكان واحد لتختار الوحدة الأقرب لأسلوب حياتك واستثمارك."
      />

      <Section tone="canvas">
        {ids.length === 0 ? (
          <EmptyState
            title="لم تختر أي وحدات للمقارنة بعد"
            message="استعرض الوحدات وأضف حتى ٣ وحدات لمقارنتها جنبًا إلى جنب."
            icon={<Scale className="h-6 w-6" aria-hidden />}
            className="mx-auto max-w-2xl"
            action={
              <ButtonLink href={routes.units} variant="primary" size="md">
                استعرض الوحدات
              </ButtonLink>
            }
          />
        ) : units.length === 0 ? (
          <ErrorState
            title="لم نتمكن من تحميل الوحدات المحددة حاليًا"
            message="حاول مرة أخرى بعد لحظات، أو اختر وحدات أخرى للمقارنة."
            className="mx-auto max-w-2xl"
          />
        ) : (
          <>
            {failedCount > 0 && (
              <div className="mb-8">
                <InlineNotice tone="warning">
                  تعذر تحميل بعض الوحدات، وتم عرض المتاح منها.
                </InlineNotice>
              </div>
            )}
            <CompareView units={units} />
          </>
        )}
      </Section>

      <CtaBand eyebrow="بحاجة إلى مساعدة في الاختيار؟" title="مستشارونا جاهزون لمساعدتك على القرار الأنسب">
        <ButtonLink href={routes.contact} variant="gold" size="lg">
          تواصل مع مستشار
        </ButtonLink>
      </CtaBand>
    </>
  );
}
