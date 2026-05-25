import { MapPin, Home, BadgeCheck, Compass } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { IconCircle } from '@/components/ui/IconCircle';
import { PremiumCard } from '@/components/ui/PremiumCard';

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

/** Quick-facts card for the inquiry sidebar. Irrelevant facts are skipped defensively. */
export function ProjectFacts({ city, availableUnitsCount, featured, hasCoords }: ProjectFactsProps) {
  const facts: Fact[] = [];
  if (city) facts.push({ icon: MapPin, label: 'المدينة', value: city });
  facts.push({ icon: Home, label: 'الوحدات المتاحة', value: `${formatNumber(availableUnitsCount)} وحدة` });
  facts.push({ icon: BadgeCheck, label: 'الحالة', value: featured ? 'مشروع مميز' : 'متاح' });
  if (hasCoords) facts.push({ icon: Compass, label: 'الموقع', value: 'متوفر على الخريطة' });

  return (
    <PremiumCard className="p-6">
      <h3 className="text-base font-semibold text-navy">تفاصيل المشروع</h3>
      <dl className="mt-4 divide-y divide-hairline">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <IconCircle tone="gold" className="h-10 w-10 shrink-0">
              <Icon className="h-5 w-5" />
            </IconCircle>
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="ms-auto text-end font-display text-navy">{value}</dd>
          </div>
        ))}
      </dl>
    </PremiumCard>
  );
}
