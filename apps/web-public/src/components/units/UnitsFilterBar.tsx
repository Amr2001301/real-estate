'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Layers } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Select, Field } from '@/components/ui/Input';
import { PRICE_RANGES, UNIT_TYPES as TYPES, ROOM_OPTIONS as ROOMS } from '@/lib/unit-filters';

export interface UnitsFilterValues {
  projectId: string;
  city: string;
  type: string;
  bedrooms: string;
  bathrooms: string;
  price: string;
  status: string;
}

const STATUSES = [
  { value: 'AVAILABLE', label: 'متاحة' },
  { value: 'RESERVED', label: 'محجوزة' },
  { value: 'SOLD', label: 'مباعة' },
];

export function UnitsFilterBar({ initial }: { initial: UnitsFilterValues }) {
  const router = useRouter();
  const [type, setType] = useState(initial.type);
  const [bedrooms, setBedrooms] = useState(initial.bedrooms);
  const [bathrooms, setBathrooms] = useState(initial.bathrooms);
  const [price, setPrice] = useState(initial.price);
  const [status, setStatus] = useState(initial.status);

  function pushWith(next: Partial<UnitsFilterValues>) {
    const v = { type, bedrooms, bathrooms, price, status, ...next };
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
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  function reset() {
    setType('');
    setBedrooms('');
    setBathrooms('');
    setPrice('');
    setStatus('');
    const params = new URLSearchParams();
    if (initial.projectId) params.set('projectId', initial.projectId);
    if (initial.city) params.set('city', initial.city);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  const hasFilters = Boolean(type || bedrooms || bathrooms || price || status);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        pushWith({});
      }}
      className="rounded-3xl border border-hairline bg-surface p-5 shadow-soft sm:p-6"
    >
      {initial.projectId && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1.5 text-xs font-medium text-gold-600">
          <Layers className="h-4 w-4" aria-hidden />
          داخل مشروع محدد
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="نوع العقار">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="نوع العقار">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="غرف النوم">
          <Select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} aria-label="غرف النوم">
            {ROOMS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="دورات المياه">
          <Select value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} aria-label="دورات المياه">
            {ROOMS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="نطاق السعر">
          <Select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="نطاق السعر">
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">الحالة:</span>
        {STATUSES.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const next = active ? '' : s.value;
                setStatus(next);
                pushWith({ status: next });
              }}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-navy bg-navy text-white'
                  : 'border-hairline text-ink-muted hover:border-navy/30 hover:text-navy',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" size="md">
          <Search className="h-5 w-5" aria-hidden />
          تحديث النتائج
        </Button>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-navy"
          >
            <X className="h-4 w-4" aria-hidden />
            مسح الفلاتر
          </button>
        )}
      </div>
    </form>
  );
}
