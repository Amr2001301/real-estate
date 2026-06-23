import Link from 'next/link';
import type { Route } from 'next';
import { MapPin, Home } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, formatNumber, cityLabel } from '@/lib/format';
import type { PublicProjectListItem } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

export function ProjectShowcaseCard({ project }: { project: PublicProjectListItem }) {
  const name = pickAr(project.name, 'مشروع');

  return (
    <div className="relative h-full">
      <Link
        href={routes.project(project.id) as Route}
        className="group relative block h-full overflow-hidden rounded-3xl shadow-card outline-none transition-shadow duration-300 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <CoverImage src={project.coverImage} alt={name} className="h-full w-full" zoomOnHover />
        {/* Readability scrim */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(11,23,38,0.92) 0%, rgba(11,23,38,0.48) 34%, rgba(11,23,38,0.06) 60%, rgba(11,23,38,0.24) 100%)' }}
          aria-hidden
        />
        {project.featured && (
          <span className="absolute right-4 top-4 rounded-full bg-gold-400 px-3 py-1 text-xs font-semibold text-navy shadow-soft">
            مميز
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-center gap-1.5 text-sm text-white/80">
            <MapPin className="h-3.5 w-3.5 text-gold-200" aria-hidden />
            {cityLabel(project.city)}
          </div>
          <h3 className="mt-1.5 line-clamp-1 text-xl font-bold text-white">{name}</h3>
          <div className="mt-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Home className="h-3.5 w-3.5 text-gold-200" aria-hidden />
              {formatNumber(project.availableUnitsCount)}{' '}
              {project.availableUnitsCount === 1 ? 'وحدة متاحة' : 'وحدات متاحة'}
            </span>
            <span className="text-sm font-semibold text-gold-200 transition-opacity group-hover:opacity-80">
              عرض المشروع
            </span>
          </div>
        </div>
      </Link>
      <FavoriteButton kind="project" id={project.id} className="absolute left-4 top-4 z-20" />
    </div>
  );
}
