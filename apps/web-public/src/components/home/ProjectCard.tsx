import Link from 'next/link';
import type { Route } from 'next';
import { MapPin } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, formatNumber, projectPlace } from '@/lib/format';
import type { PublicProjectListItem } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import type { Locale } from '@/lib/locale';

/**
 * The project card (projects list, favourites): photo with «مميز» and the
 * project type; then place, name, a two-line description, three services,
 * and the available units with a link at the foot.
 */
export function ProjectCard({ project, locale = 'ar' }: { project: PublicProjectListItem; locale?: Locale }) {
  const t = extraT(locale).projectCard;
  const s = siteT(locale);
  const name = pickAr(project.name, t.defaultName, locale);
  const description = pickAr(project.description, '', locale);
  const place = projectPlace(name, project.district, project.city, locale);
  const typeLabel = project.type ? s.projectTypes[project.type] : null;
  const services = (project.services ?? []).map((x) => pickAr(x, '', locale)).filter(Boolean).slice(0, 3);
  const units = project.availableUnitsCount;

  return (
    <div className="relative h-full">
      <Link
        href={routes.project(project.id) as Route}
        className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface outline-none transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.28)] focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative isolate transform-gpu overflow-hidden" style={{ transform: 'translateZ(0)' }}>
          <CoverImage src={project.coverImage} alt={name} className="aspect-[4/3]" zoomOnHover />
          {project.featured && (
            <span className="absolute start-4 top-4 rounded-full bg-gold-400 px-3 py-1.5 text-xs font-semibold text-[#1B1206]">{t.featured}</span>
          )}
          {typeLabel && (
            <span className="absolute bottom-4 start-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{typeLabel}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6">
          {place && (
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-1">{place}</span>
            </p>
          )}
          <h3 className="mt-1 line-clamp-1 font-display text-[1.375rem] font-semibold leading-normal text-ink-strong">{name}</h3>
          {description && <p className="mt-1.5 line-clamp-2 text-sm leading-[1.8] text-ink-muted">{description}</p>}
          {services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {services.map((sv) => (
                <span key={sv} className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink">{sv}</span>
              ))}
            </div>
          )}
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between border-t border-hairline pt-4">
              <span className="text-sm text-ink-muted">
                {units > 0 ? (
                  <>
                    <b className="font-display text-lg font-semibold text-ink-strong">{formatNumber(units, locale)}</b> {s.listing.available}
                  </>
                ) : (
                  t.none
                )}
              </span>
              <span className="text-sm font-semibold text-navy transition-colors group-hover:text-navy-600 dark:text-gold-300">{s.listing.viewProject} ←</span>
            </div>
          </div>
        </div>
      </Link>
      <FavoriteButton kind="project" id={project.id} className="absolute end-3 top-3 z-20" />
    </div>
  );
}
