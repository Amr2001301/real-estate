'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { PRICE_RANGES } from '@/lib/unit-filters';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

// Category tabs map to a real unit `type` filter where one exists; kinds with
// no backend type (طبي/فندقي) route to the general units listing (UI-level).
const TABS: Array<{ key: string; label: string; type: string }> = [
  { key: 'res', label: 'سكني', type: '' },
  { key: 'admin', label: 'إداري', type: 'office' },
  { key: 'comm', label: 'تجاري', type: 'retail' },
  { key: 'med', label: 'طبي', type: '' },
  { key: 'hotel', label: 'فندقي', type: '' },
];

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة'];
const STATUSES = [
  { value: '', label: 'كل الحالات' },
  { value: 'AVAILABLE', label: 'متاحة' },
  { value: 'RESERVED', label: 'محجوزة' },
  { value: 'SOLD', label: 'مباعة' },
];

export function SearchPanel() {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0]!.key);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('');

  function onSearch() {
    // Free-text targets projects (name/city search is supported there).
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
    <div className="rounded-3xl border border-hairline bg-surface/95 p-3 shadow-[0_24px_64px_-24px_rgba(15,30,51,0.40)] backdrop-blur-md sm:p-4">
      {/* Property-type segmented control (RTL-aligned) */}
      <div className="mb-3 inline-flex flex-wrap gap-1 rounded-full bg-surface-soft p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-navy text-white shadow-soft' : 'text-ink-muted hover:text-navy',
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
        className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted/60" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المشروع أو المدينة..."
            aria-label="بحث"
            className="h-12 pr-11"
          />
        </div>
        <div className="relative">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="المدينة" className="h-12 pl-9">
            <option value="">المدينة</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/60" aria-hidden />
        </div>
        <div className="relative">
          <Select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="نطاق السعر" className="h-12 pl-9">
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/60" aria-hidden />
        </div>
        <div className="relative">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة" className="h-12 pl-9">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/60" aria-hidden />
        </div>
        <Button type="submit" size="md" className="h-12 w-full lg:w-auto">
          <Search className="h-5 w-5" aria-hidden />
          ابدأ البحث
        </Button>
      </form>
    </div>
  );
}
