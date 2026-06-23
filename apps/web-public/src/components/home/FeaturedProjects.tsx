import Link from 'next/link';
import { Building2 } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Stagger } from '@/components/motion/Stagger';
import { ProjectCard } from './ProjectCard';

export function FeaturedProjects({ result }: { result: ApiResult<Paginated<PublicProjectListItem>> }) {
  const projects = result.ok ? result.data.data.slice(0, 3) : [];

  return (
    <Section tone="canvas" className="py-12 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink-strong lg:text-4xl">المشاريع المختارة</h2>
          <p className="mt-2 text-ink-muted">
            مشاريع منتقاة تجمع بين الموقع، الجودة، وفرص الاستثمار الواعدة.
          </p>
        </div>
        <Link
          href={routes.projects}
          className="shrink-0 text-sm font-semibold text-gold-600 underline-offset-4 transition-colors hover:text-gold-700 hover:underline"
        >
          عرض جميع المشاريع
        </Link>
      </div>

      <div className="mt-8">
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
          <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </Stagger>
        )}
      </div>
    </Section>
  );
}
