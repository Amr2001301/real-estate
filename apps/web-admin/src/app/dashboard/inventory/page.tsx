import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Boxes,
  CircleDollarSign,
  Calculator,
  AlertCircle,
  Search,
  Building2,
  Layers,
  Home,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Unit, Project, UnitStatus } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// TODO(backend): when inventory grows beyond ~1000 units, the client-side
// aggregation below becomes expensive. Add a dedicated
// GET /units/inventory-matrix endpoint that returns pre-grouped totals
// (per project / phase / building × status + sum(price)) and switch this
// page to consume it. The current shape mirrors what such an endpoint
// would return, so the UI won't need to change.
const SNAPSHOT_SIZE = 1000;

type StatusFilter = 'all' | UnitStatus;

interface Search {
  q?: string;
  status?: string;
  projectId?: string;
}

interface BuildingBucket {
  id: string;
  name: string;
  available: number;
  reserved: number;
  sold: number;
  total: number;
  totalValue: number;
}

interface PhaseBucket {
  id: string;
  name: string;
  buildings: Map<string, BuildingBucket>;
  available: number;
  reserved: number;
  sold: number;
  total: number;
  totalValue: number;
}

interface ProjectBucket {
  id: string;
  name: string;
  city: string | null;
  phases: Map<string, PhaseBucket>;
  available: number;
  reserved: number;
  sold: number;
  total: number;
  totalValue: number;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  // SALES browses inventory read-only; the units link is read-only for them.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const q = (sp.q ?? '').trim();
  const status: StatusFilter =
    sp.status === 'AVAILABLE' || sp.status === 'RESERVED' || sp.status === 'SOLD'
      ? sp.status
      : 'all';
  const projectId = sp.projectId?.trim() || '';

  // We fetch a single large snapshot and aggregate client-side. The /units
  // endpoint already includes building.phase.project in each row, so we have
  // everything we need to build the matrix without N+1 calls.
  const unitsQs = new URLSearchParams({ pageSize: String(SNAPSHOT_SIZE) });
  if (projectId) unitsQs.set('projectId', projectId);

