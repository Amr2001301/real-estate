import { Building2 } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger } from '@/components/motion/Stagger';
import { ProjectCard } from './ProjectCard';

export function FeaturedProjects({ result }: { result: ApiResult<Paginated<PublicProjectListItem>> }) {
  const projects = result.ok ? result.data.data : [];

  return (
    <Section tone="canvas">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="مشاريع مختارة"
          title="وجهات سكنية تستحق الاهتمام"
          description="نخبة من المشاريع المنتقاة بعناية لتجمع بين الموقع المميز والتصميم الراقي."
        />
        <Reveal>
          <ButtonLink href={routes.projects} variant="outline" size="md">
            كل المشاريع
          </ButtonLink>
        </Reveal>
      </div>

      <div className="mt-12">
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
          <Stagger className="grid gap-7 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={90}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </Stagger>
        )}
      </div>
    </Section>
  );
}
