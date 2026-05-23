'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { Select, Field } from '@/components/ui/Input';

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة'];
const TYPES: Array<{ value: string; label: string }> = [
  { value: 'studio', label: 'استوديو' },
  { value: '1BR', label: 'غرفة نوم' },
  { value: '2BR', label: 'غرفتا نوم' },
  { value: '3BR', label: 'ثلاث غرف' },
  { value: 'villa', label: 'فيلا' },
];
const PRICE_RANGES: Array<{ value: string; label: string; min?: string; max?: string }> = [
  { value: '', label: 'كل الأسعار' },
  { value: '0-500000', label: 'حتى ٥٠٠ ألف', max: '500000' },
  { value: '500000-1000000', label: '٥٠٠ ألف – مليون', min: '500000', max: '1000000' },
  { value: '1000000-2000000', label: 'مليون – مليونان', min: '1000000', max: '2000000' },
  { value: '2000000-', label: 'أكثر من مليونين', min: '2000000' },
];

/**
 * Premium quick-search strip. W3 is link-based: it builds a /units query string
 * (full filtering UI lands in W6). City is carried as a param for the future
 * units page to interpret.
 */
export function SearchBar() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');

  function onSearch() {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (type) params.set('type', type);
    const range = PRICE_RANGES.find((r) => r.value === price);
    if (range?.min) params.set('priceMin', range.min);
    if (range?.max) params.set('priceMax', range.max);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  return (
    <div className="rounded-3xl border border-hairline bg-surface/95 p-5 shadow-card backdrop-blur-md sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <Field label="المدينة">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="المدينة">
            <option value="">كل المدن</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="نوع العقار">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="نوع العقار">
            <option value="">كل الأنواع</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="نطاق السعر">
          <Select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="نطاق السعر">
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button onClick={onSearch} size="lg" className="w-full">
          <Search className="h-5 w-5" aria-hidden />
          ابدأ البحث
        </Button>
      </div>
    </div>
  );
}