  const [unitsRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Unit>>(`/units?${unitsQs.toString()}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  // Permission/403 errors should not crash the page — show the banner and
  // render empty matrix.
  const loadError = unitsRes.error;
  const projectsError = projectsRes.error;

  const allUnits = unitsRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  // Apply free-text search (project, building, unit code) and status filter.
  let units = allUnits;
  if (q) {
    const needle = q.toLowerCase();
    units = units.filter((u) => {
      const projectName = u.building?.phase?.project?.name
        ? `${u.building.phase.project.name.ar ?? ''} ${
            u.building.phase.project.name.en ?? ''
          }`.toLowerCase()
        : '';
      const buildingName = (u.building?.name ?? '').toLowerCase();
      const code = (u.code ?? '').toLowerCase();
      return (
        projectName.includes(needle) ||
        buildingName.includes(needle) ||
        code.includes(needle)
      );
    });
  }
  const matrixUnits = status === 'all' ? units : units.filter((u) => u.status === status);

  // KPIs: always computed on the full snapshot (or current search) so the
  // numbers don't change when toggling status. Status filter only narrows
  // the matrix rows.
  const total = units.length;
  const available = units.filter((u) => u.status === 'AVAILABLE').length;
  const reserved = units.filter((u) => u.status === 'RESERVED').length;
  const sold = units.filter((u) => u.status === 'SOLD').length;
  const inventoryValue = units.reduce((s, u) => s + Number(u.price ?? 0), 0);
  const avgPrice = total > 0 ? inventoryValue / total : 0;

  // ── Build project → phase → building matrix ─────────────────────────────
  const matrix = new Map<string, ProjectBucket>();
  for (const u of matrixUnits) {
    const proj = u.building?.phase?.project;
    const phase = u.building?.phase;
    const bld = u.building;
    if (!proj || !phase || !bld) continue;

    let pBucket = matrix.get(proj.id);
    if (!pBucket) {
      pBucket = {
        id: proj.id,
        name: tx(proj.name),
        city: proj.city ?? null,
        phases: new Map(),
        available: 0,
        reserved: 0,
        sold: 0,
        total: 0,
        totalValue: 0,
      };
      matrix.set(proj.id, pBucket);
    }

    let phBucket = pBucket.phases.get(phase.id);
    if (!phBucket) {
      phBucket = {
        id: phase.id,
        name: tx(phase.name),
        buildings: new Map(),
        available: 0,
        reserved: 0,
        sold: 0,
        total: 0,
        totalValue: 0,
      };
      pBucket.phases.set(phase.id, phBucket);
    }

    let bBucket = phBucket.buildings.get(bld.id);
    if (!bBucket) {
      bBucket = {
        id: bld.id,
        name: bld.name,
        available: 0,
        reserved: 0,
        sold: 0,
        total: 0,
        totalValue: 0,
      };
      phBucket.buildings.set(bld.id, bBucket);
    }

    const price = Number(u.price ?? 0);
    bBucket.total++;
    bBucket.totalValue += price;
    phBucket.total++;
    phBucket.totalValue += price;
    pBucket.total++;
    pBucket.totalValue += price;
    if (u.status === 'AVAILABLE') {
      bBucket.available++;
      phBucket.available++;
      pBucket.available++;
    } else if (u.status === 'RESERVED') {
      bBucket.reserved++;
      phBucket.reserved++;
      pBucket.reserved++;
    } else if (u.status === 'SOLD') {
      bBucket.sold++;
      phBucket.sold++;
      pBucket.sold++;
    }
  }

  const projectBuckets = [...matrix.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar'),
  );

  // Query-string helper for filter tabs and pagination links.
  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'all') params.set('status', status);
    if (projectId) params.set('projectId', projectId);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : '';
  };

  const unitsHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (projectId) params.set('projectId', projectId);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return `/dashboard/units${s ? `?${s}` : ''}`;
  };

  return (
    <div className="space-y-5">

      {/* ── 1. Page header ──────────────────────────────────────────────────── */}
      <PageHeader
        title="لوحة المخزون"
        description="نظرة شاملة على توفر الوحدات وقيمة المخزون عبر المشاريع والمراحل."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المخزون' },
        ]}
        actions={
          <Link href={unitsHref({})}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
            >
              {isAdmin ? 'إدارة الوحدات' : 'عرض الوحدات'}
            </Button>
          </Link>
        }
      />

      {/* ── 2. Inventory summary panel ──────────────────────────────────────── */}
      <InventorySummaryPanel
        inventoryValue={inventoryValue}
        avgPrice={avgPrice}
        total={total}
        available={available}
        reserved={reserved}
        sold={sold}
      />

      {/* ── Error banners ────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل المخزون: {loadError}</p>
        </div>
      )}
      {projectsError && !loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل قائمة المشاريع للفلترة: {projectsError}</p>
        </div>
      )}

      {/* ── 3. Filter panel — two rows, one card ────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-white shadow-soft overflow-hidden">
        {/* Row 1: search + project + Apply + Export + optional Reset */}
        <form
          method="get"
          action="/dashboard/inventory"
          className="flex flex-wrap items-center gap-2 px-4 py-3"
        >
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {/* Search — widest control */}
          <div className="flex-1 min-w-[180px]">
            <Input
              name="q"
              inputSize="sm"
              defaultValue={q}
              placeholder="ابحث باسم المشروع، المبنى، أو كود الوحدة…"
              leftAddon={<Search />}
            />
          </div>
          {/* Project filter */}
          <Select
            name="projectId"
            inputSize="sm"
            defaultValue={projectId}
            className="w-44 shrink-0"
          >
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.name)}
              </option>
            ))}
          </Select>
          {/* Actions: Apply (gold) + Export (muted icon) + Reset (text link) */}
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">
              تطبيق
            </Button>
            <IconButton label="تصدير" variant="outline" size="sm" type="button">
              <Download />
            </IconButton>
            {(q || projectId) && (
              <Link
                href={
                  `/dashboard/inventory${status !== 'all' ? `?status=${status}` : ''}` as never
                }
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-1 shrink-0"
              >
                مسح
              </Link>
            )}
          </div>
        </form>
        {/* Row 2: status chips */}
        <div className="border-t border-hairline px-4 py-2.5 bg-surface-muted/30 flex flex-wrap items-center gap-1.5">
          <StatusChip
            href={`/dashboard/inventory${qs({ status: undefined })}`}
            active={status === 'all'}
            label="الكل"
            count={total}
          />
          <StatusChip
            href={`/dashboard/inventory${qs({ status: 'AVAILABLE' })}`}
            active={status === 'AVAILABLE'}
            label="متاحة"
            count={available}
            tone="success"
          />
          <StatusChip
            href={`/dashboard/inventory${qs({ status: 'RESERVED' })}`}
            active={status === 'RESERVED'}
            label="محجوزة"
            count={reserved}
            tone="warning"
          />
          <StatusChip
            href={`/dashboard/inventory${qs({ status: 'SOLD' })}`}
            active={status === 'SOLD'}
            label="مباعة"
            count={sold}
            tone="info"
          />
        </div>
      </div>

      {/* ── 4. Inventory matrix ──────────────────────────────────────────────── */}
      {projectBuckets.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={<Boxes />}
            title={
              q || projectId || status !== 'all'
                ? 'لا توجد نتائج لمعايير البحث'
                : 'لا توجد وحدات بعد'
            }
            description={
              q || projectId || status !== 'all'
                ? 'جرّب تعديل الفلاتر أو مسح كلمات البحث.'
                : 'ابدأ بإضافة المشاريع والمباني والوحدات لتعبئة المخزون.'
            }
            action={
              !q && !projectId && status === 'all' ? (
                <Link href={'/dashboard/units/new' as never}>
                  <Button variant="primary" size="sm">
                    إضافة وحدة
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {projectBuckets.map((proj) => (
            <ProjectMatrixCard
              key={proj.id}
              proj={proj}
              unitsHref={unitsHref}
            />
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
        <Boxes className="h-3 w-3" />
        تُحسب القيم بناءً على لقطة فورية لأحدث {SNAPSHOT_SIZE} وحدة. للحصول على تفاصيل وحدة بعينها، انتقل إلى{' '}
        <Link
          href={'/dashboard/units' as never}
          className="font-semibold text-brand-700 hover:text-brand-800"
        >
          إدارة الوحدات
        </Link>
        .
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Local inventory-specific components — do NOT affect any shared component.
// ═══════════════════════════════════════════════════════════════════════════

// ── InventorySummaryPanel ────────────────────────────────────────────────────
// Unified inventory KPI panel: gold top accent, two large financial metrics,
// four full-width status count cells. No isolated cards, no empty space.

type InvStatTone = 'brand' | 'success' | 'warning' | 'info';

function InventorySummaryPanel({
  inventoryValue, avgPrice, total, available, reserved, sold,
}: {
  inventoryValue: number; avgPrice: number;
  total: number; available: number; reserved: number; sold: number;
}) {
  const avPct = total > 0 ? Math.round((available / total) * 100) : undefined;
  const rsPct = total > 0 ? Math.round((reserved  / total) * 100) : undefined;
  const slPct = total > 0 ? Math.round((sold      / total) * 100) : undefined;

  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-soft overflow-hidden">
      {/* Subtle 2px gold top accent — present but not dominant */}
      <div className="h-[2px] bg-brand-400/60" />

      {/* Financial metrics — 2 columns on sm+, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {/* Primary: total inventory value */}
        <div className="border-b border-hairline sm:border-b-0">
          <InvFinancialMetric
            label="قيمة المخزون"
            value={formatCurrency(inventoryValue)}
            icon={<CircleDollarSign />}
            primary
          />
        </div>
        {/* Secondary: average unit price */}
        <div className="sm:border-s border-hairline">
          <InvFinancialMetric
            label="متوسط سعر الوحدة"
            value={formatCurrency(avgPrice)}
            icon={<Calculator />}
          />
        </div>
      </div>

      {/* Status counts — soft pill row, no harsh grid dividers */}
      <div className="border-t border-hairline bg-surface-muted/10 px-5 py-3.5">
        <div className="flex flex-wrap gap-2">
          <InvStatCell label="إجمالي الوحدات" value={total}     tone="brand"   />
          <InvStatCell label="متاحة"   value={available} pct={avPct} tone="success" />
          <InvStatCell label="محجوزة"  value={reserved}  pct={rsPct} tone="warning" />
          <InvStatCell label="مباعة"   value={sold}      pct={slPct} tone="info"    />
        </div>
      </div>
    </div>
  );
}

// InvFinancialMetric — label + small inline icon on top, large value below at full width.
// primary=true → navy text + slightly larger; secondary → slate-600 + slightly smaller.
// Note: no `uppercase` or heavy `tracking` on Arabic label — Arabic is cursive; tracking
// breaks visual continuity. dir="rtl" on the value ensures correct bidi for currency strings.
function InvFinancialMetric({
  label, value, icon, primary = false,
}: { label: string; value: string; icon: ReactNode; primary?: boolean }) {
  return (
    <div className="px-6 py-5">
      {/* Label row: tiny icon + natural Arabic label (no forced uppercase/tracking) */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={cn('[&_svg]:h-3.5 [&_svg]:w-3.5 shrink-0',
          primary ? 'text-brand-400' : 'text-slate-300')}>
          {icon}
        </span>
        <p className="text-xs font-medium text-slate-500 leading-none">
          {label}
        </p>
      </div>
      {/* Value — full cell width, dir=rtl guarantees correct currency bidi rendering */}
      <p dir="rtl" className={cn('tabular-nums break-words leading-tight font-bold min-w-0',
        primary
          ? 'text-[2.1rem] text-navy'
          : 'text-[1.85rem] text-slate-600')}>
        {value}
      </p>
    </div>
  );
}

// InvStatCell — soft pill for each status count in the bottom strip.
// No grid placement, no harsh borders — just a toned pill that wraps naturally.
// No `uppercase` or heavy `tracking` on Arabic labels.
function InvStatCell({
  tone, label, value, pct,
}: { tone: InvStatTone; label: string; value: number; pct?: number }) {
  const PILL: Record<InvStatTone, string> = {
    brand:   'bg-brand-50   border-brand-100/80',
    success: 'bg-success-50 border-success-100/80',
    warning: 'bg-warning-50 border-warning-100/80',
    info:    'bg-info-50    border-info-100/80',
  };
  const DOT: Record<InvStatTone, string> = {
    brand:   'bg-brand-400',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    info:    'bg-info-500',
  };
  const NUM: Record<InvStatTone, string> = {
    brand:   'text-brand-700',
    success: 'text-success-700',
    warning: 'text-warning-700',
    info:    'text-info-700',
  };
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2', PILL[tone])}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', DOT[tone])} />
      <span className="text-xs text-slate-500 leading-none">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums leading-none', NUM[tone])}>{value}</span>
      {pct !== undefined && (
        <span className="text-[11px] text-slate-400 tabular-nums">({pct}%)</span>
      )}
    </div>
  );
}

// ── ProjectMatrixCard ────────────────────────────────────────────────────────

function ProjectMatrixCard({
  proj,
  unitsHref,
}: {
  proj: ProjectBucket;
  unitsHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const phases = [...proj.phases.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar'),
  );
  const av = proj.total > 0 ? (proj.available / proj.total) * 100 : 0;
  const rs = proj.total > 0 ? (proj.reserved / proj.total) * 100 : 0;
  const sl = proj.total > 0 ? (proj.sold / proj.total) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      {/* A ── Card header: identity + muted action link — clear hierarchy */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100/80 shrink-0">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link
              href={`/dashboard/projects/${proj.id}` as never}
              className="font-bold text-[15px] text-slate-900 hover:text-brand-700 transition-colors leading-snug block truncate"
            >
              {proj.name}
            </Link>
            {proj.city && (
              <p className="text-xs text-slate-500 mt-0.5">{proj.city}</p>
            )}
          </div>
        </div>
        {/* Muted text link — secondary, attached to header, no dominant styling */}
        <Link
          href={unitsHref({ projectId: proj.id })}
          className="shrink-0 text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors"
        >
          عرض التفاصيل
        </Link>
      </div>

      {/* B ── Summary: chips + currency + availability bar */}
      <div className="px-5 pb-4 border-b border-hairline space-y-2.5">
        {/* Chips + currency value */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <InvCountChip tone="brand"   label="إجمالي"  value={proj.total}     />
          <InvCountChip tone="success" label="متاحة"   value={proj.available} />
          <InvCountChip tone="warning" label="محجوزة"  value={proj.reserved}  />
          <InvCountChip tone="info"    label="مباعة"   value={proj.sold}      />
          {proj.totalValue > 0 && (
            <span className="ms-auto text-xs font-semibold text-slate-500 tabular-nums">
              {formatCurrency(proj.totalValue)}
            </span>
          )}
        </div>
        {/* Availability bar — h-1.5 (lighter than h-2) + tight legend */}
        {proj.total > 0 && (
          <div className="space-y-1">
            <div
              className="h-1.5 w-full rounded-full overflow-hidden flex bg-slate-100"
              role="img"
              aria-label={`متاحة ${proj.available} • محجوزة ${proj.reserved} • مباعة ${proj.sold}`}
            >
              {av > 0 && (
                <span className="block h-full bg-success-500 transition-all" style={{ width: `${av}%` }} />
              )}
              {rs > 0 && (
                <span className="block h-full bg-warning-500 transition-all" style={{ width: `${rs}%` }} />
              )}
              {sl > 0 && (
                <span className="block h-full bg-info-500 transition-all" style={{ width: `${sl}%` }} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {av > 0 && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-success-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" />
                  متاحة {Math.round(av)}%
                </span>
              )}
              {rs > 0 && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-warning-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning-500 shrink-0" />
                  محجوزة {Math.round(rs)}%
                </span>
              )}
              {sl > 0 && (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-info-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-info-500 shrink-0" />
                  مباعة {Math.round(sl)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* C ── Phase / building breakdown table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/30 text-2xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-start font-semibold py-2.5 ps-5 pe-4">المرحلة / المبنى</th>
              <th className="text-start font-semibold py-2.5 px-3">إجمالي</th>
              <th className="text-start font-semibold py-2.5 px-3">متاحة</th>
              <th className="text-start font-semibold py-2.5 px-3">محجوزة</th>
              <th className="text-start font-semibold py-2.5 px-3">مباعة</th>
              <th className="text-start font-semibold py-2.5 px-3">القيمة</th>
              <th className="text-start font-semibold py-2.5 ps-3 pe-5">التوفر</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((ph) => {
              const buildings = [...ph.buildings.values()].sort((a, b) =>
                a.name.localeCompare(b.name, 'ar'),
              );
              return (
                <PhaseRows key={ph.id} ph={ph} buildings={buildings} />
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── PhaseRows ────────────────────────────────────────────────────────────────

function PhaseRows({
  ph,
  buildings,
}: {
  ph: PhaseBucket;
  buildings: BuildingBucket[];
}) {
  return (
    <>
      <tr className="border-t border-hairline bg-surface-muted/20">
        <td className="py-2.5 ps-5 pe-4">
          <div className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-sm font-semibold text-slate-800">{ph.name}</span>
            <Badge tone="purple" variant="soft" size="sm">مرحلة</Badge>
          </div>
        </td>
        <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm">{ph.total}</td>
        <td className="py-2.5 px-3 tabular-nums text-success-700 text-sm">{ph.available}</td>
        <td className="py-2.5 px-3 tabular-nums text-warning-700 text-sm">{ph.reserved}</td>
        <td className="py-2.5 px-3 tabular-nums text-info-700 text-sm">{ph.sold}</td>
        <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm whitespace-nowrap">
          {formatCurrency(ph.totalValue)}
        </td>
        <td className="py-2.5 ps-3 pe-5">
          <RowAvailBar available={ph.available} reserved={ph.reserved} sold={ph.sold} total={ph.total} />
        </td>
      </tr>
      {buildings.map((b) => (
        <tr
          key={b.id}
          className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
        >
          <td className="py-2.5 ps-5 pe-4">
            <div className="inline-flex items-center gap-2 ps-6">
              <Home className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm text-slate-700">{b.name}</span>
            </div>
          </td>
          <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm">{b.total}</td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.available > 0
              ? <Badge tone="success" variant="soft" size="sm">{b.available}</Badge>
              : <span className="text-slate-400">—</span>}
          </td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.reserved > 0
              ? <Badge tone="warning" variant="soft" size="sm">{b.reserved}</Badge>
              : <span className="text-slate-400">—</span>}
          </td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.sold > 0
              ? <Badge tone="info" variant="soft" size="sm">{b.sold}</Badge>
              : <span className="text-slate-400">—</span>}
          </td>
          <td className="py-2.5 px-3 tabular-nums text-slate-500 text-xs whitespace-nowrap">
            {formatCurrency(b.totalValue)}
          </td>
          <td className="py-2.5 ps-3 pe-5 min-w-[140px]">
            <RowAvailBar available={b.available} reserved={b.reserved} sold={b.sold} total={b.total} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ── RowAvailBar — compact bar used inside the table rows ─────────────────────

function RowAvailBar({
  available, reserved, sold, total,
}: { available: number; reserved: number; sold: number; total: number }) {
  if (total === 0) return <span className="text-2xs text-slate-400">—</span>;
  const av = (available / total) * 100;
  const rs = (reserved / total) * 100;
  const sl = (sold / total) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1.5 flex-1 max-w-[100px] rounded-full overflow-hidden flex bg-slate-100"
        role="img"
        aria-label={`متاحة ${available} • محجوزة ${reserved} • مباعة ${sold}`}
      >
        {av > 0 && <span className="h-full bg-success-500" style={{ width: `${av}%` }} />}
        {rs > 0 && <span className="h-full bg-warning-500" style={{ width: `${rs}%` }} />}
        {sl > 0 && <span className="h-full bg-info-500" style={{ width: `${sl}%` }} />}
      </div>
      {av > 0 && (
        <span className="text-2xs tabular-nums text-success-600 font-medium shrink-0">
          {Math.round(av)}%
        </span>
      )}
    </div>
  );
}

// ── InvCountChip — compact pill used in the card summary row ─────────────────

function InvCountChip({
  tone,
  label,
  value,
}: {
  tone: 'brand' | 'success' | 'warning' | 'info';
  label: string;
  value: number;
}) {
  const TONE_CLS: Record<typeof tone, string> = {
    brand:   'bg-brand-50   text-brand-700   ring-brand-100',
    success: 'bg-success-50 text-success-700 ring-success-100',
    warning: 'bg-warning-50 text-warning-700 ring-warning-100',
    info:    'bg-info-50    text-info-700    ring-info-100',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ring-1 ring-inset tabular-nums',
        TONE_CLS[tone],
      )}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

// ── StatusChip — filter chip used in Row 2 of the filter panel ───────────────

function StatusChip({
  href,
  active,
  label,
  count,
  tone = 'brand',
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: 'brand' | 'success' | 'warning' | 'info';
}) {
  const BADGE_INACTIVE: Record<typeof tone, string> = {
    brand:   'bg-brand-50   text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    info:    'bg-info-50    text-info-700',
  };
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-colors border',
        active
          ? 'bg-brand-500 text-navy border-brand-500 shadow-sm'
          : 'bg-white text-slate-600 border-hairline hover:border-brand-300 hover:text-slate-900',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
          active ? 'bg-navy/15 text-navy' : BADGE_INACTIVE[tone],
        )}
      >
        {count}
      </span>
    </Link>
  );
}
