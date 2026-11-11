'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { routes } from '@/lib/routes';
import { SegmentedFilter } from '@/components/ui/SegmentedFilter';
import { FieldSelect } from '@/components/ui/FieldSelect';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { cityLabel } from '@/lib/format';

export interface ProjectsQuery {
  q: string;
  city: string;
  type: string;
  featured: boolean;
  sort: string;
}

/** The projects list URL for a set of filters (page 1). */
export function projectsHref(v: ProjectsQuery): string {
  const params = new URLSearchParams();
  if (v.q.trim()) params.set('q', v.q.trim());
  if (v.city) params.set('city', v.city);
  if (v.type) params.set('type', v.type);
  if (v.featured) params.set('featured', 'true');
  if (v.sort) params.set('sort', v.sort);
  const qs = params.toString();
  return qs ? `${routes.projects}?${qs}` : routes.projects;
}

/** Search, city and type over the page header; «بحث» applies them. */
export function ProjectsFilterBar({
  initial,
  cities,
  locale,
}: {
  initial: ProjectsQuery;
  cities: string[];
  locale: Locale;
}) {
  const router = useRouter();
  const t = siteT(locale).projectsFilter;
  const projectTypes = siteT(locale).projectTypes;
  const [q, setQ] = useState(initial.q);
  const [city, setCity] = useState(initial.city);
  const [type, setType] = useState(initial.type);

  const go = (next: Partial<ProjectsQuery>) => router.push(projectsHref({ ...initial, q, city, type, ...next }) as never);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go({});
      }}
      className="grid grid-cols-2 gap-2.5 rounded-[22px] border border-hairline bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)] sm:p-4 lg:flex lg:flex-row"
    >
      <label className="relative col-span-2 flex h-[52px] min-w-0 flex-[2] items-center gap-2.5 rounded-2xl border border-hairline bg-canvas px-4 focus-within:border-navy/50 focus-within:ring-2 focus-within:ring-navy/15">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-strong outline-none placeholder:text-ink-muted"
        />
      </label>
      {cities.length > 0 && (
        <FieldSelect label={t.cityLabel} value={city} onChange={(v) => { setCity(v); go({ city: v }); }} className="flex-1">
          <option value="">{t.allCities}</option>
          {cities.map((c) => (
            <option key={c} value={c}>{locale === 'en' ? cityLabel(c, locale) : c}</option>
          ))}
        </FieldSelect>
      )}
      <FieldSelect label={t.typeLabel} value={type} onChange={(v) => { setType(v); go({ type: v }); }} className="flex-1">
        <option value="">{t.allTypes}</option>
        {Object.entries(projectTypes).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </FieldSelect>
      <button type="submit" className="col-span-2 inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-navy px-7 text-[15px] font-semibold text-white transition-colors hover:bg-navy-700">
        <Search className="h-[18px] w-[18px]" aria-hidden />
        {t.searchLabel}
      </button>
    </form>
  );
}

/** The bar above the cards: how many are shown, all / featured, and the order. */
export function ProjectsToolbar({
  query,
  shown,
  total,
  locale,
}: {
  query: ProjectsQuery;
  shown: number;
  total: number;
  locale: Locale;
}) {
  const router = useRouter();
  const s = siteT(locale);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-[15px] text-ink-muted">{s.projects.showing(shown, total)}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedFilter
          active={query.featured ? 'featured' : 'all'}
          items={[
            { key: 'all', label: s.listing.all, onClick: () => router.push(projectsHref({ ...query, featured: false }) as never) },
            { key: 'featured', label: s.listing.featuredOnly, onClick: () => router.push(projectsHref({ ...query, featured: true }) as never) },
          ]}
        />
        <FieldSelect
          label={s.listing.sort}
          value={query.sort}
          onChange={(v) => router.push(projectsHref({ ...query, sort: v }) as never)}
          className="h-11 w-44 rounded-xl"
        >
          {s.sortOptions.project.map((o) => (
            <option key={o.value || 'default'} value={o.value}>{o.label}</option>
          ))}
        </FieldSelect>
      </div>
    </div>
  );
}
