'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Layers, ChevronDown, Building2, BedDouble, Bath, Wallet, Tag, Ruler, ArrowDownUp } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { PRICE_RANGES, AREA_RANGES, UNIT_TYPES as TYPES, ROOM_OPTIONS as ROOMS } from '@/lib/unit-filters';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

export interface UnitsFilterValues {
  projectId: string;
  city: string;
  type: string;
  bedrooms: string;
  bathrooms: string;
  price: string;
  area: string;
  status: string;
  sort: string;
}

/** Compact select: a leading icon (RTL start) plus the shared chevron, no stacked label. */
function CompactSelect({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-500" aria-hidden />
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-11 pr-9 pl-8 text-sm"
      >
        {children}
      </Select>
      <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/50" aria-hidden />
    </div>
  );
}

export function UnitsFilterBar({
  initial,
  locale,
}: {
  initial: UnitsFilterValues;
  locale: Locale;
}) {
  const router = useRouter();
  const t = siteT(locale).unitsFilter;
  const statuses = siteT(locale).home.search.statuses;
  const sortOptions = siteT(locale).sortOptions.unit;

  const [type, setType] = useState(initial.type);
  const [bedrooms, setBedrooms] = useState(initial.bedrooms);
  const [bathrooms, setBathrooms] = useState(initial.bathrooms);
  const [price, setPrice] = useState(initial.price);
  const [area, setArea] = useState(initial.area);
  const [status, setStatus] = useState(initial.status);
  const [sort, setSort] = useState(initial.sort);

  function pushWith(next: Partial<UnitsFilterValues>) {
    const v = { type, bedrooms, bathrooms, price, area, status, sort, ...next };
    const params = new URLSearchParams();
    if (initial.projectId) params.set('projectId', initial.projectId);
    if (initial.city) params.set('city', initial.city);
    if (v.type) params.set('type', v.type);
    if (v.bedrooms) params.set('bedrooms', v.bedrooms);
    if (v.bathrooms) params.set('bathrooms', v.bathrooms);
    if (v.status) params.set('status', v.status);
    const range = PRICE_RANGES.find((r) => r.value === v.price);
    if (range?.min) params.set('priceMin', range.min);
    if (range?.max) params.set('priceMax', range.max);
    const arange = AREA_RANGES.find((r) => r.value === v.area);
    if (arange?.min) params.set('areaMin', arange.min);
    if (arange?.max) params.set('areaMax', arange.max);
    if (v.sort) params.set('sort', v.sort);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  function reset() {
    setType('');
    setBedrooms('');
    setBathrooms('');
    setPrice('');
    setArea('');
    setStatus('');
    setSort('');
    const params = new URLSearchParams();
    if (initial.projectId) params.set('projectId', initial.projectId);
    if (initial.city) params.set('city', initial.city);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  const activeCount = [type, bedrooms, bathrooms, price, area, status, sort].filter(Boolean).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        pushWith({});
      }}
      className="rounded-2xl border border-hairline bg-surface p-3 shadow-card sm:p-4"
    >
      {initial.projectId && (
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-600">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {t.withinProject}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
        <CompactSelect icon={Building2} label={t.propertyType} value={type} onChange={setType}>
          {TYPES.map((tp) => (
            <option key={tp.value} value={tp.value}>{tp.label}</option>
          ))}
        </CompactSelect>
        <CompactSelect icon={BedDouble} label={t.bedrooms} value={bedrooms} onChange={setBedrooms}>
          {ROOMS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value ? `${r.label} ${t.roomSuffix}` : t.allRooms}
            </option>
          ))}
        </CompactSelect>
        <CompactSelect icon={Bath} label={t.bathrooms} value={bathrooms} onChange={setBathrooms}>
          {ROOMS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value ? `${r.label} ${t.bathroomSuffix}` : t.allBathrooms}
            </option>
          ))}
        </CompactSelect>
        <CompactSelect icon={Wallet} label={t.priceRange} value={price} onChange={setPrice}>
          {PRICE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </CompactSelect>
        <CompactSelect icon={Ruler} label={t.area} value={area} onChange={setArea}>
          {AREA_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </CompactSelect>
        <CompactSelect icon={Tag} label={t.unitStatus} value={status} onChange={setStatus}>
          {statuses.map((s) => (
            <option key={s.value || 'all'} value={s.value}>{s.label}</option>
          ))}
        </CompactSelect>
        <CompactSelect icon={ArrowDownUp} label={t.sortBy} value={sort} onChange={setSort}>
          {sortOptions.map((o) => (
            <option key={o.value || 'default'} value={o.value}>{o.label}</option>
          ))}
        </CompactSelect>
        <Button type="submit" size="md" className="col-span-2 h-11 w-full sm:col-span-3 lg:col-auto lg:w-auto lg:px-6">
          <Search className="h-5 w-5" aria-hidden />
          {t.search}
        </Button>
      </div>

      {activeCount > 0 && (
        <div className="mt-2.5 flex justify-end text-sm">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink-strong"
          >
            <X className="h-4 w-4" aria-hidden />
            {t.clearAll}
          </button>
        </div>
      )}
    </form>
  );
}
