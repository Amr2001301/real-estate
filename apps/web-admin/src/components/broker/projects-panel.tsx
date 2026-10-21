'use client';

import { useState, useMemo } from 'react';
import { Search, Building2, Star } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { ProjectCard } from '@/components/broker/project-card';
import { FigureBar } from '@/components/cockpit/cockpit';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Filters {
  query:    string;
  status:   'all' | 'PUBLISHED' | 'other';
  city:     string;
  active:   'all' | 'yes';
  featured: boolean;
}

const DEFAULT: Filters = {
  query:    '',
  status:   'all',
  city:     '',
  active:   'all',
  featured: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUniqueCities(projects: PortalProject[], sortLocale: string): string[] {
  const seen = new Set<string>();
  return projects
    .map((p) => p.project.city)
    .filter((c) => c && !seen.has(c) && seen.add(c))
    .sort((a, b) => a.localeCompare(b, sortLocale));
}

function applyFilters(projects: PortalProject[], f: Filters, locale: Locale): PortalProject[] {
  return projects.filter((p) => {
    if (f.query) {
      const q = f.query.toLowerCase();
      const hit =
        tx(p.project.name, locale).toLowerCase().includes(q) ||
        p.project.city.toLowerCase().includes(q) ||
        tx(p.project.description, locale).toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (f.status === 'PUBLISHED' && p.project.status !== 'PUBLISHED') return false;
    if (f.status === 'other'     && p.project.status === 'PUBLISHED') return false;
    if (f.city                   && p.project.city   !== f.city)       return false;
    if (f.active === 'yes'       && !p.access.active)                  return false;
    if (f.featured               && !p.project.featured)               return false;
    return true;
  });
}

function isDefault(f: Filters) {
  return (
    !f.query            &&
    f.status   === 'all' &&
    !f.city              &&
    f.active   === 'all' &&
    !f.featured
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{children}</span>
      <span className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProjectsPanel({
  projects,
  symbol,
  locale = 'ar',
  defaultPct,
  available,
}: {
  projects: PortalProject[];
  /** The company currency's symbol (currencySymbol(getReportsCurrency())). */
  symbol: string;
  locale?: Locale;
  /** The firm's default commission %, shown where a project sets none. */
  defaultPct?: number | null;
  /** AVAILABLE units per project id. */
  available?: Record<string, number>;
}) {
  const t = portalSharedT(locale).projectsPanel;
  const currencySymbol = symbol;
  const [pending,  setPending]  = useState<Filters>(DEFAULT);
  const [applied,  setApplied]  = useState<Filters>(DEFAULT);

  const cities      = useMemo(() => getUniqueCities(projects, t.sortLocale), [projects, t.sortLocale]);
  const filtered    = useMemo(() => applyFilters(projects, applied, locale), [projects, applied, locale]);
  const anyApplied  = !isDefault(applied);
  const hasFeatured = projects.some((p) => p.project.featured);

  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setPending((f) => ({ ...f, [key]: val }));

  const handleApply = () => setApplied({ ...pending });

  const handleReset = () => {
    setPending(DEFAULT);
    setApplied(DEFAULT);
  };

  const totalCount     = projects.length;
  const publishedCount = projects.filter((p) => p.project.status === 'PUBLISHED').length;
  const readyCount     = projects.filter((p) => p.access.active).length;
  const featuredCount  = projects.filter((p) => p.project.featured).length;

  // ── No projects from API ───────────────────────────────────────────────────
  if (totalCount === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<Building2 />}
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Figures ───────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.kpiTotal, value: totalCount },
            { label: t.kpiPublished, value: publishedCount },
            { label: t.kpiReady, value: readyCount },
            { label: t.kpiFeatured, value: featuredCount },
          ]}
        />
      </section>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-hairline bg-surface px-4 py-3">

        {/* Search */}
        <Input
          inputSize="sm"
          leftAddon={<Search />}
          placeholder={t.searchPlaceholder}
          value={pending.query}
          onChange={(e) => set('query', e.target.value)}
          className="min-w-[180px] flex-1"
        />

        {/* Status */}
        <Select
          inputSize="sm"
          value={pending.status}
          onChange={(e) => set('status', e.target.value as Filters['status'])}
          className="w-36 shrink-0"
        >
          <option value="all">{t.allStatuses}</option>
          <option value="PUBLISHED">{t.published}</option>
          <option value="other">{t.unpublished}</option>
        </Select>

        {/* City — only when there are multiple cities */}
        {cities.length > 1 && (
          <Select
            inputSize="sm"
            value={pending.city}
            onChange={(e) => set('city', e.target.value)}
            className="w-32 shrink-0"
          >
            <option value="">{t.allCities}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        )}

        {/* Ready for marketing */}
        <Select
          inputSize="sm"
          value={pending.active}
          onChange={(e) => set('active', e.target.value as Filters['active'])}
          className="w-40 shrink-0"
        >
          <option value="all">{t.allProjects}</option>
          <option value="yes">{t.readyForMarketing}</option>
        </Select>

        {/* "Featured" toggle — only when at least one project is featured */}
        {hasFeatured && (
          <button
            type="button"
            onClick={() => set('featured', !pending.featured)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-all select-none shrink-0',
              pending.featured
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-surface border-hairline text-slate-700 hover:border-slate-300',
            )}
          >
            <Star className={cn('h-3 w-3', pending.featured ? 'fill-amber-400 text-amber-400' : 'text-slate-400')} />
            {t.featured}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="button" variant="primary" size="sm" onClick={handleApply}>
            {t.apply}
          </Button>
          {anyApplied && (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              {t.clear}
            </Button>
          )}
        </div>
      </div>

      {/* ── Projects list ─────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>
              {anyApplied ? t.searchResults : t.availableProjects}
            </SectionLabel>
            {anyApplied && (
              <span className="text-2xs text-slate-400 tabular-nums shrink-0">
                {t.countOfTotal(filtered.length, totalCount)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filtered.map((p) => (
              <ProjectCard
                key={p.project.id}
                p={p}
                symbol={currencySymbol}
                locale={locale}
                defaultPct={defaultPct}
                available={available?.[p.project.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Filtered empty state ──────────────────────────────────────────── */}
      {filtered.length === 0 && anyApplied && (
        <Card className="p-0">
          <EmptyState
            icon={<Search />}
            title={t.noMatchTitle}
            description={t.noMatchDescription}
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                {t.clearFilters}
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
