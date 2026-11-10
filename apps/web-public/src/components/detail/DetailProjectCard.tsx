import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { PublicProjectDetail } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { formatNumber, pickAr, projectPlace } from '@/lib/format';
import { routes } from '@/lib/routes';
import { siteT } from '@/messages/site';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';

/** The project a unit belongs to: its photo beside its name, place, type, services and available units. */
export function DetailProjectCard({ project, locale }: { project: PublicProjectDetail; locale: Locale }) {
  const s = siteT(locale);
  const t = extraT(locale);
  const name = pickAr(project.name, t.projectCard.defaultName, locale);
  const place = projectPlace(name, project.district, project.city, locale);
  const type = project.type ? s.projectTypes[project.type] : null;
  const description = pickAr(project.description, '', locale);
  const cover = project.media?.find((m) => m.type === 'IMAGE' || !m.type)?.url ?? null;
  const services = (project.services ?? []).map((x) => pickAr(x, '', locale)).filter(Boolean).slice(0, 3);

  return (
    <Link
      href={routes.project(project.id) as Route}
      className="group grid overflow-hidden rounded-[1.5rem] border border-hairline bg-surface transition-shadow hover:shadow-[0_28px_56px_-30px_rgba(0,0,0,0.35)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      data-testid="unit-project-card"
    >
      <div className="relative h-56 sm:h-auto sm:min-h-[260px]">
        <CoverImage src={cover} alt={name} className="absolute inset-0 h-full" zoomOnHover />
        {type && <span className="absolute start-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1A1F1C]">{type}</span>}
      </div>
      <div className="flex flex-col p-6 sm:p-7">
        {place && (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {place}
          </p>
        )}
        <h3 className="mt-1.5 font-display text-[1.5rem] font-semibold leading-snug text-ink-strong">{name}</h3>
        {description && <p className="mt-2 line-clamp-2 text-[15px] leading-[1.85] text-ink-muted">{description}</p>}
        {services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {services.map((sv) => (
              <span key={sv} className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink">{sv}</span>
            ))}
          </div>
        )}
        <div className="mt-auto pt-5"><div className="flex items-center justify-between gap-4 border-t border-hairline pt-4">
          <span className="text-sm text-ink-muted">
            <b className="font-display text-xl font-semibold text-ink-strong">{formatNumber(project.availableUnitsCount, locale)}</b> {s.home.projects.available}
          </span>
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-navy dark:text-gold-300">
            {s.unitDetail.viewProject}
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180" aria-hidden />
          </span>
        </div></div>
      </div>
    </Link>
  );
}
