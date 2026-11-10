import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import type { ApiResult } from '@/lib/api';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { routes } from '@/lib/routes';
import { formatNumber, pickAr, projectPlace } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SectionHead } from './SectionHead';
import { DEEP_BG } from './Hero';

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

/** The project type's label (سكني، إداري، …), when the company set one. */
function typeOf(p: PublicProjectListItem, locale: Locale): string | null {
  return p.type ? siteT(locale).projectTypes[p.type] ?? null : null;
}

function LeadProject({ project, locale }: { project: PublicProjectListItem; locale: Locale }) {
  const m = siteT(locale).home.projects;
  const t = extraT(locale).projectCard;
  const name = pickAr(project.name, t.defaultName, locale);
  const place = projectPlace(name, project.district, project.city, locale);
  const description = pickAr(project.description, '', locale);
  const type = typeOf(project, locale);
  const list = services(project, locale, 3);
  const hasPhoto = Boolean(project.coverImage?.trim());

  return (
    <div className="relative flex-[1.4]">
      <Link
        href={routes.project(project.id) as Route}
        className="group relative isolate block min-h-[500px] overflow-hidden rounded-[1.75rem] text-white outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 lg:h-full lg:min-h-[620px]"
        style={hasPhoto ? undefined : { background: DEEP_BG }}
      >
        {hasPhoto ? (
          <>
            <CoverImage src={project.coverImage} alt={name} className="absolute inset-0 -z-10 h-full" zoomOnHover />
            <span className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.45)_38%,rgba(0,0,0,0)_68%)]" aria-hidden />
          </>
        ) : (
          // No photo yet: the company's deep colour with a fine architectural grid
          // and a large outline mark — reads as intentional, not as an empty box.
          <span className="absolute inset-0 -z-10" aria-hidden>
            <span
              className="absolute inset-0 opacity-[0.10]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
            />
            <span className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 80% 10%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} />
            <Building2 className="absolute end-10 top-16 h-40 w-40 text-white/[0.12]" strokeWidth={0.8} />
          </span>
        )}
        <div className="absolute start-5 top-5 flex flex-wrap gap-2">
          {project.featured && <span className="rounded-full bg-gold-400 px-3 py-1.5 text-xs font-semibold text-[#1B1206]">{t.featured}</span>}
          {type && <span className="rounded-full bg-white/[0.16] px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">{type}</span>}
        </div>
        <div className="absolute inset-x-6 bottom-6 sm:inset-x-9 sm:bottom-9">
          {place && (
            <p className="flex items-center gap-2 text-[15px] text-white/85">
              <MapPin className="h-4 w-4" aria-hidden />
              {place}
            </p>
          )}
          <h3 className="mt-2 font-display text-[1.875rem] font-semibold leading-[1.35] text-white sm:text-[2.6rem]">{name}</h3>
          {description && <p className="mt-2 line-clamp-2 max-w-xl text-[15px] leading-[1.85] text-white/75">{description}</p>}
          {list.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {list.map((sv) => (
                <span key={sv} className="rounded-full bg-white/[0.14] px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur">{sv}</span>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-5">
            <span className="text-[15px] text-white/85">
              <span className="font-display text-[2rem] font-semibold text-white">{formatNumber(project.availableUnitsCount, locale)}</span> {m.available}
            </span>
            <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gold-400 px-6 text-[15px] font-semibold text-[#1B1206] transition-colors group-hover:bg-gold-300">
              {m.view}
              <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
            </span>
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
  const place = projectPlace(name, project.district, project.city, locale);
  const type = typeOf(project, locale);
  const list = services(project, locale, 3);
  return (
    <div className="relative flex flex-1">
      <Link
        href={routes.project(project.id) as Route}
        className="group flex flex-1 flex-col overflow-hidden rounded-3xl border border-hairline bg-surface outline-none transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-[0_28px_56px_-28px_rgba(0,0,0,0.32)] focus-visible:ring-2 focus-visible:ring-gold-400/50 sm:flex-row"
      >
        <CoverImage src={project.coverImage} alt={name} className="h-52 shrink-0 sm:h-auto sm:min-h-[240px] sm:w-[44%]" zoomOnHover />
        <div className="flex flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
          {type && (
            <span className="self-start rounded-full bg-navy/[0.08] px-3 py-1 text-xs font-semibold text-navy dark:bg-gold-400/15 dark:text-gold-300">{type}</span>
          )}
          <h3 className="mt-3 line-clamp-2 font-display text-[1.375rem] font-semibold leading-snug text-ink-strong">{name}</h3>
          {place && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-1">{place}</span>
            </p>
          )}
          {list.length > 0 && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{list.join(' · ')}</p>}
          <div className="mt-auto flex items-center justify-between pt-5">
            <span className="text-sm text-ink-muted">
              <b className="font-display text-xl font-semibold text-ink-strong">{formatNumber(project.availableUnitsCount, locale)}</b> {m.available}
            </span>
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5"
              style={{ background: DEEP_BG }}
              aria-hidden
            >
              <ArrowLeft className="h-[18px] w-[18px] ltr:rotate-180" />
            </span>
          </div>
        </div>
      </Link>
      <FavoriteButton kind="project" id={project.id} className="absolute end-3 top-3 z-20" />
    </div>
  );
}
