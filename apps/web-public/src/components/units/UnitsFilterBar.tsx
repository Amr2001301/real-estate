'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { FieldSelect } from '@/components/ui/FieldSelect';
import { PRICE_RANGES, AREA_RANGES, UNIT_TYPES as TYPES, ROOM_OPTIONS as ROOMS } from '@/lib/unit-filters';
import { cityLabel } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';

export interface UnitsFilterValues {
  projectId: string;
  city: string;
  type: string;
  /** Residential, commercial, … (the home page's tabs). */
  usage?: string;
  bedrooms: string;
  bathrooms: string;
  price: string;
  area: string;
  /** Core & shell … furnished. */
  finishing?: string;
  /** Handover: 'now', or within N years. */
  delivery?: string;
  status: string;
  sort: string;
}

type Key = keyof UnitsFilterValues;
const MORE_KEYS: Key[] = ['finishing', 'delivery', 'area', 'bathrooms', 'status', 'city'];

/** The units list URL for a set of filters (page 1). */
export function unitsHref(v: UnitsFilterValues): string {
  const params = new URLSearchParams();
  if (v.projectId) params.set('projectId', v.projectId);
  if (v.city) params.set('city', v.city);
  if (v.usage) params.set('usage', v.usage);
  if (v.type) params.set('type', v.type);
  if (v.bedrooms) params.set('bedrooms', v.bedrooms);
  if (v.bathrooms) params.set('bathrooms', v.bathrooms);
  if (v.finishing) params.set('finishing', v.finishing);
  if (v.delivery) params.set('delivery', v.delivery);
  if (v.status) params.set('status', v.status);
  const range = PRICE_RANGES.find((r) => r.value === v.price);
  if (range?.min) params.set('priceMin', range.min);
  if (range?.max) params.set('priceMax', range.max);
  const arange = AREA_RANGES.find((r) => r.value === v.area);
  if (arange?.min) params.set('areaMin', arange.min);
  if (arange?.max) params.set('areaMax', arange.max);
  if (v.sort) params.set('sort', v.sort);
  const qs = params.toString();
  return qs ? `${routes.units}?${qs}` : routes.units;
}

