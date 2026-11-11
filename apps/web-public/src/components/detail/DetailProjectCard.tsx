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

/**
 * «الوحدة جزء من…»: the unit's project as a wide banner — its photo, name,
 * place and type, a line about it, what it offers and how many units are
 * still available — leading to the project page.
 */
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
      className="group relative isolate block min-h-[240px] overflow-hidden rounded-[1.75rem] text-white"
      data-testid="unit-project-card"
    >
      <CoverImage src={cover} alt={name} className="absolute inset-0 -z-10 h-full" zoomOnHover />
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(270deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.6)_45%,rgba(0,0,0,.1)_100%)] ltr:bg-[linear-gradient(90deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.6)_45%,rgba(0,0,0,.1)_100%)]" aria-hidden />
      <div className="flex min-h-[240px] max-w-xl flex-col justify-center p-6 sm:p-9">
        <p className="flex flex-wrap items-center gap-x-2 text-[15px] text-white/80">
          <MapPin className="h-4 w-4" aria-hidden />
          {[place, type].filter(Boolean).join(' · ')}
        </p>
        <h3 className="mt-2 font-display text-white text-[1.6rem] font-semibold leading-[1.3] sm:text-[2rem]">{name}</h3>
        {description && <p className="mt-2 line-clamp-2 text-[15px] leading-[1.9] text-white/75">{description}</p>}
        {services.length > 0 && (
          <p className="mt-3 text-sm text-white/70">{services.join('  ·  ')}</p>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206] transition-colors group-hover:bg-gold-300">
            {t.unitPage.explore}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
          </span>
          <span className="text-[15px] text-white/80">
            <b className="font-display text-2xl font-semibold text-white">{formatNumber(project.availableUnitsCount, locale)}</b> {s.home.projects.available}
          </span>
        </div>
      </div>
    </Link>
  );
}
