'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

const SELECT_CLS =
  'h-12 w-full rounded-2xl border border-hairline bg-surface px-4 text-[15px] text-ink shadow-sm transition-colors duration-200 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-400/40';

export function SearchPanel({ locale }: { locale: Locale }) {
  const router = useRouter();
  const m = siteT(locale).home.search;

  const [tab, setTab] = useState<string>(m.tabs[0]!.key);
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
    const type = m.tabs.find((t) => t.key === tab)?.type ?? '';
    if (type) params.set('type', type);
    if (city) params.set('city', city);
    if (status) params.set('status', status);
    const range = m.priceRanges.find((r) => r.value === price);
    if (range?.min) params.set('priceMin', range.min);
    if (range?.max) params.set('priceMax', range.max);
    const qs = params.toString();
    router.push((qs ? `${routes.units}?${qs}` : routes.units) as never);
  }

  return (
    <div className="rounded-3xl border border-hairline bg-surface/95 shadow-[0_24px_64px_-24px_rgba(15,30,51,0.38)] backdrop-blur-md">
      {/* Property-type tabs */}
      <div className="flex flex-wrap gap-2 border-b border-hairline px-5 py-4">
        {m.tabs.map((t) => (
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
            placeholder={m.placeholder}
            aria-label={m.placeholder}
            className="h-12 pr-11"
          />
        </div>

        {/* City */}
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label={m.allCities}
          className={SELECT_CLS}
        >
          <option value="">{m.allCities}</option>
          {m.cities.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Price range */}
        <select
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label={m.priceRanges[0]!.label}
          className={SELECT_CLS}
        >
          {m.priceRanges.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={m.statuses[0]!.label}
          className={SELECT_CLS}
        >
          {m.statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <Button type="submit" size="md" className="h-12 w-full gap-2 lg:w-auto">
          <Search className="h-4 w-4" aria-hidden />
          {m.button}
        </Button>
      </form>
    </div>
  );
}
