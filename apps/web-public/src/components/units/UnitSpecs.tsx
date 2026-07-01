import { Maximize, BedDouble, Bath, Building2, Home, BadgeCheck } from 'lucide-react';
import { formatArea, formatNumber, unitTypeLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';

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

export function UnitSpecs({ unit }: { unit: PublicUnit }) {
  const specs: Spec[] = [];
  if (Number.isFinite(unit.area) && unit.area > 0)
    specs.push({ icon: Maximize,   label: 'المساحة',      value: formatArea(unit.area) });
  specs.push({ icon: BedDouble,  label: 'غرف النوم',    value: formatNumber(unit.bedrooms) });
  specs.push({ icon: Bath,       label: 'دورات المياه', value: formatNumber(unit.bathrooms) });
  specs.push({ icon: Building2,  label: 'الطابق',       value: formatNumber(unit.floor) });
  if (unit.type)
    specs.push({ icon: Home,     label: 'نوع الوحدة',   value: unitTypeLabel(unit.type) });
  specs.push({ icon: BadgeCheck, label: 'الحالة',       value: STATUS_LABEL[unit.status] ?? unit.status });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {specs.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-center gap-3.5 rounded-2xl border border-hairline bg-surface px-4 py-4 shadow-soft"
        >
          {/* Gold gradient icon — horizontal anchor; height = content, not grid-stretch */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-50 to-white shadow-[0_1px_4px_-1px_rgba(200,162,75,0.18)] ring-1 ring-gold-100/80">
            <Icon className="h-[18px] w-[18px] text-gold-600" aria-hidden />
          </span>

          <div className="min-w-0">
            <div className="text-[11px] font-medium text-ink-muted/70">{label}</div>
            <div className="mt-0.5 truncate text-sm font-bold text-ink-strong">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
