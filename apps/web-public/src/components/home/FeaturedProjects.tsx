import Link from 'next/link';
import { Building2, ArrowLeft } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { ProjectsCarousel } from './ProjectsCarousel';

export function FeaturedProjects({ result }: { result: ApiResult<Paginated<PublicProjectListItem>> }) {
  const projects = result.ok ? result.data.data : [];

  return (
    <Section tone="canvas" className="py-10 sm:py-12 lg:py-14">
      {/* Two-level header: title + subtitle (start) · simple text link (end) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink-strong lg:text-4xl">المشاريع المختارة</h2>
          <p className="mt-2 text-ink-muted">
            مشاريع منتقاة تجمع بين الموقع، الجودة، وفرص الاستثمار الواعدة.
          </p>
        </div>
        <Link
          href={routes.projects}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-strong underline-offset-8 transition-colors hover:text-gold-600 hover:underline"
        >
          عرض جميع المشاريع
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden />
        </Link>
      </div>

      <div className="mt-6">
        {!result.ok ? (
          <ErrorState
            title="لم نتمكن من تحميل المشاريع حاليًا"
            message="تأكد من تشغيل الخادم أو حاول مرة أخرى بعد لحظات."
            className="mx-auto max-w-2xl"
          />
        ) : projects.length === 0 ? (
          <EmptyState
            title="لا توجد مشاريع منشورة حاليًا"
            message="سيتم عرض المشاريع فور إتاحتها."
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            className="mx-auto max-w-2xl"
          />
        ) : (
          <ProjectsCarousel projects={projects} />
        )}
      </div>
    </Section>
  );
}
