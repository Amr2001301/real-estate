'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star, X, ArrowDownUp, ChevronDown } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { PROJECT_SORT_OPTIONS } from '@/lib/sort-options';

interface ProjectsFilterBarProps {
  initialQ: string;
  initialFeatured: boolean;
  initialSort: string;
}

/**
 * Slim premium filter bar. Drives the listing through the querystring (q +
 * featured) — both already supported by the public projects endpoint. `q`
 * also matches city server-side, so it doubles as a location search.
 */
export function ProjectsFilterBar({ initialQ, initialFeatured, initialSort }: ProjectsFilterBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [featured, setFeatured] = useState(initialFeatured);
  const [sort, setSort] = useState(initialSort);

  function apply(next: { q?: string; featured?: boolean; sort?: string }) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextFeatured = next.featured ?? featured;
    const nextSort = next.sort ?? sort;
    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextFeatured) params.set('featured', 'true');
    if (nextSort) params.set('sort', nextSort);
    const qs = params.toString();
    router.push((qs ? `${routes.projects}?${qs}` : routes.projects) as never);
  }

  function reset() {
    setQ('');
    setFeatured(false);
    setSort('');
    router.push(routes.projects as never);
  }

  const hasFilters = q.trim() !== '' || featured || sort !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply({});
      }}
      className="rounded-3xl border border-hairline bg-surface p-5 shadow-soft sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted/60" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن مشروع أو مدينة..."
            aria-label="بحث"
            className="pr-12"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const nextFeatured = !featured;
            setFeatured(nextFeatured);
            apply({ featured: nextFeatured });
          }}
          aria-pressed={featured}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors duration-200',
            featured
              ? 'border-gold-300 bg-gold-100 text-gold-600'
              : 'border-hairline text-ink-muted hover:border-hairline/30 hover:text-ink-strong',
          )}
        >
          <Star className={cn('h-4 w-4', featured && 'fill-gold-400 text-gold-500')} aria-hidden />
          مشاريع مميزة
        </button>

        <div className="relative">
          <ArrowDownUp className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-500" aria-hidden />
          <Select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              apply({ sort: e.target.value });
            }}
            aria-label="ترتيب حسب"
            className="h-12 pr-11 pl-9"
          >
            {PROJECT_SORT_OPTIONS.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/50" aria-hidden />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="md">
            تحديث النتائج
          </Button>
          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink-strong"
            >
              <X className="h-4 w-4" aria-hidden />
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
