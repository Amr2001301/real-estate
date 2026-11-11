import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Bath, BedDouble, KeyRound, MapPin, Maximize, Paintbrush } from 'lucide-react';
import { Price } from '@/components/currency/CurrencyProvider';
import { routes } from '@/lib/routes';
import { formatNumber, pickAr, unitTypeLabel, cityLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import type { Locale } from '@/lib/locale';

/**
 * The unit card (home, units list, project page) — "editorial": the project
 * and its place sit on the photo with the type (and a reserved/sold mark);
 * below, the price with its price per metre, the three figures a buyer
 * compares in one bar, then finishing and handover. The title never repeats
 * the bedrooms (a company's type name often carries them already) and the
 * place never repeats a city the project's name already says.
 */
export function UnitCard({ unit, action, locale = 'ar', compact = false }: { unit: PublicUnit; action?: React.ReactNode; locale?: Locale; compact?: boolean }) {
  const t = extraT(locale).unitCard;
  const finishingLabels = siteT(locale).unitSpecs.finishingLabels;
  const statusLabels = t.statuses as Record<string, string>;
  const typeLabel = unitTypeLabel(unit.type, unit.typeName, locale);
  const projectName = unit.project ? pickAr(unit.project.name, '', locale) : '';
  const city = cityLabel(unit.project?.city, locale);
  const showCity = city && !projectName.includes(city);

  const price = Number(unit.price);
  const ppm = unit.pricePerMeter ? Number(unit.pricePerMeter) : unit.area > 0 && price > 0 ? Math.round(price / unit.area) : 0;
  const finishing = unit.finishing ? finishingLabels[unit.finishing] : null;
  const year = unit.deliveryDate ? unit.deliveryDate.slice(0, 4) : null;
  const status = unit.status !== 'AVAILABLE' ? statusLabels[unit.status] : null;
  const sqm = locale === 'en' ? 'm²' : 'م²';

  const specs: Array<{ icon: typeof Bath; value: string; unit: string }> = [];
  if (unit.area > 0) specs.push({ icon: Maximize, value: formatNumber(unit.area, locale), unit: sqm });
  if (unit.bedrooms > 0) specs.push({ icon: BedDouble, value: formatNumber(unit.bedrooms, locale), unit: unit.bedrooms === 1 ? t.roomOne : t.roomMany });
  if (unit.bathrooms > 0) specs.push({ icon: Bath, value: formatNumber(unit.bathrooms, locale), unit: unit.bathrooms === 1 ? t.bathOne : t.bathMany });

  return (
    <div className="relative h-full">
      <Link
        href={routes.unit(unit.id) as Route}
        data-testid="unit-card"
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface outline-none transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-[0_28px_56px_-28px_rgba(0,0,0,0.32)] focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative isolate transform-gpu overflow-hidden" style={{ height: compact ? 150 : 250, transform: 'translateZ(0)' }}>
          <CoverImage
            src={unit.coverImage}
            alt={[typeLabel, projectName].filter(Boolean).join(' — ') || unit.code}
            className="absolute inset-0 h-full"
            zoomOnHover
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden />
          <div className="absolute start-3.5 top-3.5 flex gap-1.5">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1A1F1C]">{typeLabel}</span>
            {status && <span className="rounded-full bg-[#B45309] px-3 py-1.5 text-xs font-semibold text-white">{status}</span>}
          </div>
          {(projectName || showCity) && (
            <div className="absolute inset-x-5 bottom-4 text-white">
              {projectName && <p className="line-clamp-1 font-display text-xl font-semibold leading-snug">{projectName}</p>}
              {showCity && (
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/90">
                  <MapPin className="h-[15px] w-[15px] shrink-0" aria-hidden />
                  {city}
                </p>
              )}
            </div>
          )}
        </div>

        <div className={`flex flex-1 flex-col px-5 ${compact ? "pb-4 pt-4" : "pb-[18px] pt-5"}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={`font-display font-semibold leading-tight tracking-tight text-ink-strong ${compact ? "text-[1.4rem]" : "text-[1.7rem]"}`}>
              <Price value={unit.price} />
            </span>
            {ppm > 0 && <span className="shrink-0 text-xs text-ink-muted">{t.perMeter(formatNumber(ppm, locale))}</span>}
          </div>

          {specs.length > 0 && (
            <div className={`flex items-center gap-3.5 rounded-2xl bg-surface-soft px-3.5 text-[13px] text-ink-muted ${compact ? "mt-3 py-2.5" : "mt-4 py-3"}`}>
              {specs.map((s, i) => (
                <span key={s.unit} className="flex items-center gap-3.5">
                  {i > 0 && <span className="h-[18px] w-px bg-hairline" aria-hidden />}
                  <span className="flex items-center gap-1.5">
                    <s.icon className="h-[18px] w-[18px] text-navy dark:text-gold-300" strokeWidth={1.6} aria-hidden />
                    <b className="text-[15px] font-semibold text-ink-strong">{s.value}</b>
                    {s.unit}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className={`mt-auto flex items-center gap-3.5 text-[13px] font-medium text-ink-muted ${compact ? "pt-3" : "pt-4"}`}>
            {finishing && (
              <span className="flex items-center gap-1.5">
                <Paintbrush className="h-4 w-4" strokeWidth={1.6} aria-hidden />
                {finishing}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" strokeWidth={1.6} aria-hidden />
                {t.delivery(year)}
              </span>
            )}
            <span
              className="ms-auto inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5"
              style={{ background: 'color-mix(in srgb, rgb(var(--c-navy)) 50%, black)' }}
              aria-hidden
            >
              <ArrowLeft className="h-[18px] w-[18px] ltr:rotate-180" />
            </span>
          </div>
        </div>
      </Link>
      {/* Favorite + optional compare, over the photo's top end. */}
      <div className="absolute end-3 top-3 z-20 flex items-center gap-1.5">
        {action}
        <FavoriteButton kind="unit" id={unit.id} />
      </div>
    </div>
  );
}
