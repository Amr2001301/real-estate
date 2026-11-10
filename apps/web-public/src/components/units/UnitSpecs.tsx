import { Maximize, BedDouble, Bath, Building2, Home, BadgeCheck, Trees, Paintbrush, Eye, Compass, LayoutTemplate, CalendarCheck } from 'lucide-react';
import { formatArea, formatNumber, unitTypeLabel } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import type { PublicUnit } from '@/lib/api-types';

interface Spec {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

export async function UnitSpecs({ unit }: { unit: PublicUnit }) {
  const locale = await getLocale();
  const m = siteT(locale);
  const s = m.unitSpecs;
  const statusMap = m.unitDetail.status;
  const statusValue = statusMap[unit.status as keyof typeof statusMap] ?? unit.status;

  const specs: Spec[] = [];
  if (Number.isFinite(unit.area) && unit.area > 0)
    specs.push({ icon: Maximize,   label: s.area,      value: formatArea(unit.area, locale) });
  for (const f of ['netArea', 'gardenArea', 'roofArea', 'terraceArea', 'landArea'] as const) {
    const v = unit[f];
    if (v && v > 0) specs.push({ icon: f === 'gardenArea' ? Trees : Maximize, label: s[f], value: formatArea(v, locale) });
  }
  if (unit.finishing)
    specs.push({ icon: Paintbrush, label: s.finishing, value: s.finishingLabels[unit.finishing] ?? unit.finishing });
  if (unit.view) specs.push({ icon: Eye, label: s.view, value: s.viewLabels[unit.view] ?? unit.view });
  if (unit.orientation)
    specs.push({ icon: Compass, label: s.orientation, value: s.orientationLabels[unit.orientation] ?? unit.orientation });
  // Only a residential unit has bedrooms.
  if (!unit.usage || unit.usage === 'RESIDENTIAL')
    specs.push({ icon: BedDouble,  label: s.bedrooms,   value: formatNumber(unit.bedrooms, locale) });
  specs.push({ icon: Bath,       label: s.bathrooms,  value: formatNumber(unit.bathrooms, locale) });
  specs.push({ icon: Building2,  label: s.floor,      value: formatNumber(unit.floor, locale) });
  if (unit.type)
    specs.push({ icon: Home,     label: s.unitType,   value: unitTypeLabel(unit.type, unit.typeName, locale) });
  if (unit.model) {
    const name = typeof unit.model.name === 'string' ? unit.model.name : (unit.model.name[locale] ?? unit.model.name.ar);
    specs.push({ icon: LayoutTemplate, label: s.model, value: name || unit.model.code });
  }
  specs.push({ icon: BadgeCheck, label: s.status,     value: statusValue });
  if (unit.deliveryDate) {
    // Already due → ready to move in; else the month it is handed over.
    const due = new Date(`${unit.deliveryDate}T00:00:00Z`);
    const value =
      due.getTime() <= Date.now()
        ? s.deliveryNow
        : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(due);
    specs.push({ icon: CalendarCheck, label: s.delivery, value });
  }

  return (
    <dl data-testid="unit-specs" className="grid overflow-hidden rounded-[1.25rem] border border-hairline bg-surface px-6 sm:grid-cols-2 sm:gap-x-10">
      {specs.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center justify-between gap-4 border-b border-hairline py-4 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
          <dt className="flex items-center gap-2.5 text-[15px] text-ink-muted">
            <Icon className="h-[18px] w-[18px] shrink-0 text-gold-500" aria-hidden />
            {label}
          </dt>
          <dd className="truncate text-[15px] font-semibold text-ink-strong">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
