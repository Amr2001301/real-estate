import { MapPin, Home, BadgeCheck, Compass } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface Fact {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

interface ProjectFactsProps {
  city: string;
  availableUnitsCount: number;
  featured: boolean;
  hasCoords: boolean;
}

export function ProjectFacts({ city, availableUnitsCount, featured, hasCoords }: ProjectFactsProps) {
  const facts: Fact[] = [];
  if (city) facts.push({ icon: MapPin,    label: 'المدينة',          value: city });
  facts.push({           icon: Home,       label: 'الوحدات المتاحة', value: `${formatNumber(availableUnitsCount)} وحدة` });
  facts.push({           icon: BadgeCheck, label: 'الحالة',           value: featured ? 'مشروع مميز' : 'متاح' });
  if (hasCoords) facts.push({ icon: Compass, label: 'الموقع',        value: 'متوفر على الخريطة' });

  return (
    <div className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card">

      {/* Card header */}
      <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
        <h3 className="text-[13px] font-semibold text-ink-strong">تفاصيل المشروع</h3>
      </div>

      {/* Fact rows — 2-line layout: muted label / bold value */}
      <dl>
        {facts.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-4 border-b border-hairline/50 px-5 py-4 last:border-0"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-50 to-white shadow-[0_1px_4px_-1px_rgba(200,162,75,0.18)] ring-1 ring-gold-100/80">
              <Icon className="h-[18px] w-[18px] text-gold-600" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <dt className="text-[11px] font-medium text-ink-muted/70">{label}</dt>
              <dd className="mt-0.5 text-sm font-bold text-ink-strong">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
