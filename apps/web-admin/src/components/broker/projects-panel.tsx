'use client';

import { useState, useMemo } from 'react';
import { Search, X, Building2 } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { ProjectCard } from '@/components/broker/project-card';

// ── Types ─────────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'PUBLISHED' | 'other';

interface Filters {
  query:        string;
  status:       StatusFilter;
  city:         string;
  activeOnly:   boolean;
  featuredOnly: boolean;
}

const DEFAULT: Filters = {
  query:        '',
  status:       'all',
  city:         '',
  activeOnly:   false,
  featuredOnly: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUniqueCities(projects: PortalProject[]): string[] {
  const seen = new Set<string>();
  return projects
    .map((p) => p.project.city)
    .filter((c) => c && !seen.has(c) && seen.add(c))
    .sort((a, b) => a.localeCompare(b, 'ar'));
}

function applyFilters(projects: PortalProject[], f: Filters): PortalProject[] {
  return projects.filter((p) => {
    if (f.query) {
      const q = f.query.toLowerCase();
      const hit =
        tx(p.project.name).toLowerCase().includes(q) ||
        p.project.city.toLowerCase().includes(q) ||
        tx(p.project.description).toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (f.status === 'PUBLISHED' && p.project.status !== 'PUBLISHED') return false;
    if (f.status === 'other'     && p.project.status === 'PUBLISHED') return false;
    if (f.city        && p.project.city !== f.city) return false;
    if (f.activeOnly  && !p.access.active)          return false;
    if (f.featuredOnly && !p.project.featured)      return false;
    return true;
  });
}

function isDefault(f: Filters) {
  return !f.query && f.status === 'all' && !f.city && !f.activeOnly && !f.featuredOnly;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatBadge({ label, value, dot }: { label: string; value: number; dot?: 'emerald' | 'brand' }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {dot && (
        <span className={cn(
          'inline-block h-2 w-2 rounded-full shrink-0',
          dot === 'emerald' ? 'bg-emerald-500' : 'bg-brand-500',
        )} />
      )}
      <span className="font-bold text-slate-800 tabular-nums">{value}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all select-none',
        active
          ? 'bg-brand-50 border-brand-200 text-brand-700'
          : 'bg-white border-hairline text-slate-500 hover:border-brand-200 hover:text-brand-700 hover:bg-brand-50/50',
      )}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />}
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProjectsPanel({ projects }: { projects: PortalProject[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT);

  const cities   = useMemo(() => getUniqueCities(projects), [projects]);
  const filtered = useMemo(() => applyFilters(projects, filters), [projects, filters]);
  const active   = !isDefault(filters);

  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: val }));

  const reset = () => setFilters(DEFAULT);

  // Stats (derived from full list, not filtered)
  const totalCount    = projects.length;
  const publishedCount = projects.filter((p) => p.project.status === 'PUBLISHED').length;
  const readyCount    = projects.filter((p) => p.access.active).length;

  // ── No projects at all ─────────────────────────────────────────────────────
  if (totalCount === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<Building2 />}
          title="لا توجد مشاريع متاحة بعد"
          description="بمجرد منحك صلاحيات على أي مشروع، ستظهر تفاصيله هنا."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Toolbar card ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-white shadow-sm px-4 py-3.5 flex flex-col gap-3">

        {/* Stats strip */}
        <div className="flex items-center gap-4 flex-wrap">
          <StatBadge value={totalCount} label="مشروع" />
          <span className="text-slate-200 hidden sm:inline">|</span>
          <StatBadge value={publishedCount} label="منشور" dot="emerald" />
          <span className="text-slate-200 hidden sm:inline">|</span>
          <StatBadge value={readyCount} label="جاهز للتسويق" dot="brand" />
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ابحث باسم المشروع أو المدينة…"
            value={filters.query}
            onChange={(e) => set('query', e.target.value)}
            className={cn(
              'w-full h-10 rounded-xl border bg-slate-50 ps-10 pe-9',
              'text-sm text-slate-800 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-300 focus:bg-white',
              'transition-all',
              filters.query ? 'border-brand-200 bg-white' : 'border-hairline',
            )}
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => set('query', '')}
              aria-label="مسح البحث"
              className="absolute end-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter chips row */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value as StatusFilter)}
            className={cn(
              'h-9 rounded-xl border px-3 text-xs font-medium text-slate-700 bg-white',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-300 transition-all',
              filters.status !== 'all' ? 'border-brand-200 text-brand-700 bg-brand-50' : 'border-hairline',
            )}
          >
            <option value="all">كل الحالات</option>
            <option value="PUBLISHED">منشور فقط</option>
            <option value="other">غير منشور</option>
          </select>

          {/* City — only shown if there's more than one city */}
          {cities.length > 1 && (
            <select
              value={filters.city}
              onChange={(e) => set('city', e.target.value)}
              className={cn(
                'h-9 rounded-xl border px-3 text-xs font-medium text-slate-700 bg-white',
                'focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-300 transition-all',
                filters.city ? 'border-brand-200 text-brand-700 bg-brand-50' : 'border-hairline',
              )}
            >
              <option value="">كل المدن</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* جاهز للتسويق toggle */}
          <FilterChip active={filters.activeOnly} onClick={() => set('activeOnly', !filters.activeOnly)}>
            جاهز للتسويق
          </FilterChip>

          {/* مميز toggle */}
          <FilterChip active={filters.featuredOnly} onClick={() => set('featuredOnly', !filters.featuredOnly)}>
            مميز
          </FilterChip>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Reset — only when filters are active */}
          {active && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-hairline transition-all"
            >
              <X className="h-3 w-3" />
              إعادة ضبط
            </button>
          )}
        </div>

        {/* Result count — shown when filters are active */}
        {active && (
          <p className="text-xs text-slate-400 -mt-1">
            {filtered.length === 0
              ? 'لا توجد نتائج مطابقة'
              : (
                <>
                  <span className="font-semibold text-slate-600">{filtered.length}</span>
                  {' من '}
                  <span className="font-semibold text-slate-600">{totalCount}</span>
                  {' مشروع'}
                </>
              )}
          </p>
        )}
      </div>

      {/* ── Project cards ─────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.project.id} p={p} />
          ))}
        </div>
      )}

      {/* ── Filtered empty state ──────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <Card className="p-0">
          <EmptyState
            icon={<Search />}
            title="لا توجد مشاريع تطابق البحث"
            description="جرّب تعديل كلمة البحث أو مسح الفلاتر النشطة."
            action={
              <Button variant="outline" size="sm" onClick={reset}>
                <X className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
