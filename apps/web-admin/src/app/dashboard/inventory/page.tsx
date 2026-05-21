import Link from 'next/link';
import {
  Boxes,
  CheckCircle2,
  Bookmark,
  Tag,
  CircleDollarSign,
  Calculator,
  AlertCircle,
  Search,
  Building2,
  Layers,
  Home,
  ArrowRight,
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
import { PageKpiCard } from '@/components/ui/page-kpi-card';
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
      <PageHeader
        title="لوحة المخزون"
        description="نظرة شاملة على توفر الوحدات وقيمة المخزون عبر المشاريع والمراحل والمباني."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المخزون' },
        ]}
        actions={
          <>
            <IconButton label="تصدير" variant="outline" size="md">
              <Download />
            </IconButton>
            <Link href={unitsHref({})}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              >
                {isAdmin ? 'إدارة الوحدات' : 'عرض الوحدات'}
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي الوحدات"
          value={total}
          icon={<Boxes />}
          tone="brand"
        />
        <PageKpiCard
          label="متاحة"
          value={available}
          sub={total > 0 ? `${Math.round((available / total) * 100)}%` : '—'}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <PageKpiCard
          label="محجوزة"
          value={reserved}
          sub={total > 0 ? `${Math.round((reserved / total) * 100)}%` : '—'}
          icon={<Bookmark />}
          tone="warning"
        />
        <PageKpiCard
          label="مباعة"
          value={sold}
          sub={total > 0 ? `${Math.round((sold / total) * 100)}%` : '—'}
          icon={<Tag />}
          tone="info"
        />
        <PageKpiCard
          label="قيمة المخزون"
          value={formatCurrency(inventoryValue)}
          icon={<CircleDollarSign />}
          tone="brand"
        />
        <PageKpiCard
          label="متوسط سعر الوحدة"
          value={formatCurrency(avgPrice)}
          icon={<Calculator />}
          tone="accent"
        />
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل المخزون: {loadError}</p>
        </div>
      )}
      {projectsError && !loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">
            تعذر تحميل قائمة المشاريع للفلترة: {projectsError}
          </p>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl bg-surface-muted p-1 ring-1 ring-inset ring-hairline">
        <StatusTab
          href={`/dashboard/inventory${qs({ status: undefined })}`}
          active={status === 'all'}
          label="الكل"
          count={total}
        />
        <StatusTab
          href={`/dashboard/inventory${qs({ status: 'AVAILABLE' })}`}
          active={status === 'AVAILABLE'}
          label="متاحة"
          count={available}
          tone="success"
        />
        <StatusTab
          href={`/dashboard/inventory${qs({ status: 'RESERVED' })}`}
          active={status === 'RESERVED'}
          label="محجوزة"
          count={reserved}
          tone="warning"
        />
        <StatusTab
          href={`/dashboard/inventory${qs({ status: 'SOLD' })}`}
          active={status === 'SOLD'}
          label="مباعة"
          count={sold}
          tone="info"
        />
      </div>

      {/* Search + project filter */}
      <form
        method="get"
        action="/dashboard/inventory"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <div className="flex-1 min-w-[180px]">
          <Input
            name="q"
            inputSize="sm"
            defaultValue={q}
            placeholder="ابحث باسم المشروع، المبنى، أو كود الوحدة…"
            leftAddon={<Search />}
          />
        </div>
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
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تطبيق
          </Button>
          {(q || projectId) && (
            <Link
              href={
                `/dashboard/inventory${
                  status !== 'all' ? `?status=${status}` : ''
                }` as never
              }
            >
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      {/* Inventory matrix */}
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
              status={status}
              unitsHref={unitsHref}
            />
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
        <Boxes className="h-3 w-3" />
        تُحسب القيم بناءً على لقطة فورية لأحدث {SNAPSHOT_SIZE} وحدة. للحصول على
        تفاصيل وحدة بعينها، انتقل إلى{' '}
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

function ProjectMatrixCard({
  proj,
  status,
  unitsHref,
}: {
  proj: ProjectBucket;
  status: StatusFilter;
  unitsHref: (overrides: Record<string, string | undefined>) => string;
}) {
  const phases = [...proj.phases.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar'),
  );

  return (
    <Card className="overflow-hidden">
      {/* Project header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link
              href={`/dashboard/projects/${proj.id}` as never}
              className="font-semibold text-slate-900 hover:text-brand-700 transition-colors truncate block"
            >
              {proj.name}
            </Link>
            {proj.city && (
              <p className="text-2xs text-slate-500 mt-0.5">{proj.city}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CountChip tone="brand" label="إجمالي" value={proj.total} />
          <CountChip tone="success" label="متاحة" value={proj.available} />
          <CountChip tone="warning" label="محجوزة" value={proj.reserved} />
          <CountChip tone="info" label="مباعة" value={proj.sold} />
          <span className="text-xs font-semibold text-slate-700 tabular-nums">
            {formatCurrency(proj.totalValue)}
          </span>
          <Link href={unitsHref({ projectId: proj.id })}>
            <IconButton label="عرض وحدات المشروع" variant="ghost" size="sm">
              <ArrowRight className="rtl:rotate-180" />
            </IconButton>
          </Link>
        </div>
      </div>

      {/* Phases / buildings table */}
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
              <th className="text-start font-semibold py-2.5 px-3">التوفر</th>
              <th className="text-start font-semibold py-2.5 ps-3 pe-5 w-px"></th>
            </tr>
          </thead>
          <tbody>
            {phases.map((ph) => {
              const buildings = [...ph.buildings.values()].sort((a, b) =>
                a.name.localeCompare(b.name, 'ar'),
              );
              return (
                <PhaseRows
                  key={ph.id}
                  ph={ph}
                  buildings={buildings}
                  projectId={proj.id}
                  status={status}
                  unitsHref={unitsHref}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PhaseRows({
  ph,
  buildings,
  projectId,
  status,
  unitsHref,
}: {
  ph: PhaseBucket;
  buildings: BuildingBucket[];
  projectId: string;
  status: StatusFilter;
  unitsHref: (overrides: Record<string, string | undefined>) => string;
}) {
  return (
    <>
      <tr className="border-t border-hairline bg-surface-muted/20">
        <td className="py-2.5 ps-5 pe-4">
          <div className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-sm font-semibold text-slate-800">{ph.name}</span>
            <Badge tone="purple" variant="soft" size="sm">
              مرحلة
            </Badge>
          </div>
        </td>
        <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm">{ph.total}</td>
        <td className="py-2.5 px-3 tabular-nums text-success-700 text-sm">{ph.available}</td>
        <td className="py-2.5 px-3 tabular-nums text-warning-700 text-sm">{ph.reserved}</td>
        <td className="py-2.5 px-3 tabular-nums text-info-700 text-sm">{ph.sold}</td>
        <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm whitespace-nowrap">
          {formatCurrency(ph.totalValue)}
        </td>
        <td className="py-2.5 px-3" colSpan={2}>
          <AvailabilityBar
            available={ph.available}
            reserved={ph.reserved}
            sold={ph.sold}
            total={ph.total}
          />
        </td>
      </tr>
      {buildings.map((b) => (
        <tr key={b.id} className="border-t border-hairline hover:bg-surface-muted/40 transition-colors">
          <td className="py-2.5 ps-5 pe-4">
            <div className="inline-flex items-center gap-2 ps-6">
              <Home className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm text-slate-700">{b.name}</span>
            </div>
          </td>
          <td className="py-2.5 px-3 tabular-nums text-slate-700 text-sm">{b.total}</td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.available > 0 ? (
              <Badge tone="success" variant="soft" size="sm">
                {b.available}
              </Badge>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.reserved > 0 ? (
              <Badge tone="warning" variant="soft" size="sm">
                {b.reserved}
              </Badge>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
          <td className="py-2.5 px-3 tabular-nums">
            {b.sold > 0 ? (
              <Badge tone="info" variant="soft" size="sm">
                {b.sold}
              </Badge>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
          <td className="py-2.5 px-3 tabular-nums text-slate-500 text-xs whitespace-nowrap">
            {formatCurrency(b.totalValue)}
          </td>
          <td className="py-2.5 px-3 min-w-[140px]">
            <AvailabilityBar
              available={b.available}
              reserved={b.reserved}
              sold={b.sold}
              total={b.total}
            />
          </td>
          <td className="py-2.5 ps-3 pe-5">
            <Link
              href={unitsHref({
                projectId,
                ...(status === 'all' ? {} : { status }),
              })}
            >
              <IconButton label="عرض وحدات المبنى" variant="ghost" size="sm">
                <ArrowRight className="rtl:rotate-180" />
              </IconButton>
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}

function AvailabilityBar({
  available,
  reserved,
  sold,
  total,
}: {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}) {
  if (total === 0) {
    return <span className="text-2xs text-slate-400">لا توجد وحدات</span>;
  }
  const av = (available / total) * 100;
  const rs = (reserved / total) * 100;
  const sl = (sold / total) * 100;
  return (
    <div
      className="inline-flex h-2 w-full max-w-[180px] overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-hairline"
      role="img"
      aria-label={`متاحة ${available} • محجوزة ${reserved} • مباعة ${sold}`}
    >
      {av > 0 && (
        <span className="block h-full bg-success-500/80" style={{ width: `${av}%` }} />
      )}
      {rs > 0 && (
        <span className="block h-full bg-warning-500/80" style={{ width: `${rs}%` }} />
      )}
      {sl > 0 && (
        <span className="block h-full bg-info-500/80" style={{ width: `${sl}%` }} />
      )}
    </div>
  );
}

function CountChip({
  tone,
  label,
  value,
}: {
  tone: 'brand' | 'success' | 'warning' | 'info';
  label: string;
  value: number;
}) {
  const TONE: Record<typeof tone, string> = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    success: 'bg-success-50 text-success-700 ring-success-100',
    warning: 'bg-warning-50 text-warning-700 ring-warning-100',
    info: 'bg-info-50 text-info-700 ring-info-100',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xs font-semibold ring-1 ring-inset tabular-nums',
        TONE[tone],
      )}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function StatusTab({
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
  const ACTIVE_BADGE: Record<typeof tone, string> = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    info: 'bg-info-50 text-info-700',
  };
  return (
    <Link
      href={href as never}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors',
        active
          ? 'bg-surface text-slate-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-surface',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md text-2xs font-bold',
          active ? ACTIVE_BADGE[tone] : 'bg-slate-100 text-slate-600',
        )}
      >
        {count}
      </span>
    </Link>
  );
}
