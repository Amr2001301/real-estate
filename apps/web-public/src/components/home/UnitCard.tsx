import Link from 'next/link';
import type { Route } from 'next';
import { BedDouble, Bath, Maximize, Building2, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatPrice, formatArea, formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
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

  // Build only the relevant specs so e.g. offices don't show "0 غرف".
  const specs: Array<{ icon: typeof BedDouble; value: string }> = [];
  if (unit.bedrooms > 0) specs.push({ icon: BedDouble, value: formatNumber(unit.bedrooms) });
  if (unit.bathrooms > 0) specs.push({ icon: Bath, value: formatNumber(unit.bathrooms) });
  if (unit.area > 0) specs.push({ icon: Maximize, value: formatArea(unit.area) });
  if (unit.floor > 0) specs.push({ icon: Building2, value: `ط ${formatNumber(unit.floor)}` });

  return (
    <Link
      href={routes.unit(unit.id) as Route}
      className="group block h-full rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <PremiumCard interactive className="flex h-full flex-col overflow-hidden">
        <div className="relative">
          <CoverImage src={unit.coverImage} alt={`وحدة ${unit.code}`} className="aspect-[4/3]" zoomOnHover />
          {/* Solid pill for legibility over photography. */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-xs font-medium text-navy shadow-soft backdrop-blur">
            <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
            <span className="rounded-full bg-surface-soft px-2.5 py-1 text-navy">{unitTypeLabel(unit.type)}</span>
            {projectName && <span className="line-clamp-1">{projectName}</span>}
          </div>

          <div className="mt-3 font-display text-2xl font-semibold text-navy">{formatPrice(unit.price)}</div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4 text-sm text-ink-muted">
            {specs.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <s.icon className="h-4 w-4 text-gold-500" aria-hidden />
                {s.value}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-end pt-6">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-navy transition-colors group-hover:text-gold-600">
              عرض التفاصيل
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden />
            </span>
          </div>
        </div>
      </PremiumCard>
    </Link>
  );
}
