import { Maximize, BedDouble, Bath, Building2, Home, BadgeCheck } from 'lucide-react';
import { formatArea, formatNumber, unitTypeLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { IconCircle } from '@/components/ui/IconCircle';

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'متاحة',
  RESERVED: 'محجوزة',
  SOLD: 'مباعة',
};

interface Spec {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

/**
 * Public-safe spec tiles. Price is intentionally omitted here — it's shown
 * prominently in the hero and the inquiry card. Missing fields are skipped.
 */
export function UnitSpecs({ unit }: { unit: PublicUnit }) {
  const specs: Spec[] = [];
  if (Number.isFinite(unit.area) && unit.area > 0) specs.push({ icon: Maximize, label: 'المساحة', value: formatArea(unit.area) });
  specs.push({ icon: BedDouble, label: 'غرف النوم', value: formatNumber(unit.bedrooms) });
  specs.push({ icon: Bath, label: 'دورات المياه', value: formatNumber(unit.bathrooms) });
  specs.push({ icon: Building2, label: 'الطابق', value: formatNumber(unit.floor) });
  if (unit.type) specs.push({ icon: Home, label: 'نوع الوحدة', value: unitTypeLabel(unit.type) });
  specs.push({ icon: BadgeCheck, label: 'الحالة', value: STATUS_LABEL[unit.status] ?? unit.status });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
      {specs.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-soft"
        >
          <IconCircle tone="gold" className="h-11 w-11 shrink-0">
            <Icon className="h-5 w-5" />
          </IconCircle>
          <div className="min-w-0">
            <div className="text-xs text-ink-muted">{label}</div>
            <div className="mt-0.5 truncate font-display text-base text-ink-strong sm:text-lg">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