function Pills({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || 'any'}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : o.value)}
              className={cn(
                'rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors',
                on ? 'border-ink-strong bg-ink-strong text-canvas' : 'border-hairline text-ink hover:border-ink-muted',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The units filters: project, type, bedrooms and price always in view; the
 * rest behind «فلاتر أكثر» (with a count of what is set there); the active
 * filters as removable chips under the bar.
 */
export function UnitsFilterBar({
  initial,
  types,
  projects = [],
  cities = [],
  locale,
}: {
  initial: UnitsFilterValues;
  /** The company's unit types; the fixed list when the API gave none. */
  types?: Array<{ value: string; label: string }>;
  projects?: Array<{ value: string; label: string }>;
  cities?: string[];
  locale: Locale;
}) {
  const router = useRouter();
  const fx = extraT(locale).filters;
  const t = siteT(locale).unitsFilter;
  const l = siteT(locale).listing;
  const statuses = siteT(locale).home.search.statuses;
  const finishingLabels = siteT(locale).unitSpecs.finishingLabels;
  const typeOptions = types?.length ? types : TYPES.slice(1);

  const [v, setV] = useState<UnitsFilterValues>(initial);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const set = (k: Key, value: string) => setV((cur) => ({ ...cur, [k]: value }));
  const go = (next: Partial<UnitsFilterValues>) => router.push(unitsHref({ ...v, ...next }) as never);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const roomLabel = (r: string) => fx.rooms[r as keyof typeof fx.rooms] ?? r;
  const priceLabel = (r: string) => fx.price[r as keyof typeof fx.price] ?? r;
  const areaLabel = (r: string) => fx.area[r as keyof typeof fx.area] ?? r;
  const finishingOptions = Object.entries(finishingLabels).map(([value, label]) => ({ value, label }));
  const deliveryOptions = t.deliveryOptions.filter((o) => o.value);
  const areaOptions = AREA_RANGES.filter((r) => r.value).map((r) => ({ value: r.value, label: areaLabel(r.value) }));
  const roomOptions = ROOMS.filter((r) => r.value).map((r) => ({ value: r.value, label: roomLabel(r.value) }));
  const statusOptions = statuses.filter((s) => s.value);
  const moreCount = MORE_KEYS.filter((k) => initial[k]).length;

  // The chips: every filter in the URL, labelled the way the visitor chose it.
  const chips: Array<{ key: Key; label: string }> = [];
  const add = (key: Key, label: string | undefined) => initial[key] && label && chips.push({ key, label });
  add('projectId', projects.find((p) => p.value === initial.projectId)?.label ?? t.withinProject);
  add('type', typeOptions.find((x) => x.value === initial.type)?.label ?? initial.type);
  add('bedrooms', `${roomLabel(initial.bedrooms)} ${t.roomSuffix}`);
  add('price', priceLabel(initial.price));
  add('finishing', finishingLabels[initial.finishing ?? '']);
  add('delivery', deliveryOptions.find((o) => o.value === initial.delivery)?.label);
  add('area', areaLabel(initial.area));
  add('bathrooms', `${roomLabel(initial.bathrooms)} ${t.bathroomSuffix}`);
  add('status', statusOptions.find((s) => s.value === initial.status)?.label);
  add('city', locale === 'en' ? cityLabel(initial.city, locale) : initial.city);
  add('usage', siteT(locale).home.search.tabs.find((x) => x.usage === initial.usage)?.label);

  return (
    <div>
      <div className="relative" ref={panelRef}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({});
          }}
          className="grid grid-cols-2 gap-2.5 rounded-[22px] border border-hairline bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)] sm:p-4 lg:flex lg:flex-row"
        >
          {projects.length > 0 && (
            <FieldSelect label={l.project} value={v.projectId} onChange={(x) => { set('projectId', x); go({ projectId: x }); }} className="lg:flex-1">
              <option value="">{l.allProjects}</option>
              {projects.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </FieldSelect>
          )}
          <FieldSelect label={t.propertyType} value={v.type} onChange={(x) => { set('type', x); go({ type: x }); }} className="lg:flex-1">
            <option value="">{fx.allTypes}</option>
            {typeOptions.map((tp) => (
              <option key={tp.value} value={tp.value}>{tp.label}</option>
            ))}
          </FieldSelect>
          <FieldSelect label={t.bedrooms} value={v.bedrooms} onChange={(x) => { set('bedrooms', x); go({ bedrooms: x }); }} className="lg:flex-1">
            <option value="">{t.allRooms}</option>
            {roomOptions.map((r) => (
              <option key={r.value} value={r.value}>{`${r.label} ${t.roomSuffix}`}</option>
            ))}
          </FieldSelect>
          <FieldSelect label={t.priceRange} value={v.price} onChange={(x) => { set('price', x); go({ price: x }); }} className="lg:flex-1">
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{priceLabel(r.value)}</option>
            ))}
          </FieldSelect>
          <div className="col-span-2 flex gap-2.5">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-hairline bg-surface px-4 text-[15px] font-medium text-ink-strong transition-colors hover:border-ink-muted"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
              {l.moreFilters}
              {moreCount > 0 && (
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-navy px-1.5 text-xs text-white">{moreCount}</span>
              )}
            </button>
            <button type="submit" className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-6 text-[15px] font-semibold text-white transition-colors hover:bg-navy-700">
              <Search className="h-[18px] w-[18px]" aria-hidden />
              {t.search}
            </button>
          </div>
        </form>

        {open && (
          <div
            role="dialog"
            aria-label={l.moreFilters}
            className="absolute inset-x-0 top-[calc(100%+10px)] z-30 rounded-[22px] border border-hairline bg-surface p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)] sm:inset-x-auto sm:end-0 sm:w-[560px]"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Pills label={t.finishing} value={v.finishing ?? ''} options={finishingOptions} onChange={(x) => set('finishing', x)} />
              <Pills label={t.delivery} value={v.delivery ?? ''} options={deliveryOptions} onChange={(x) => set('delivery', x)} />
              <Pills label={t.area} value={v.area} options={areaOptions} onChange={(x) => set('area', x)} />
              <Pills label={t.bathrooms} value={v.bathrooms} options={roomOptions} onChange={(x) => set('bathrooms', x)} />
              <Pills label={t.unitStatus} value={v.status} options={statusOptions} onChange={(x) => set('status', x)} />
              {cities.length > 0 && (
                <FieldSelect label={siteT(locale).projectsFilter.cityLabel} value={v.city} onChange={(x) => set('city', x)} className="self-end">
                  <option value="">{siteT(locale).projectsFilter.allCities}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{locale === 'en' ? cityLabel(c, locale) : c}</option>
                  ))}
                </FieldSelect>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
              <button
                type="button"
                onClick={() => setV((cur) => ({ ...cur, finishing: '', delivery: '', area: '', bathrooms: '', status: '', city: '' }))}
                className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink-strong hover:underline"
              >
                {t.clearAll}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  go({});
                }}
                className="inline-flex h-11 items-center rounded-xl bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700"
              >
                {l.showResults}
              </button>
            </div>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => router.push(unitsHref({ ...initial, [c.key]: '' }) as never)}
              aria-label={l.remove(c.label)}
              className="inline-flex items-center gap-2 rounded-full bg-navy/[0.08] px-3.5 py-2 text-[13px] font-medium text-navy transition-colors hover:bg-navy/15 dark:bg-navy/30 dark:text-gold-200"
            >
              {c.label}
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => router.push(unitsHref({ projectId: '', city: '', type: '', usage: '', bedrooms: '', bathrooms: '', price: '', area: '', finishing: '', delivery: '', status: '', sort: initial.sort }) as never)}
            className="ms-1 text-[13px] font-medium text-ink-muted underline underline-offset-4 hover:text-ink-strong"
          >
            {t.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}

/** The bar above the cards: how many are shown, and the order. */
export function UnitsToolbar({
  values,
  shown,
  total,
  locale,
}: {
  values: UnitsFilterValues;
  shown: number;
  total: number;
  locale: Locale;
}) {
  const router = useRouter();
  const s = siteT(locale);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-[15px] text-ink-muted">{s.units.showing(shown, total)}</p>
      <FieldSelect
        label={s.listing.sort}
        value={values.sort}
        onChange={(x) => router.push(unitsHref({ ...values, sort: x }) as never)}
        className="h-11 w-56 rounded-xl"
      >
        {s.sortOptions.unit.map((o) => (
          <option key={o.value || 'default'} value={o.value}>{o.label}</option>
        ))}
      </FieldSelect>
    </div>
  );
}
