import Link from 'next/link';
import {
  Boxes,
  CircleDollarSign,
  Calculator,
  AlertCircle,
  Building2,
  Home,
  SlidersHorizontal,
  ArrowLeft,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import type {
  UnitStatus,
  InventoryMatrixResult,
  InventoryMatrixProject,
  InventoryMatrixPhase,
  InventoryMatrixBuilding,
} from '@/lib/types';
import { compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/export-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumFilterChips,
  PremiumFilterDivider,
  PremiumEmptyState,
  UNIT_STATUS_COLORS,
} from '@/components/premium';
import { RowTitle, RowIconTile, NumCell } from '@/components/premium/data-table';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type StatusFilter = 'all' | UnitStatus;

interface Filters {
  q?: string;
  status?: string;
  projectId?: string;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp         = await searchParams;
  const [currency, locale, session] = await Promise.all([
    getReportsCurrency(),
    getLocale(),
    getSession(),
  ]);
  const m       = uiT(locale).pages.inventory;
  const isAdmin = session?.role === 'ADMIN';
  const q       = (sp.q ?? '').trim();
  const status: StatusFilter =
    sp.status === 'AVAILABLE' || sp.status === 'RESERVED' || sp.status === 'SOLD'
      ? sp.status : 'all';
  const projectId = sp.projectId?.trim() || '';

  const matrixQs = new URLSearchParams();
  if (q) matrixQs.set('q', q);
  if (status !== 'all') matrixQs.set('status', status);
  if (projectId) matrixQs.set('projectId', projectId);
  const matrixQsStr = matrixQs.toString();

  const [matrixRes, projectsRes] = await Promise.all([
    safe(api.get<InventoryMatrixResult>(`/units/inventory-matrix${matrixQsStr ? `?${matrixQsStr}` : ''}`)),
    safe(projectOptions()),
  ]);

  const loadError      = matrixRes.error;
  const projectsError  = projectsRes.error;
  const projects       = projectsRes.data?.data ?? [];
  const summary        = matrixRes.data?.summary ?? { available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0 };
  const projectBuckets = matrixRes.data?.projects ?? [];

  const total          = summary.total;
  const available      = summary.available;
  const reserved       = summary.reserved;
  const sold           = summary.sold;
  const inventoryValue = summary.totalValue;
  const avgPrice       = total > 0 ? inventoryValue / total : 0;
  const symbol         = currencySymbol(currency, locale);
  const valueParts     = compactParts(inventoryValue, symbol, locale);
  const avgParts       = compactParts(avgPrice, symbol, locale);

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
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <ExportMenu
                locale={locale}
                filenameBase="inventory"
                xlsxPath="/units/export.xlsx"
                csvPath="/units/export.csv"
                params={{ status: status === 'all' ? undefined : status, projectId: projectId || undefined }}
              />
            )}
            <Link href={unitsHref({}) as never}>
              <Button variant="primary" size="md" leftIcon={<SlidersHorizontal className="h-4 w-4" />}>
                {isAdmin ? m.manageUnitsAdmin : m.manageUnitsStaff}
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── 2. KPI band with the units distribution (U5) ───────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: m.kpi.totalValue, value: valueParts[0], unit: valueParts[1], icon: <CircleDollarSign /> },
          { label: m.kpi.totalUnits, value: total, unit: m.kpi.unitsUnit, icon: <Home /> },
          { label: m.kpi.activeProjects, value: projectBuckets.length, unit: m.kpi.projectsUnit, icon: <Building2 /> },
          avgPrice > 0
            ? { label: m.kpi.avgPrice, value: avgParts[0], unit: avgParts[1], icon: <Calculator /> }
            : { label: m.kpi.avgPrice, value: '—', icon: <Calculator /> },
        ]}
        distribution={[
          { label: m.availCard.sold, value: sold, color: UNIT_STATUS_COLORS.sold },
          { label: m.availCard.reserved, value: reserved, color: UNIT_STATUS_COLORS.reserved },
          { label: m.availCard.available, value: available, color: UNIT_STATUS_COLORS.available },
        ]}
      />

      {/* ── Error banners ─────────────────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorPrefix} {loadError}</p>
        </div>
      )}
      {projectsError && !loadError && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.projectsErrorPrefix} {projectsError}</p>
        </div>
      )}

      {/* ── 4. Filter bar (U5): search, project, status chips with counts ──── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/inventory"
        trailing={
          <PremiumFilterChips
            chips={[
              { label: m.filter.allChip, count: total, href: `/dashboard/inventory${qs({ status: undefined })}`, active: status === 'all' },
              { label: m.filter.availableChip, count: available, href: `/dashboard/inventory${qs({ status: 'AVAILABLE' })}`, active: status === 'AVAILABLE' },
              { label: m.filter.reservedChip, count: reserved, href: `/dashboard/inventory${qs({ status: 'RESERVED' })}`, active: status === 'RESERVED' },
              { label: m.filter.soldChip, count: sold, href: `/dashboard/inventory${qs({ status: 'SOLD' })}`, active: status === 'SOLD' },
            ]}
          />
        }
        summary={
          hasFilters ? (
            <Link href={resetHref as never} className="font-bold text-brand-700 underline underline-offset-4">
              {m.filter.clearBtn}
            </Link>
          ) : undefined
        }
      >
        {/* Keep the status chip choice when the search or project changes */}
        {status !== 'all' && <input type="hidden" name="status" value={status} />}

        <PremiumFilterField label={m.filter.searchLabel} htmlFor="inv-q">
          <Input id="inv-q" name="q" type="search" defaultValue={q} placeholder={m.filter.searchPlaceholder} />
        </PremiumFilterField>

        <PremiumFilterField label={m.matrix.projectLabel} htmlFor="projectId">
          <Select id="projectId" name="projectId" inputSize="sm" defaultValue={projectId}>
            <option value="">{uiT(locale).common.allProjects}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name[locale]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterDivider />
      </PremiumFilterBar>

      {/* ── 5. Inventory matrix ─────────────────────────────────────────────── */}
      {projectBuckets.length === 0 ? (
        <div className="bg-surface border border-hairline rounded-[22px]">
          <PremiumEmptyState
            icon={<Boxes />}
            title={q || projectId || status !== 'all' ? m.empty.filteredTitle : m.empty.emptyTitle}
            description={
              q || projectId || status !== 'all'
                ? m.empty.filteredDesc
                : m.empty.emptyDesc
            }
            action={
              !q && !projectId && status === 'all' ? (
                <Link href={'/dashboard/units/new' as never}>
                  <Button variant="primary" size="sm">{m.empty.addBtn}</Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {projectBuckets.map((proj) => (
            <ProjectMatrixCard key={proj.id} proj={proj} unitsHref={unitsHref} symbol={symbol} matrixLabels={m.matrix} locale={locale} />
          ))}
        </div>
      )}

    </div>
  );
}

