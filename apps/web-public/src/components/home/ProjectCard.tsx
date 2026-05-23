import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, MapPin } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr } from '@/lib/format';
import type { PublicProjectListItem } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Badge } from '@/components/ui/Badge';
import { CoverImage } from '@/components/ui/CoverImage';

export function ProjectCard({ project }: { project: PublicProjectListItem }) {
  const name = pickAr(project.name, 'مشروع');
  const description = pickAr(project.description);

  return (
    <Link
      href={routes.project(project.id) as Route}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <PremiumCard interactive className="flex h-full flex-col overflow-hidden">
        <CoverImage src={project.coverImage} alt={name} className="aspect-[4/3]" zoomOnHover />
        <div className="flex flex-1 flex-col p-6 sm:p-7">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="h-4 w-4 text-gold-500" aria-hidden />
            {project.city}
          </div>
          <h3 className="mt-2 line-clamp-1 text-xl font-semibold text-navy">{name}</h3>
          {/* Reserve two lines so short descriptions don't shrink the card. */}
          <p className="mt-2 line-clamp-2 min-h-[2.75rem] text-sm leading-relaxed text-ink-muted">
            {description || ' '}
          </p>
          <div className="mt-auto flex items-center justify-between pt-6">
            <Badge tone="gold">{project.availableUnitsCount} وحدة متاحة</Badge>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-navy transition-colors group-hover:text-gold-600">
              تفاصيل المشروع
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden />
            </span>
          </div>
        </div>
      </PremiumCard>
    </Link>
  );
}
