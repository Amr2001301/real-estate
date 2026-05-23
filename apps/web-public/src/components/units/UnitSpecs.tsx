import { Coins, Maximize, BedDouble, Bath, Building2, Home, BadgeCheck } from 'lucide-react';
import { formatPrice, formatArea, formatNumber, unitTypeLabel } from '@/lib/format';
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

/** Public-safe spec tiles. Missing/empty fields are skipped gracefully. */
export function UnitSpecs({ unit }: { unit: PublicUnit }) {
  const specs: Spec[] = [];
  if (unit.price) specs.push({ icon: Coins, label: 'السعر', value: formatPrice(unit.price) });
  if (Number.isFinite(unit.area) && unit.area > 0) specs.push({ icon: Maximize, label: 'المساحة', value: formatArea(unit.area) });
  specs.push({ icon: BedDouble, label: 'غرف النوم', value: formatNumber(unit.bedrooms) });
  specs.push({ icon: Bath, label: 'دورات المياه', value: formatNumber(unit.bathrooms) });
  specs.push({ icon: Building2, label: 'الطابق', value: formatNumber(unit.floor) });
  if (unit.type) specs.push({ icon: Home, label: 'نوع الوحدة', value: unitTypeLabel(unit.type) });
  specs.push({ icon: BadgeCheck, label: 'الحالة', value: STATUS_LABEL[unit.status] ?? unit.status });

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {specs.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-3xl border border-hairline bg-surface p-5 shadow-soft">
          <IconCircle tone="soft" className="h-10 w-10">
            <Icon className="h-5 w-5" />
          </IconCircle>
          <div className="mt-4 text-sm text-ink-muted">{label}</div>
          <div className="mt-1 font-display text-lg text-navy">{value}</div>
        </div>
      ))}
    </div>
  );
}
