import Link from 'next/link';
import type { Route } from 'next';
import { Price } from '@/components/currency/CurrencyProvider';
import { routes } from '@/lib/routes';
import { formatNumber, pickAr, unitTypeLabel, cityLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { CoverImage } from '@/components/ui/CoverImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import type { Locale } from '@/lib/locale';

const STATUS_TONE: Record<string, string> = {
  RESERVED: 'bg-warning text-white',
  SOLD: 'bg-ink-muted text-white',
};

/**
 * The unit card (home, units list, project page): one clear hierarchy —
 * photo, price, title, place, then the three figures a buyer compares
 * (area, bedrooms, bathrooms) in equal cells. Finishing and handover ride on
 * the photo; floor, view and code live on the unit page.
 */
export function UnitCard({ unit, action, locale = 'ar' }: { unit: PublicUnit; action?: React.ReactNode; locale?: Locale }) {
  const t = extraT(locale).unitCard;
  const finishingLabels = siteT(locale).unitSpecs.finishingLabels;
  const statusLabels = t.statuses as Record<string, string>;
  const typeLabel = unitTypeLabel(unit.type, unit.typeName, locale);
  const projectName = unit.project ? pickAr(unit.project.name, '', locale) : '';
  const location = cityLabel(unit.project?.city, locale);
  const place = [projectName, location].filter(Boolean).join(' — ');

  const title =
    unit.bedrooms > 0
      ? `${typeLabel} ${formatNumber(unit.bedrooms, locale)} ${unit.bedrooms === 1 ? t.roomOne : t.roomMany}`
      : typeLabel;
  const finishing = unit.finishing ? finishingLabels[unit.finishing] : null;
  const year = unit.deliveryDate ? unit.deliveryDate.slice(0, 4) : null;
  const statusTone = STATUS_TONE[unit.status];

  const cells: Array<{ value: string; label: string }> = [];
  if (unit.area > 0) cells.push({ value: `${formatNumber(unit.area, locale)} ${locale === 'en' ? 'm²' : 'م²'}`, label: t.area });
  if (unit.bedrooms > 0) cells.push({ value: formatNumber(unit.bedrooms, locale), label: t.bedrooms });
  if (unit.bathrooms > 0) cells.push({ value: formatNumber(unit.bathrooms, locale), label: t.bathrooms });

  return (
    <div className="relative h-full">
      <Link
        href={routes.unit(unit.id) as Route}
        data-testid="unit-card"
        className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface outline-none transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.28)] focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative isolate transform-gpu overflow-hidden" style={{ transform: 'translateZ(0)' }}>
          <CoverImage src={unit.coverImage} alt={`${title} — ${place || unit.code}`} className="aspect-[4/3]" zoomOnHover />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
          <div className="absolute start-4 top-4 flex gap-2">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1A1F1C]">{typeLabel}</span>
            {statusTone && (
              <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', statusTone)}>{statusLabels[unit.status]}</span>
            )}
          </div>
          {(finishing || year) && (
            <div className="absolute bottom-4 start-4 flex flex-wrap gap-2">
              {finishing && <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{finishing}</span>}
              {year && <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">{t.delivery(year)}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6">
          <div className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-strong">
            <Price value={unit.price} />
          </div>
          <h3 className="mt-1.5 line-clamp-1 text-lg font-semibold text-ink-strong">{title}</h3>
          {place && <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{place}</p>}

          {cells.length > 0 && (
            <div className="mt-auto pt-4">
              <div className="flex divide-x divide-hairline border-t border-hairline rtl:divide-x-reverse">
                {cells.map((c) => (
                  <div key={c.label} className="min-w-0 flex-1 px-1 pt-3 text-center">
                    <div className="text-base font-semibold text-ink-strong">{c.value}</div>
                    <div className="text-xs text-ink-muted">{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Link>
      {/* Favorite + optional compare, over the photo's top end. */}
      <div className="absolute end-3 top-3 z-20 flex items-center gap-1.5">
        <FavoriteButton kind="unit" id={unit.id} />
        {action}
      </div>
    </div>
  );
}
