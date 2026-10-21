import Link from 'next/link';
import { MapPin, CalendarRange, Star, Layers, Building2, ArrowUpRight } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';
import { tx, formatDate, intlLocale } from '@/lib/format';
import { ProjectImageLightbox } from '@/components/broker/project-image-lightbox';
import { cn } from '@/lib/cn';

/**
 * One project the broker may market: a cover (or a quiet navy/gold leaf when
 * there is none), the essentials, and the broker's own figures — commission
 * and units still available — beside a single "browse units" action.
 */
export function ProjectCard({
  p,
  symbol,
  locale = 'ar',
  defaultPct,
  available,
}: {
  p: PortalProject;
  symbol: string;
  locale?: Locale;
  /** The firm's default commission %, used when the project sets none. */
  defaultPct?: number | null;
  /** Units still AVAILABLE in this project, when known. */
  available?: number | null;
}) {
  const t = portalSharedT(locale).projectCard;
  const en = locale === 'en';
  const commissionPct =
    p.access.commissionPct !== null && p.access.commissionPct !== undefined
      ? Number(p.access.commissionPct) : null;
  const fixedAmount =
    p.access.fixedAmountPerUnit !== null && p.access.fixedAmountPerUnit !== undefined
      ? Number(p.access.fixedAmountPerUnit) : null;

  // The project's own terms first; otherwise the firm's default rate applies.
  const usesDefault = commissionPct === null && fixedAmount === null;
  const commission = commissionPct !== null
    ? `${commissionPct.toFixed(2)}%`
    : fixedAmount !== null
      ? `${fixedAmount.toLocaleString(intlLocale(locale))} ${symbol}`
      : defaultPct !== null && defaultPct !== undefined
        ? `${defaultPct.toFixed(2)}%`
        : null;

  const name        = tx(p.project.name, locale);
  const description = tx(p.project.description, locale);
  const services    = (p.project.services ?? []).map((s) => tx(s, locale)).filter(Boolean);
  const media       = p.project.media ?? [];
  const hasDates    = p.access.startsAt || p.access.endsAt;

  return (
    <article
      data-testid="portal-project-card"
      className="group flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface transition-colors hover:border-[#C9A24E]/50"
    >
      {/* Cover */}
      <div className="relative h-52 shrink-0 overflow-hidden bg-navy-band">
        {media.length > 0 ? (
          <ProjectImageLightbox media={media} projectName={name} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(216,182,106,0.22),transparent_60%)]">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D8B66A]/40 text-[#D8B66A]">
              <Building2 className="h-7 w-7 stroke-[1.4]" />
            </span>
          </div>
        )}
        {/* Name over a soft fade, like a brochure */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-4 pt-12">
          <h3 className="font-heading text-[20px] font-bold leading-snug text-white">{name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-white/80">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {p.project.city}
          </p>
        </div>
        <div className="pointer-events-none absolute start-4 top-4 z-20 flex items-center gap-1.5">
          {p.project.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24E] px-2.5 py-1 text-[11px] font-bold text-[#1A1408]">
              <Star className="h-3 w-3 fill-current" />
              {t.featured}
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm',
              p.access.active ? 'bg-emerald-500/85 text-white' : 'bg-black/55 text-white/80',
            )}
          >
            {p.access.active ? t.active : t.paused}
          </span>
        </div>
        {media.length > 1 && (
          <span className="pointer-events-none absolute end-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Layers className="h-3 w-3" />
            {media.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-500">{description}</p>
        )}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {services.slice(0, 3).map((s, i) => (
              <span key={i} className="rounded-full border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                {s}
              </span>
            ))}
            {services.length > 3 && (
              <span className="rounded-full border border-hairline px-2.5 py-1 text-[11.5px] text-slate-400">
                <bdi dir="ltr">+{services.length - 3}</bdi>
              </span>
            )}
          </div>
        )}
        {hasDates && (
          <p className="flex items-center gap-1.5 text-[12px] tabular-nums text-slate-500">
            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <bdi>{p.access.startsAt ? formatDate(p.access.startsAt, locale) : '—'}</bdi>
            {' – '}
            <bdi>{p.access.endsAt ? formatDate(p.access.endsAt, locale) : '—'}</bdi>
          </p>
        )}
      </div>

      {/* Figures + action */}
      <div className="mt-auto grid grid-cols-[1fr_1fr_auto] items-center gap-4 border-t border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold text-slate-500">{t.brokerCommission}</p>
          {commission ? (
            <p className="mt-1 whitespace-nowrap text-[22px] font-bold leading-none tabular-nums text-brand-700">
              {commission}
              {usesDefault && (
                <span className="ms-1.5 text-[11px] font-semibold text-slate-400">{en ? 'default' : 'افتراضية'}</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-slate-400">—</p>
          )}
        </div>
        <div className="min-w-0 border-s border-hairline ps-4">
          <p className="text-[11.5px] font-semibold text-slate-500">{en ? 'Available units' : 'وحدات متاحة'}</p>
          <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-slate-900">
            {available ?? '—'}
          </p>
        </div>
        <Link
          href={`/portal/units?projectId=${p.project.id}` as never}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-b from-[#D8B66A] to-[#B38B3A] px-5 text-[13px] font-bold text-[#1A1408] shadow-[0_8px_20px_-10px_rgba(201,162,78,0.8)] transition-opacity hover:opacity-90"
        >
          {t.browseUnits}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