// ── ProjectMatrixCard ─────────────────────────────────────────────────────────

type MatrixLabels = {
  viewDetails: string;
  unitSuffix: string;
  projectLabel: string;
  cols: { phase: string; total: string; available: string; reserved: string; sold: string; value: string; availability: string };
  phaseBadge: string;
};

/** One project (U5): navy tile + Naskh name, its value, then a navy-header table of phases and buildings. */
function ProjectMatrixCard({
  proj,
  unitsHref,
  symbol,
  matrixLabels,
  locale = 'ar',
}: {
  proj: InventoryMatrixProject;
  unitsHref: (overrides: Record<string, string | undefined>) => string;
  symbol: string;
  matrixLabels: MatrixLabels;
  locale?: Locale;
}) {
  const phases = [...proj.phases].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const [num, unit] = compactParts(proj.totalValue, symbol, locale);

  return (
    <div className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <RowTitle
          title={proj.name}
          href={`/dashboard/projects/${proj.id}`}
          icon={<RowIconTile><Building2 /></RowIconTile>}
          code={undefined}
        />
        <div className="flex items-center gap-6">
          {proj.totalValue > 0 && <NumCell value={num} unit={unit} className="[&>span:first-child]:text-[30px]" />}
          <Link
            href={unitsHref({ projectId: proj.id }) as never}
            className="inline-flex items-center gap-1 text-[14px] font-bold text-brand-700 hover:text-brand-600"
          >
            {matrixLabels.viewDetails}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
          </Link>
        </div>
      </div>
      <p className="-mt-3 px-6 pb-4 ps-[96px] text-[13px] text-slate-500">
        {[proj.city, `${proj.total} ${matrixLabels.unitSuffix}`].filter(Boolean).join(' · ')}
      </p>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-start py-3.5 ps-6 pe-4">{matrixLabels.cols.phase}</th>
              <th className="text-center py-3.5 px-3">{matrixLabels.cols.total}</th>
              <th className="text-center py-3.5 px-3">{matrixLabels.cols.available}</th>
              <th className="text-center py-3.5 px-3">{matrixLabels.cols.reserved}</th>
              <th className="text-center py-3.5 px-3">{matrixLabels.cols.sold}</th>
              <th className="text-start py-3.5 px-3">{matrixLabels.cols.value}</th>
              <th className="text-start py-3.5 ps-3 pe-6">{matrixLabels.cols.availability}</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((ph) => {
              const buildings = [...ph.buildings].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
              return <PhaseRows key={ph.id} ph={ph} buildings={buildings} symbol={symbol} phaseBadgeLabel={matrixLabels.phaseBadge} locale={locale} />;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A count in Cormorant, coloured by unit status; a dash for zero. */
function Count({ n, cls }: { n: number; cls: string }) {
  return n > 0 ? <span className={cn('num text-[22px] font-semibold', cls)}>{n}</span> : <span className="text-slate-400">—</span>;
}

function PhaseRows({ ph, buildings, symbol, phaseBadgeLabel, locale = 'ar' }: { ph: InventoryMatrixPhase; buildings: InventoryMatrixBuilding[]; symbol: string; phaseBadgeLabel: string; locale?: Locale }) {
  const rows = [
    { ...ph, key: ph.id, phase: true },
    ...buildings.map((b) => ({ ...b, key: b.id, phase: false })),
  ];
  return (
    <>
      {rows.map((r) => {
        const [num, unit] = compactParts(r.totalValue, symbol, locale);
        return (
          <tr key={r.key} className={cn('border-t border-hairline', r.phase ? 'bg-surface-muted' : 'hover:bg-surface-muted/60')}>
            <td className="py-4 ps-6 pe-4">
              {r.phase ? (
                <span className="inline-flex items-center gap-2.5">
                  <span className="font-heading text-[16px] font-bold text-slate-900">{r.name}</span>
                  <span className="rounded-full border border-brand-400/50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">{phaseBadgeLabel}</span>
                </span>
              ) : (
                <span className="ps-4 text-[14px] text-slate-700">{r.name}</span>
              )}
            </td>
            <td className="py-4 px-3 text-center"><Count n={r.total} cls="text-slate-900" /></td>
            <td className="py-4 px-3 text-center"><Count n={r.available} cls="text-unit-available-text" /></td>
            <td className="py-4 px-3 text-center"><Count n={r.reserved} cls="text-brand-700" /></td>
            <td className="py-4 px-3 text-center"><Count n={r.sold} cls="text-slate-900" /></td>
            <td className="py-4 px-3"><NumCell value={num} unit={unit} /></td>
            <td className="py-4 ps-3 pe-6 min-w-[200px]">
              <AvailBar available={r.available} reserved={r.reserved} sold={r.sold} total={r.total} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** Availability: the one unit-status bar plus the available share. */
function AvailBar({ available, reserved, sold, total }: { available: number; reserved: number; sold: number; total: number }) {
  if (total === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-2 flex-1 max-w-[200px] gap-1" role="img" aria-label={`${available} • ${reserved} • ${sold}`}>
        {available > 0 && <span className="rounded-full bg-unit-available" style={{ flexGrow: available, flexBasis: 0 }} />}
        {reserved > 0 && <span className="rounded-full bg-unit-reserved" style={{ flexGrow: reserved, flexBasis: 0 }} />}
        {sold > 0 && <span className="rounded-full bg-unit-sold" style={{ flexGrow: sold, flexBasis: 0 }} />}
      </div>
      <span className="text-[12px] text-slate-500 tabular-nums">{Math.round((available / total) * 100)}%</span>
    </div>
  );
}
