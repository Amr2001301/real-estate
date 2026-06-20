import Link from 'next/link';
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
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Unit, Project, UnitStatus } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// TODO(backend): swap for a dedicated inventory-matrix endpoint when unit count > 1000
const SNAPSHOT_SIZE = 1000;

type StatusFilter = 'all' | UnitStatus;

interface Filters {
  q?: string;
  status?: string;
  projectId?: string;
}

interface BuildingBucket {
  id: string; name: string;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
}
interface PhaseBucket {
  id: string; name: string; buildings: Map<string, BuildingBucket>;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
}
interface ProjectBucket {
  id: string; name: string; city: string | null; phases: Map<string, PhaseBucket>;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp         = await searchParams;
  const session    = await getSession();
  const isAdmin    = session?.role === 'ADMIN';
  const q          = (sp.q ?? '').trim();
  const status: StatusFilter =
    sp.status === 'AVAILABLE' || sp.status === 'RESERVED' || sp.status === 'SOLD'
      ? sp.status : 'all';
  const projectId  = sp.projectId?.trim() || '';

  const unitsQs = new URLSearchParams({ pageSize: String(SNAPSHOT_SIZE) });
  if (projectId) unitsQs.set('projectId', projectId);

  const [unitsRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Unit>>(`/units?${unitsQs.toString()}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const loadError     = unitsRes.error;
  const projectsError = projectsRes.error;
  const allUnits      = unitsRes.data?.data ?? [];
  const projects      = projectsRes.data?.data ?? [];

  let units = allUnits;
  if (q) {
    const needle = q.toLowerCase();
    units = units.filter((u) => {
      const pName = u.building?.phase?.project?.name
        ? `${u.building.phase.project.name.ar ?? ''} ${u.building.phase.project.name.en ?? ''}`.toLowerCase()
        : '';
      return (
        pName.includes(needle) ||
        (u.building?.name ?? '').toLowerCase().includes(needle) ||
        (u.code ?? '').toLowerCase().includes(needle)
      );
    });
  }
  const matrixUnits = status === 'all' ? units : units.filter((u) => u.status === status);

  const total          = units.length;
  const available      = units.filter((u) => u.status === 'AVAILABLE').length;
  const reserved       = units.filter((u) => u.status === 'RESERVED').length;
  const sold           = units.filter((u) => u.status === 'SOLD').length;
  const inventoryValue = units.reduce((s, u) => s + Number(u.price ?? 0), 0);
  const avgPrice       = total > 0 ? inventoryValue / total : 0;

  // ── Matrix build ────────────────────────────────────────────────────────
  const matrix = new Map<string, ProjectBucket>();
  for (const u of matrixUnits) {
    const proj  = u.building?.phase?.project;
    const phase = u.building?.phase;
    const bld   = u.building;
    if (!proj || !phase || !bld) continue;

    let pB = matrix.get(proj.id);
    if (!pB) { pB = { id: proj.id, name: tx(proj.name), city: proj.city ?? null, phases: new Map(), available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0 }; matrix.set(proj.id, pB); }
    let phB = pB.phases.get(phase.id);
    if (!phB) { phB = { id: phase.id, name: tx(phase.name), buildings: new Map(), available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0 }; pB.phases.set(phase.id, phB); }
    let bB = phB.buildings.get(bld.id);
    if (!bB) { bB = { id: bld.id, name: bld.name, available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0 }; phB.buildings.set(bld.id, bB); }

    const price = Number(u.price ?? 0);
    bB.total++;  bB.totalValue  += price;
    phB.total++; phB.totalValue += price;
    pB.total++;  pB.totalValue  += price;
    if (u.status === 'AVAILABLE') { bB.available++; phB.available++; pB.available++; }
    else if (u.status === 'RESERVED') { bB.reserved++; phB.reserved++; pB.reserved++; }
    else if (u.status === 'SOLD')     { bB.sold++;     phB.sold++;     pB.sold++;     }
  }

  const projectBuckets = [...matrix.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // ── URL helpers ─────────────────────────────────────────────────────────
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status !== 'all') p.set('status', status);
    if (projectId) p.set('projectId', projectId);
    for (const [k, v] of Object.entries(extra)) { v === undefined ? p.delete(k) : p.set(k, v); }
    const s = p.toString(); return s ? `?${s}` : '';
  };
  const unitsHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (status !== 'all') p.set('status', status);
    if (projectId) p.set('projectId', projectId);
    for (const [k, v] of Object.entries(overrides)) { v === undefined ? p.delete(k) : p.set(k, v); }
    const s = p.toString(); return `/dashboard/units${s ? `?${s}` : ''}`;
  };

  const hasFilters = !!(q || projectId);
  const resetHref  = `/dashboard/inventory${status !== 'all' ? `?status=${status}` : ''}`;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── 1. Hero ─────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="لوحة المخزون"
        description="نظرة شاملة على توفر الوحدات وقيمة المخزون عبر المشاريع والمراحل."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المخزون' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <IconButton label="تصدير البيانات" variant="outline" size="md" type="button">
              <Download />
            </IconButton>
            <Link href={unitsHref({}) as never}>
              <Button variant="primary" size="md" leftIcon={<SlidersHorizontal className="h-4 w-4" />}>
                {isAdmin ? 'إدارة الوحدات' : 'عرض الوحدات'}
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── 2. KPI strip ────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        cols={4}
        metrics={[
          {
            label: 'قيمة المخزون الإجمالية',
            value: formatCurrency(inventoryValue),
            icon: <CircleDollarSign />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'إجمالي الوحدات',
            value: total,
            icon: <Boxes />,
            tone: 'neutral',
          },
          {
            label: 'المشاريع النشطة',
            value: projectBuckets.length,
            icon: <Building2 />,
            tone: 'info',
          },
          {
            label: 'متوسط سعر الوحدة',
            value: avgPrice > 0 ? formatCurrency(avgPrice) : '—',
            icon: <Calculator />,
            tone: 'success',
          },
        ]}
      />

      {/* ── 3. Availability distribution ────────────────────────────────────── */}
      <InventoryAvailCard
        total={total}
        available={available}
        reserved={reserved}
        sold={sold}
      />

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل المخزون: {loadError}</p>
        </div>
      )}
      {projectsError && !loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل قائمة المشاريع: {projectsError}</p>
        </div>
      )}

      {/* ── 4. Filter bar ───────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/inventory">
        {/* Preserve active status filter when submitting search/project form */}
        {status !== 'all' && <input type="hidden" name="status" value={status} />}

        {/* Search — grows to fill available space */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="inv-q" className="sr-only">بحث</label>
          <Input
            id="inv-q"
            name="q"
            inputSize="sm"
            defaultValue={q}
            placeholder="ابحث باسم المشروع، المبنى، أو كود الوحدة…"
            leftAddon={<Search />}
            className="w-full"
          />
        </div>

        {/* Project filter */}
        <PremiumFilterField label="المشروع" htmlFor="projectId">
          <Select
            id="projectId"
            name="projectId"
            inputSize="sm"
            defaultValue={projectId}
            className="w-40 shrink-0"
          >
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>

        <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />

        {/* Status chips — links, not form inputs; change URL directly */}
        <div className="flex items-center gap-1 flex-wrap">
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
            tone="brand"
          />
          <StatusChip
            href={`/dashboard/inventory${qs({ status: 'SOLD' })}`}
            active={status === 'SOLD'}
            label="مباعة"
            count={sold}
            tone="slate"
          />
        </div>

        {/* Apply + Reset */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          {hasFilters && (
            <Link
              href={resetHref as never}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              مسح
            </Link>
          )}
          <Button type="submit" variant="primary" size="sm">تطبيق</Button>
        </div>
      </PremiumFilterBar>

      {/* ── 5. Inventory matrix ─────────────────────────────────────────────── */}
      {projectBuckets.length === 0 ? (
        <div className="bg-surface border border-hairline rounded-[20px] shadow-soft">
          <PremiumEmptyState
            icon={<Boxes />}
            title={q || projectId || status !== 'all' ? 'لا توجد نتائج لمعايير البحث' : 'لا توجد وحدات بعد'}
            description={
              q || projectId || status !== 'all'
                ? 'جرّب تعديل الفلاتر أو مسح كلمات البحث.'
                : 'ابدأ بإضافة المشاريع والمباني والوحدات لتعبئة المخزون.'
            }
            action={
              !q && !projectId && status === 'all' ? (
                <Link href={'/dashboard/units/new' as never}>
                  <Button variant="primary" size="sm">إضافة وحدة</Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {projectBuckets.map((proj) => (
            <ProjectMatrixCard key={proj.id} proj={proj} unitsHref={unitsHref} />
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
        <Boxes className="h-3 w-3" />
        تُحسب القيم على لقطة فورية لأحدث {SNAPSHOT_SIZE} وحدة — للتفاصيل انتقل إلى{' '}
        <Link href={'/dashboard/units' as never} className="font-semibold text-brand-700 hover:text-brand-800">
          إدارة الوحدات
        </Link>
        .
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DESIGN PALETTE
//  متاحة  → success green   (#10B981 / success-500)
//  محجوزة → brand gold      (#CFAE57 / brand-400)
//  مباعة  → slate neutral   (#94A3B8 / slate-400)
// ═══════════════════════════════════════════════════════════════════════════

// ── InventoryAvailCard ───────────────────────────────────────────────────────

function InventoryAvailCard({
  total, available, reserved, sold,
}: { total: number; available: number; reserved: number; sold: number }) {
  const avPct = total > 0 ? Math.round((available / total) * 100) : 0;
  const rsPct = total > 0 ? Math.round((reserved  / total) * 100) : 0;
  const slPct = total > 0 ? Math.round((sold      / total) * 100) : 0;

  return (
    <PremiumSectionCard
      icon={<BarChart3 />}
      title="توزيع الوحدات"
      description="نسب التوفر عبر إجمالي المخزون"
    >
      <div className="flex flex-col gap-5">
        <AvailBar
          label="متاحة"
          count={available}
          pct={avPct}
          barClass="bg-success-500"
          dotClass="bg-success-500"
          countClass="text-success-700"
        />
        <AvailBar
          label="محجوزة"
          count={reserved}
          pct={rsPct}
          barClass="bg-brand-400"
          dotClass="bg-brand-400"
          countClass="text-brand-700"
        />
        <AvailBar
          label="مباعة"
          count={sold}
          pct={slPct}
          barClass="bg-slate-400"
          dotClass="bg-slate-400"
          countClass="text-slate-500"
        />
      </div>
    </PremiumSectionCard>
  );
}

function AvailBar({ label, count, pct, barClass, dotClass, countClass }: {
  label: string; count: number; pct: number;
  barClass: string; dotClass: string; countClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} />
          <span className="text-[13px] font-medium text-slate-700">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] font-bold text-slate-900 tabular-nums">{count}</span>
          <span className={cn('text-[11px] font-semibold tabular-nums', countClass)}>({pct}%)</span>
        </div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-canvas overflow-hidden border border-hairline">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── ProjectMatrixCard ─────────────────────────────────────────────────────────

function ProjectMatrixCard({
  proj,
  unitsHref,
}: {
  proj: ProjectBucket;
  unitsHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const phases = [...proj.phases.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const av = proj.total > 0 ? (proj.available / proj.total) * 100 : 0;
  const rs = proj.total > 0 ? (proj.reserved  / proj.total) * 100 : 0;
  const sl = proj.total > 0 ? (proj.sold      / proj.total) * 100 : 0;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Subtle gold accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-brand-300/60 to-transparent" />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100/80 shrink-0">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link
              href={`/dashboard/projects/${proj.id}` as never}
              className="font-bold text-[16px] text-navy hover:text-brand-700 transition-colors leading-snug block truncate"
            >
              {proj.name}
            </Link>
            {proj.city && <p className="text-[12px] text-slate-400 mt-0.5">{proj.city}</p>}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {proj.totalValue > 0 && (
            <p dir="rtl" className="text-[14px] font-bold text-slate-800 tabular-nums leading-none">
              {formatCurrency(proj.totalValue)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-400">
              <span className="font-semibold text-slate-600">{proj.total}</span> وحدة
            </span>
            <Link
              href={unitsHref({ projectId: proj.id }) as never}
              className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              عرض التفاصيل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stacked availability bar ─────────────────────────────────────────── */}
      {proj.total > 0 && (
        <div className="px-6 py-4 border-b border-hairline space-y-2">
          <div
            className="h-3 w-full rounded-full overflow-hidden flex bg-canvas"
            role="img"
            aria-label={`متاحة ${proj.available} • محجوزة ${proj.reserved} • مباعة ${proj.sold}`}
          >
            {av > 0 && <span className="h-full bg-success-500 transition-all duration-500 shrink-0" style={{ width: `${av}%` }} />}
            {rs > 0 && <span className="h-full bg-brand-400  transition-all duration-500 shrink-0" style={{ width: `${rs}%` }} />}
            {sl > 0 && <span className="h-full bg-slate-400  transition-all duration-500 shrink-0" style={{ width: `${sl}%` }} />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {av > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success-700">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" />
                متاح {proj.available} ({Math.round(av)}%)
              </span>
            )}
            {rs > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                محجوز {proj.reserved} ({Math.round(rs)}%)
              </span>
            )}
            {sl > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                مباع {proj.sold} ({Math.round(sl)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Phase / building table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
            <tr>
              <th className="text-start py-3 ps-6 pe-4">المرحلة / المبنى</th>
              <th className="text-center py-3 px-3">إجمالي</th>
              <th className="text-center py-3 px-3">متاحة</th>
              <th className="text-center py-3 px-3">محجوزة</th>
              <th className="text-center py-3 px-3">مباعة</th>
              <th className="text-start py-3 px-3">القيمة</th>
              <th className="text-start py-3 ps-3 pe-6">التوفر</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((ph) => {
              const buildings = [...ph.buildings.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
              return <PhaseRows key={ph.id} ph={ph} buildings={buildings} />;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PhaseRows ─────────────────────────────────────────────────────────────────

function PhaseRows({ ph, buildings }: { ph: PhaseBucket; buildings: BuildingBucket[] }) {
  return (
    <>
      <tr className="border-t border-hairline bg-canvas/60">
        <td className="py-3 ps-6 pe-4">
          <div className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            <span className="text-[13px] font-bold text-slate-800">{ph.name}</span>
            <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-50 border border-brand-100 text-[9px] font-bold text-brand-700 uppercase tracking-wide">
              مرحلة
            </span>
          </div>
        </td>
        <td className="py-3 px-3 text-center tabular-nums text-[13px] font-semibold text-slate-700">{ph.total}</td>
        <td className="py-3 px-3 text-center tabular-nums text-[13px] font-semibold text-success-700">
          {ph.available > 0 ? ph.available : <span className="text-slate-300 font-normal">—</span>}
        </td>
        <td className="py-3 px-3 text-center tabular-nums text-[13px] font-semibold text-brand-700">
          {ph.reserved > 0 ? ph.reserved : <span className="text-slate-300 font-normal">—</span>}
        </td>
        <td className="py-3 px-3 text-center tabular-nums text-[13px] font-semibold text-slate-500">
          {ph.sold > 0 ? ph.sold : <span className="text-slate-300 font-normal">—</span>}
        </td>
        <td className="py-3 px-3 tabular-nums text-[12px] text-slate-600 whitespace-nowrap">{formatCurrency(ph.totalValue)}</td>
        <td className="py-3 ps-3 pe-6">
          <RowAvailBar available={ph.available} reserved={ph.reserved} sold={ph.sold} total={ph.total} />
        </td>
      </tr>

      {buildings.map((b) => (
        <tr key={b.id} className="border-t border-hairline hover:bg-canvas/40 transition-colors duration-100">
          <td className="py-2.5 ps-6 pe-4">
            <div className="inline-flex items-center gap-2 ps-5">
              <Home className="h-3 w-3 text-slate-300 shrink-0" />
              <span className="text-[12px] text-slate-600">{b.name}</span>
            </div>
          </td>
          <td className="py-2.5 px-3 text-center tabular-nums text-[12px] text-slate-400">{b.total}</td>
          <td className="py-2.5 px-3 text-center">
            {b.available > 0
              ? <Badge tone="success" variant="soft" size="sm">{b.available}</Badge>
              : <span className="text-slate-300 text-[12px]">—</span>}
          </td>
          <td className="py-2.5 px-3 text-center">
            {b.reserved > 0
              ? <Badge tone="brand" variant="soft" size="sm">{b.reserved}</Badge>
              : <span className="text-slate-300 text-[12px]">—</span>}
          </td>
          <td className="py-2.5 px-3 text-center">
            {b.sold > 0
              ? (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 tabular-nums">
                  {b.sold}
                </span>
              )
              : <span className="text-slate-300 text-[12px]">—</span>}
          </td>
          <td className="py-2.5 px-3 tabular-nums text-[11px] text-slate-400 whitespace-nowrap">{formatCurrency(b.totalValue)}</td>
          <td className="py-2.5 ps-3 pe-6 min-w-[140px]">
            <RowAvailBar available={b.available} reserved={b.reserved} sold={b.sold} total={b.total} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ── RowAvailBar ───────────────────────────────────────────────────────────────

function RowAvailBar({ available, reserved, sold, total }: {
  available: number; reserved: number; sold: number; total: number;
}) {
  if (total === 0) return <span className="text-2xs text-slate-300">—</span>;
  const av = (available / total) * 100;
  const rs = (reserved  / total) * 100;
  const sl = (sold      / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 max-w-[100px] rounded-full overflow-hidden flex bg-canvas"
        role="img"
        aria-label={`متاحة ${available} • محجوزة ${reserved} • مباعة ${sold}`}
      >
        {av > 0 && <span className="h-full bg-success-500 shrink-0" style={{ width: `${av}%` }} />}
        {rs > 0 && <span className="h-full bg-brand-400  shrink-0" style={{ width: `${rs}%` }} />}
        {sl > 0 && <span className="h-full bg-slate-400  shrink-0" style={{ width: `${sl}%` }} />}
      </div>
      {av > 0 && (
        <span className="text-[10px] tabular-nums text-success-600 font-semibold shrink-0">
          {Math.round(av)}%
        </span>
      )}
    </div>
  );
}

// ── StatusChip ────────────────────────────────────────────────────────────────

function StatusChip({
  href, active, label, count, tone = 'brand',
}: {
  href: string; active: boolean; label: string; count: number;
  tone?: 'brand' | 'success' | 'slate';
}) {
  const BADGE_INACTIVE: Record<string, string> = {
    brand:   'bg-brand-50   text-brand-700',
    success: 'bg-success-50 text-success-700',
    slate:   'bg-slate-100  text-slate-600',
  };
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-colors border',
        active
          ? 'bg-brand-500 text-white border-brand-500 shadow-sm font-semibold'
          : 'bg-surface text-slate-500 border-hairline hover:border-brand-200 hover:text-slate-800',
      )}
    >
      {label}
      <span className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
        active ? 'bg-white/20 text-white' : (BADGE_INACTIVE[tone] ?? 'bg-slate-100 text-slate-600'),
      )}>
        {count}
      </span>
    </Link>
  );
}
