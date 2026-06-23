'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { PRICE_RANGES } from '@/lib/unit-filters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const TABS: Array<{ key: string; label: string; type: string }> = [
  { key: 'res',   label: 'سكني',   type: '' },
  { key: 'admin', label: 'إداري',  type: 'office' },
  { key: 'comm',  label: 'تجاري',  type: 'retail' },
  { key: 'med',   label: 'طبي',    type: '' },
  { key: 'hotel', label: 'فندقي',  type: '' },
];

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة'];
const STATUSES = [
  { value: '', label: 'كل الحالات' },
  { value: 'AVAILABLE', label: 'متاحة' },
  { value: 'RESERVED', label: 'محجوزة' },
  { value: 'SOLD', label: 'مباعة' },
];

const SELECT_CLS =
  'h-12 w-full rounded-2xl border border-hairline bg-surface px-4 text-[15px] text-ink shadow-sm transition-colors duration-200 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40';

export function SearchPanel() {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0]!.key);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('');

  function onSearch() {
    if (q.trim()) {
      router.push(`${routes.projects}?q=${encodeURIComponent(q.trim())}` as never);
      return;
    }
    const params = new URLSearchParams();
    const type = TABS.find((t) => t.key === tab)?.type ?? '';
    if (type) params.set('type', type);
    if (city) params.set('city', city);
    if (status) params.set('status', status);
    const range = PRICE_RANGES.find((r) => r.value === price);
    if (range?.min) params.set('priceMin', range.min);
    if (range?.max) params.set('priceMax', range.max);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  return (
    <div className="rounded-3xl border border-hairline bg-surface/95 shadow-[0_24px_64px_-24px_rgba(15,30,51,0.38)] backdrop-blur-md">
      {/* Property-type tabs */}
      <div className="flex flex-wrap gap-2 border-b border-hairline px-5 py-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200',
              tab === t.key
                ? 'bg-navy text-white shadow-soft'
                : 'text-ink-muted hover:bg-surface-soft hover:text-ink-strong',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1.8fr_1fr_1fr_1fr_auto]"
      >
        {/* Search input */}
        <div className="relative lg:col-span-1">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/60" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المشروع أو المدينة..."
            aria-label="بحث"
            className="h-12 pr-11"
          />
        </div>

        {/* City */}
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="المدينة"
          className={SELECT_CLS}
        >
          <option value="">المدينة</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Price range */}
        <select
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label="نطاق السعر"
          className={SELECT_CLS}
        >
          {PRICE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="الحالة"
          className={SELECT_CLS}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <Button type="submit" size="md" className="h-12 w-full gap-2 lg:w-auto">
          <Search className="h-4 w-4" aria-hidden />
          ابدأ البحث
        </Button>
      </form>
    </div>
  );
}
