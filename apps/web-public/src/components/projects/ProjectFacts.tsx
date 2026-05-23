import { MapPin, Home, BadgeCheck, Compass } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { IconCircle } from '@/components/ui/IconCircle';

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

/** Small premium stat tiles. Missing/irrelevant facts are skipped defensively. */
export function ProjectFacts({ city, availableUnitsCount, featured, hasCoords }: ProjectFactsProps) {
  const facts: Fact[] = [];
  if (city) facts.push({ icon: MapPin, label: 'المدينة', value: city });
  facts.push({ icon: Home, label: 'الوحدات المتاحة', value: `${formatNumber(availableUnitsCount)} وحدة` });
  facts.push({ icon: BadgeCheck, label: 'الحالة', value: featured ? 'مشروع مميز' : 'متاح' });
  if (hasCoords) facts.push({ icon: Compass, label: 'الموقع', value: 'متوفر على الخريطة' });

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {facts.map(({ icon: Icon, label, value }) => (
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
