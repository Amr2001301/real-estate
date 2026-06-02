import Link from 'next/link';
import type { Route } from 'next';
import { BedDouble, Bath, Maximize, Building2, Building, Briefcase, Store, Home, MapPin, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice, formatNumber, pickAr, unitTypeLabel, cityLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { CoverImage } from '@/components/ui/CoverImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

const STATUS: Record<string, { label: string; dot: string }> = {
  AVAILABLE: { label: 'متاحة', dot: 'bg-success' },
  RESERVED: { label: 'محجوزة', dot: 'bg-warning' },
  SOLD: { label: 'مباعة', dot: 'bg-ink-muted' },
};
const DEFAULT_STATUS = { label: 'متاحة', dot: 'bg-success' };

/** Gold type glyph for the title tile. */
function typeIcon(type: string): typeof Home {
  switch (type.toLowerCase()) {
    case 'office':
      return Briefcase;
    case 'retail':
      return Store;
    case 'villa':
      return Building;
    case 'townhouse':
      return Building2;
    default:
      return Home;
  }
}

export function UnitCard({ unit, action }: { unit: PublicUnit; action?: React.ReactNode }) {
  const status = STATUS[unit.status] ?? DEFAULT_STATUS;
  const typeLabel = unitTypeLabel(unit.type);
  const TypeIcon = typeIcon(unit.type);

  const projectName = unit.project ? pickAr(unit.project.name) : '';
  const location = cityLabel(unit.project?.city);

  // Compact specs with light Arabic pluralization (singular at 1).
  const specs: Array<{ icon: typeof BedDouble; label: string; value: string }> = [];
  if (unit.bedrooms > 0)
    specs.push({ icon: BedDouble, label: unit.bedrooms === 1 ? 'غرفة' : 'غرف', value: formatNumber(unit.bedrooms) });
  if (unit.bathrooms > 0)
    specs.push({ icon: Bath, label: unit.bathrooms === 1 ? 'حمام' : 'حمامات', value: formatNumber(unit.bathrooms) });
  if (unit.area > 0) specs.push({ icon: Maximize, label: 'م²', value: formatNumber(unit.area) });

  return (
    <div className="relative h-full">
    <Link
      href={routes.unit(unit.id) as Route}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <PremiumCard interactive className="flex h-full flex-col overflow-hidden isolate">
        {/* Image — GPU-isolated wrapper with its OWN rounded-top clip, so the
            zoom transform composites on a stable layer. Fixes the WebKit/Chromium
            border-radius flicker where rounded corners reset to 0 mid-transition. */}
        <div
          className="relative transform-gpu overflow-hidden rounded-t-3xl isolate"
          style={{ transform: 'translateZ(0)' }}
        >
          <CoverImage
            src={unit.coverImage}
            alt={`${typeLabel} — ${unit.code}`}
            className="aspect-[4/3]"
            imgClassName="will-change-transform motion-reduce:transition-none"
            zoomOnHover
          />
          {/* Soft scrim keeps the pills legible over any photo */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent" aria-hidden />
          {/* Status — top start (right in RTL) */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-navy/55 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md">
            <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
          {/* Project — top end (left in RTL) */}
          {projectName && (
            <span className="absolute bottom-4 left-4 inline-flex max-w-[55%] items-center gap-1.5 rounded-full bg-navy/55 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-300" aria-hidden />
              <span className="truncate">{projectName}</span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          {/* Type tile + title + code chip */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-400 group-hover:text-navy">
              <TypeIcon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h3 className="line-clamp-1 min-w-0 flex-1 text-base font-semibold text-ink-strong">{typeLabel}</h3>
            <span className="shrink-0 rounded-md bg-surface-soft px-2 py-0.5 text-[11px] font-medium tracking-tight text-ink-muted">
              {unit.code}
            </span>
          </div>

          {/* Location · floor — one muted line */}
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
            <span className="line-clamp-1">
              {location}
              {unit.floor > 0 ? ` · الطابق ${formatNumber(unit.floor)}` : ''}
            </span>
          </p>

          {/* Divider */}
          <div className="my-3 border-t border-hairline" />

          {/* Specs */}
          {specs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
              {specs.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <s.icon className="h-4 w-4 text-gold-500" aria-hidden />
                  <span className="font-semibold text-ink-strong">{s.value}</span>
                  <span className="text-xs">{s.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Price + subtle clickable affordance */}
          <div className="mt-auto flex items-center justify-between pt-4">
            <div className="font-display text-xl font-bold text-ink-strong">{formatPrice(unit.price)}</div>
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-ink-strong transition-colors group-hover:bg-gold-400 group-hover:text-navy"
              aria-hidden
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </span>
          </div>
        </div>
      </PremiumCard>
    </Link>
      {/* Action row — favorite + optional compare, grouped so they never stack */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
        <FavoriteButton kind="unit" id={unit.id} />
        {action}
      </div>
    </div>
  );
}
