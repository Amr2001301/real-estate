import Link from 'next/link';
import type { Route } from 'next';
import { Building2, MapPin } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { cityLabel, formatNumber, pickAr } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SectionHead } from './SectionHead';

/** A project's services in the reader's language (at most `max`). */
function services(p: PublicProjectListItem, locale: Locale, max: number): string[] {
  return (p.services ?? []).map((s) => pickAr(s, '', locale)).filter(Boolean).slice(0, max);
}

/**
 * «المشاريع المختارة»: the first project large with its photo full-height and
 * the details over it, the next two as cards beside it.
 */
export function FeaturedProjects({
  result,
  locale,
}: {
  result: ApiResult<Paginated<PublicProjectListItem>>;
  locale: Locale;
}) {
  const m = siteT(locale).home.projects;
  const projects = result.ok ? result.data.data.slice(0, 3) : [];
  const [lead, ...side] = projects;

  return (
    <section className="pt-20 sm:pt-28">
      <Container>
        <SectionHead
          eyebrow={m.eyebrow}
          title={m.title}
          sub={m.sub}
          action={projects.length > 0 ? { href: routes.projects, label: m.viewAll } : undefined}
        />
        {!result.ok ? (
          <ErrorState title={m.errorTitle} message={m.errorMsg} className="mx-auto max-w-2xl" />
        ) : !lead ? (
          <EmptyState
            title={m.emptyTitle}
            message={m.emptyMsg}
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            className="mx-auto max-w-2xl"
          />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <LeadProject project={lead} locale={locale} />
            {side.length > 0 && (
              <div className="flex flex-1 flex-col gap-6">
                {side.map((p) => (
                  <SideProject key={p.id} project={p} locale={locale} />
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}

function LeadProject({ project, locale }: { project: PublicProjectListItem; locale: Locale }) {
  const m = siteT(locale).home.projects;
  const t = extraT(locale).projectCard;
  const name = pickAr(project.name, t.defaultName, locale);
  return (
    <div className="relative flex-[1.4]">
      <Link
        href={routes.project(project.id) as Route}
        className="group relative isolate block min-h-[480px] overflow-hidden rounded-[1.75rem] text-white outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 lg:h-full lg:min-h-[620px]"
      >
        <CoverImage src={project.coverImage} alt={name} className="absolute inset-0 -z-10 h-full" zoomOnHover />
        <span
          className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.45)_35%,rgba(0,0,0,0)_65%)]"
          aria-hidden
        />
        <div className="absolute start-4 top-4 flex gap-2">
          {project.featured && <span className="rounded-full bg-gold-400 px-3 py-1.5 text-xs font-semibold text-[#1B1206]">{t.featured}</span>}
        </div>
        <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-8">
          <p className="flex items-center gap-2 text-[15px] text-white/90">
            <MapPin className="h-4 w-4" aria-hidden />
            {cityLabel(project.city, locale)}
          </p>
          <h3 className="mt-2 font-display text-[1.875rem] font-semibold leading-[1.4] text-white sm:text-[2.5rem]">{name}</h3>
          {services(project, locale, 4).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {services(project, locale, 4).map((s) => (
                <span key={s} className="rounded-full bg-white/[0.18] px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{s}</span>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/25 pt-5">
            <span className="text-[15px]">
              <span className="font-display text-[1.75rem] font-semibold">{formatNumber(project.availableUnitsCount, locale)}</span> {m.available}
            </span>
            <span className="inline-flex h-11 items-center rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206]">{m.view}</span>
          </div>
        </div>
      </Link>
      <FavoriteButton kind="project" id={project.id} className="absolute end-4 top-4 z-20" />
    </div>
  );
}

function SideProject({ project, locale }: { project: PublicProjectListItem; locale: Locale }) {
  const m = siteT(locale).home.projects;
  const t = extraT(locale).projectCard;
  const name = pickAr(project.name, t.defaultName, locale);
  const list = services(project, locale, 3);
  return (
    <div className="relative flex flex-1">
      <Link
        href={routes.project(project.id) as Route}
        className="group flex flex-1 flex-col overflow-hidden rounded-3xl border border-hairline bg-surface outline-none transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.28)] focus-visible:ring-2 focus-visible:ring-gold-400/50"
      >
        <CoverImage src={project.coverImage} alt={name} className="h-[190px]" zoomOnHover />
        <div className="flex flex-1 flex-col gap-2 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="line-clamp-1 font-display text-[1.375rem] font-semibold text-ink-strong">{name}</h3>
            <span className="shrink-0 text-sm text-ink-muted">{cityLabel(project.city, locale)}</span>
          </div>
          {list.length > 0 && <p className="line-clamp-1 text-sm text-ink-muted">{list.join(' · ')}</p>}
          <div className="mt-auto flex items-center justify-between border-t border-hairline pt-3">
            <span className="text-sm text-ink-muted">
              <b className="text-base font-semibold text-ink-strong">{formatNumber(project.availableUnitsCount, locale)}</b> {m.available}
            </span>
            <span className="text-sm font-semibold text-navy transition-colors group-hover:text-navy-600 dark:text-gold-300">{m.details} ←</span>
          </div>
        </div>
      </Link>
      <FavoriteButton kind="project" id={project.id} className="absolute end-3 top-3 z-20" />
    </div>
  );
}
