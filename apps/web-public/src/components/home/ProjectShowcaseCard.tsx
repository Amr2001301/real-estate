import Link from 'next/link';
import type { Route } from 'next';
import { MapPin, ArrowLeft, Home } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, formatNumber, cityLabel } from '@/lib/format';
import type { PublicProjectListItem } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';

/**
 * Image-first showcase card: content overlaid on the cover image. `featured`
 * shows as a separate badge (not a status). No construction status is shown —
 * the public API doesn't expose it, so nothing is fabricated.
 */
export function ProjectShowcaseCard({ project }: { project: PublicProjectListItem }) {
  const name = pickAr(project.name, 'مشروع');

  return (
    <Link
      href={routes.project(project.id) as Route}
      className="group relative block h-full overflow-hidden rounded-3xl shadow-card outline-none transition-shadow duration-300 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <CoverImage src={project.coverImage} alt={name} className="h-full w-full" zoomOnHover />
      {/* Readability scrim — strong at the bottom for text, faint at the top for the badge */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(11,23,38,0.90) 0%, rgba(11,23,38,0.45) 32%, rgba(11,23,38,0.05) 60%, rgba(11,23,38,0.22) 100%)' }}
        aria-hidden
      />
      {project.featured && (
        <span className="absolute right-4 top-4 rounded-full bg-gold-400 px-3 py-1 text-xs font-medium text-navy shadow-soft">
          مميز
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="flex items-center gap-1.5 text-sm text-white/85">
          <MapPin className="h-4 w-4 text-gold-200" aria-hidden />
          {cityLabel(project.city)}
        </div>
        <h3 className="mt-1.5 line-clamp-1 text-2xl font-bold text-white">{name}</h3>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <Home className="h-3.5 w-3.5 text-gold-200" aria-hidden />
            {formatNumber(project.availableUnitsCount)} {project.availableUnitsCount === 1 ? 'وحدة متاحة' : 'وحدات متاحة'}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-200 transition-transform group-hover:-translate-x-1">
            عرض المشروع
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
