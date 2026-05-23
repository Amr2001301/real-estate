import Link from 'next/link';
import type { Route } from 'next';
import { BedDouble, Bath, Maximize, Building2, MapPin, ArrowLeft } from 'lucide-react';
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

export function UnitCard({ unit }: { unit: PublicUnit }) {
  const status = STATUS[unit.status] ?? DEFAULT_STATUS;
  const projectName = unit.project ? pickAr(unit.project.name) : '';
  const location = unit.project?.city || projectName || 'موقع مميز';

  // Build only the relevant specs so e.g. offices don't show "0 غرف".
  const specs: Array<{ icon: typeof BedDouble; label: string; value: string }> = [];
  if (unit.bedrooms > 0) specs.push({ icon: BedDouble, label: 'غرف', value: formatNumber(unit.bedrooms) });
  if (unit.bathrooms > 0) specs.push({ icon: Bath, label: 'حمام', value: formatNumber(unit.bathrooms) });
  if (unit.area > 0) specs.push({ icon: Maximize, label: 'م²', value: formatNumber(unit.area) });
  if (unit.floor > 0) specs.push({ icon: Building2, label: 'طابق', value: formatNumber(unit.floor) });

  return (
    <Link
      href={routes.unit(unit.id) as Route}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <PremiumCard interactive className="flex h-full flex-col overflow-hidden">
        <div className="relative">
          <CoverImage src={unit.coverImage} alt={`${unitTypeLabel(unit.type)} - ${unit.code}`} className="aspect-[4/3]" zoomOnHover />
          {/* Status pill (legible over photography) */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-xs font-medium text-navy shadow-soft backdrop-blur">
            <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
          {/* Type tag bottom-start over the image */}
          <span className="absolute bottom-4 right-4 rounded-full bg-navy/85 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {unitTypeLabel(unit.type)}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          {/* Title + price on one compact row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-base font-semibold text-navy">
                {unitTypeLabel(unit.type)} · {unit.code}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
                <MapPin className="h-3.5 w-3.5 text-gold-500" aria-hidden />
                <span className="line-clamp-1">{location}</span>
              </p>
            </div>
            <div className="shrink-0 text-end">
              <div className="font-display text-xl font-semibold leading-tight text-navy">{formatPrice(unit.price)}</div>
              <div className="text-[11px] text-ink-muted">يبدأ من</div>
            </div>
          </div>

          {/* Compact horizontal specs row */}
          {specs.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-3 text-sm text-ink-muted">
              {specs.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <s.icon className="h-4 w-4 text-gold-500" aria-hidden />
                  <span className="font-medium text-navy">{s.value}</span>
                  <span className="text-xs">{s.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* CTA pinned to the bottom */}
          <div className="mt-auto pt-4">
            <span className="flex items-center justify-center gap-2 rounded-full border border-navy/15 py-2.5 text-sm font-medium text-navy transition-colors group-hover:border-navy group-hover:bg-navy group-hover:text-white">
              عرض التفاصيل
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden />
            </span>
          </div>
        </div>
      </PremiumCard>
    </Link>
  );
}
