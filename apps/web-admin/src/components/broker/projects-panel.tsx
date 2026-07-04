'use client';

import { useState, useMemo } from 'react';
import { Search, Building2, CheckCircle2, Star, Sparkles, LayoutGrid } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { ProjectCard } from '@/components/broker/project-card';

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

// ── KPI Tile ──────────────────────────────────────────────────────────────────
interface KpiTileProps {
  label:    string;
  value:    number;
  icon:     React.ReactNode;
  topBar:   string;
  iconCls:  string;
  valueCls: string;
}

function KpiTile({ label, value, icon, topBar, iconCls, valueCls }: KpiTileProps) {
  return (
    <div className="relative bg-surface rounded-[18px] border border-hairline shadow-soft overflow-hidden">
      <div className={cn('h-[3px] bg-gradient-to-l', topBar)} />
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={cn(
          'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4',
          iconCls,
        )}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={cn('text-xl font-black tabular-nums leading-none', valueCls)}>{value}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">{label}</p>
        </div>
      </div>
    </div>
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
export function ProjectsPanel({ projects }: { projects: PortalProject[] }) {
  const [pending,  setPending]  = useState<Filters>(DEFAULT);
  const [applied,  setApplied]  = useState<Filters>(DEFAULT);

  const cities      = useMemo(() => getUniqueCities(projects), [projects]);
  const filtered    = useMemo(() => applyFilters(projects, applied), [projects, applied]);
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
          title="لا توجد مشاريع متاحة بعد"
          description="بمجرد منحك صلاحيات على أي مشروع، ستظهر تفاصيله هنا."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="إجمالي المشاريع"
          value={totalCount}
          icon={<Building2 />}
          topBar="from-brand-300 via-brand-500 to-brand-300"
          iconCls="bg-brand-50 text-brand-600 ring-1 ring-brand-100"
          valueCls="text-brand-700"
        />
        <KpiTile
          label="منشور"
          value={publishedCount}
          icon={<CheckCircle2 />}
          topBar="from-emerald-300 via-emerald-500 to-emerald-300"
          iconCls="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
          valueCls="text-emerald-700"
        />
        <KpiTile
          label="جاهز للتسويق"
          value={readyCount}
          icon={<LayoutGrid />}
          topBar="from-sky-300 via-sky-500 to-sky-300"
          iconCls="bg-sky-50 text-sky-600 ring-1 ring-sky-100"
          valueCls="text-sky-700"
        />
        <KpiTile
          label="مميز"
          value={featuredCount}
          icon={<Sparkles />}
          topBar="from-amber-300 via-amber-500 to-amber-300"
          iconCls="bg-amber-50 text-amber-600 ring-1 ring-amber-100"
          valueCls="text-amber-700"
        />
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-4 py-3 shadow-soft">

        {/* Search */}
        <Input
          inputSize="sm"
          leftAddon={<Search />}
          placeholder="ابحث باسم المشروع أو المدينة…"
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
          <option value="all">كل الحالات</option>
          <option value="PUBLISHED">منشور</option>
          <option value="other">غير منشور</option>
        </Select>

        {/* City — only when there are multiple cities */}
        {cities.length > 1 && (
          <Select
            inputSize="sm"
            value={pending.city}
            onChange={(e) => set('city', e.target.value)}
            className="w-32 shrink-0"
          >
            <option value="">كل المدن</option>
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
          <option value="all">كل المشاريع</option>
          <option value="yes">جاهز للتسويق</option>
        </Select>

        {/* "مميز" toggle — only when at least one project is featured */}
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
            مميز
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="button" variant="primary" size="sm" onClick={handleApply}>
            تصفية
          </Button>
          {anyApplied && (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              مسح
            </Button>
          )}
        </div>
      </div>

      {/* ── Projects list ─────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>
              {anyApplied ? 'نتائج البحث' : 'المشاريع المتاحة'}
            </SectionLabel>
            {anyApplied && (
              <span className="text-2xs text-slate-400 tabular-nums shrink-0">
                {filtered.length} من {totalCount}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {filtered.map((p) => (
              <ProjectCard key={p.project.id} p={p} />
            ))}
          </div>
        </div>
      )}

      {/* ── Filtered empty state ──────────────────────────────────────────── */}
      {filtered.length === 0 && anyApplied && (
        <Card className="p-0">
          <EmptyState
            icon={<Search />}
            title="لا توجد مشاريع تطابق البحث"
            description="جرّب تعديل كلمة البحث أو مسح الفلاتر النشطة."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                مسح التصفية
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
