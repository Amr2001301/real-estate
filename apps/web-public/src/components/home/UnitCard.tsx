import Link from 'next/link';
import type { Route } from 'next';
import { BedDouble, Bath, Maximize, Layers, Building2, Building, Briefcase, Store, Home, MapPin } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice, formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { CoverImage } from '@/components/ui/CoverImage';

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

export function UnitCard({ unit }: { unit: PublicUnit }) {
  const status = STATUS[unit.status] ?? DEFAULT_STATUS;
  const typeLabel = unitTypeLabel(unit.type);
  const TypeIcon = typeIcon(unit.type);

  const projectName = unit.project ? pickAr(unit.project.name) : '';
  const location = unit.project?.city || 'موقع مميز';

  // Compact specs (no floor here — floor shows as its own line below the title).
  const specs: Array<{ icon: typeof BedDouble; label: string; value: string }> = [];
  if (unit.bedrooms > 0) specs.push({ icon: BedDouble, label: 'غرف', value: formatNumber(unit.bedrooms) });
  if (unit.bathrooms > 0) specs.push({ icon: Bath, label: 'حمام', value: formatNumber(unit.bathrooms) });
  if (unit.area > 0) specs.push({ icon: Maximize, label: 'م²', value: formatNumber(unit.area) });

  return (
    <Link
      href={routes.unit(unit.id) as Route}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <PremiumCard interactive className="flex h-full flex-col overflow-hidden">
        {/* Image */}
        <div className="relative">
          <CoverImage src={unit.coverImage} alt={`${typeLabel} - ${unit.code}`} className="aspect-[4/3]" zoomOnHover />
          {/* Status pill — top start */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-xs font-medium text-navy shadow-soft backdrop-blur">
            <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
          {/* Project label — paired across the top (only when available) */}
          {projectName && (
            <span className="absolute left-4 top-4 max-w-[55%] truncate rounded-full bg-navy/85 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {projectName}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          {/* Title + gold type tile */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
              <TypeIcon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h3 className="line-clamp-1 text-base font-semibold text-navy">
              {typeLabel} - {unit.code}
            </h3>
          </div>

          {/* Location directly under the title */}
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5 text-gold-500" aria-hidden />
            <span className="line-clamp-1">{location}</span>
          </p>

          {/* Floor (instead of project name) — only when available */}
          {unit.floor > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
              <Layers className="h-3.5 w-3.5 text-gold-500" aria-hidden />
              الطابق {formatNumber(unit.floor)}
            </p>
          )}

          {/* Divider */}
          <div className="my-3 border-t border-hairline" />

          {/* Compact specs row */}
          {specs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm text-ink-muted">
              {specs.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <s.icon className="h-4 w-4 text-gold-500" aria-hidden />
                  <span className="font-medium text-navy">{s.value}</span>
                  <span className="text-xs">{s.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Price — last element, anchored at the bottom */}
          <div className="mt-auto pt-4">
            <div className="font-display text-xl font-bold text-navy">{formatPrice(unit.price)}</div>
          </div>
        </div>
      </PremiumCard>
    </Link>
  );
}
