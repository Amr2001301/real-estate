import Link from 'next/link';
import {
  Plus,
  Box,
  CheckCircle2,
  Bookmark,
  CircleDollarSign,
  Eye,
  Download,
  BedDouble,
  Ruler,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Unit, Project } from '@/lib/types';
import { tx, formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { UnitStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Filters {
  page?: string;
  projectId?: string;
  status?: string;
  bedrooms?: string;
  priceMin?: string;
  priceMax?: string;
  areaMin?: string;
  areaMax?: string;
  showFilters?: string;
}

const PAGE_SIZE = 12;

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  // Unit mutations are ADMIN-only — SALES browses read-only.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.status)    qs.set('status',    sp.status);
  if (sp.bedrooms)  qs.set('bedrooms',  sp.bedrooms);
  if (sp.priceMin)  qs.set('priceMin',  sp.priceMin);
  if (sp.priceMax)  qs.set('priceMax',  sp.priceMax);
  if (sp.areaMin)   qs.set('areaMin',   sp.areaMin);
  if (sp.areaMax)   qs.set('areaMax',   sp.areaMax);

  const [pagedRes, snapshotRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Unit>>(`/units?${qs.toString()}`)),
    safe(api.get<Paged<Unit>>('/units?pageSize=500')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = pagedRes.data;
  const rows  = paged?.data ?? [];
  const all   = snapshotRes.data?.data ?? [];

  const total     = snapshotRes.data?.meta.total ?? all.length;
  const available = all.filter((u) => u.status === 'AVAILABLE').length;
  const reserved  = all.filter((u) => u.status === 'RESERVED').length;
  const sold      = all.filter((u) => u.status === 'SOLD').length;

  const projects = projectsRes.data?.data ?? [];

  const hasAdvancedFilters = !!(sp.bedrooms || sp.priceMin || sp.priceMax || sp.areaMin || sp.areaMax);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      projectId: sp.projectId, status: sp.status,
      bedrooms: sp.bedrooms, priceMin: sp.priceMin, priceMax: sp.priceMax,
      areaMin: sp.areaMin, areaMax: sp.areaMax, showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/units${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Premium hero ── */}
      <PremiumPageHero
        title="قائمة الوحدات"
        description="إدارة ومراقبة الوحدات العقارية عبر المشاريع والمراحل."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات' },
        ]}
        actions={
          isAdmin ? (
            <>
              <IconButton label="تصدير التقرير" variant="outline" size="md">
                <Download />
              </IconButton>
              <Link href={'/dashboard/units/new' as never}>
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                  إضافة وحدة جديدة
                </Button>
              </Link>
            </>
          ) : undefined
        }
      />

      {/* ── KPI strip ── */}
      <PremiumMetricStrip
        cols={4}
        metrics={[
          {
            label:   'القيمة الإجمالية',
            value:   formatCurrency(all.reduce((s, u) => s + Number(u.price ?? 0), 0)),
            icon:    <CircleDollarSign />,
            tone:    'brand',
            primary: true,
          },
          {
            label: 'إجمالي المتاح',
            value: available,
            sub:   `من أصل ${total} وحدة`,
            icon:  <CheckCircle2 />,
            tone:  'success',
          },
          {
            label: 'قيد الحجز',
            value: reserved,
            icon:  <Bookmark />,
            tone:  'warning',
          },
          {
            label: 'إجمالي المبيعات',
            value: sold,
            icon:  <Box />,
            tone:  'info',
          },
        ]}
      />

      {/* ── Error banner ── */}
      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الوحدات: {pagedRes.error}
        </div>
      )}

      {/* ── Filter bar
           The advanced panel must share the same <form> as the main filters, so we
           pass it as a basis-full child inside PremiumFilterBar rather than a sibling form. ── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/units"
      >
        {/* Hidden inputs preserve advanced filter values when the panel is collapsed */}
        {!showFilters && sp.bedrooms && <input type="hidden" name="bedrooms" value={sp.bedrooms} />}
        {!showFilters && sp.priceMin && <input type="hidden" name="priceMin" value={sp.priceMin} />}
        {!showFilters && sp.priceMax && <input type="hidden" name="priceMax" value={sp.priceMax} />}
        {!showFilters && sp.areaMin  && <input type="hidden" name="areaMin"  value={sp.areaMin} />}
        {!showFilters && sp.areaMax  && <input type="hidden" name="areaMax"  value={sp.areaMax} />}

        <PremiumFilterField label="المشروع" htmlFor="projectId">
          <Select id="projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label="الحالة" htmlFor="status">
          <Select id="status" name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36 shrink-0">
            <option value="">كل الحالات</option>
            <option value="AVAILABLE">متاحة</option>
            <option value="RESERVED">محجوزة</option>
            <option value="SOLD">مباعة</option>
          </Select>
        </PremiumFilterField>

        {/* Action buttons — placed BEFORE the advanced panel so ms-auto keeps them in row 1.
            The basis-full advanced panel below wraps to row 2 without displacing these buttons. */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.projectId || sp.status || hasAdvancedFilters) && (
            <Link href={'/dashboard/units' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </Link>
        </div>

        {/* Advanced filters panel — basis-full forces it onto its own flex row (row 2) */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">غرف النوم</label>
                <Input name="bedrooms" type="number" min={0} inputSize="sm" placeholder="—" defaultValue={sp.bedrooms ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">السعر من</label>
                <Input name="priceMin" type="number" min={0} inputSize="sm" placeholder="0" defaultValue={sp.priceMin ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">السعر إلى</label>
                <Input name="priceMax" type="number" min={0} inputSize="sm" placeholder="∞" defaultValue={sp.priceMax ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">المساحة من (م²)</label>
                <Input name="areaMin" type="number" min={0} inputSize="sm" placeholder="0" defaultValue={sp.areaMin ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">المساحة إلى (م²)</label>
                <Input name="areaMax" type="number" min={0} inputSize="sm" placeholder="∞" defaultValue={sp.areaMax ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Units table ── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
              <tr>
                <th className="text-start py-3.5 ps-5 pe-4">كود الوحدة</th>
                <th className="text-start py-3.5 px-4">المشروع / المرحلة</th>
                <th className="text-start py-3.5 px-4">النوع</th>
                <th className="text-start py-3.5 px-4">المساحة</th>
                <th className="text-start py-3.5 px-4">الغرف</th>
                <th className="text-start py-3.5 px-4">السعر</th>
                <th className="text-start py-3.5 px-4">الحالة</th>
                <th className="text-start py-3.5 px-4">آخر تحديث</th>
                <th className="py-3.5 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <PremiumEmptyState
                      icon={<Box />}
                      title="لا توجد وحدات بعد"
                      description="ابدأ بإضافة أول وحدة إلى محفظة العقارات."
                      action={
                        isAdmin ? (
                          <Link href={'/dashboard/units/new' as never}>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Plus className="h-4 w-4" />}
                            >
                              إضافة وحدة
                            </Button>
                          </Link>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => {
                const projectName = tx(u.building?.phase?.project?.name);
                const phaseName   = tx(u.building?.phase?.name);
                return (
                  <tr
                    key={u.id}
                    className="group hover:bg-canvas/40 transition-colors duration-100"
                  >
                    <td className="py-3.5 ps-5 pe-4">
                      <Link
                        href={`/dashboard/units/${u.id}` as never}
                        className="font-mono text-sm font-semibold text-brand-700 hover:text-brand-800 group-hover:underline underline-offset-2 decoration-brand-300/50"
                      >
                        {u.code}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-navy truncate">{projectName}</p>
                          {phaseName !== '—' && (
                            <p className="text-[11px] text-slate-500 truncate">
                              {phaseName}
                              {u.building?.name && ` · مبنى ${u.building.name}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{u.type}</td>
                    <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-3.5 w-3.5 text-slate-400" />
                        {u.area} م²
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5 text-slate-400" />
                        {u.bedrooms}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-brand-700 tabular-nums whitespace-nowrap">
                      {formatCurrency(u.price)}
                    </td>
                    <td className="py-3.5 px-4">
                      <UnitStatusBadge status={u.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(u.updatedAt)}
                    </td>
                    <td className="py-3.5 ps-4 pe-5">
                      <Link href={`/dashboard/units/${u.id}` as never}>
                        <IconButton label="عرض تفاصيل الوحدة" variant="outline" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged && paged.meta.total > PAGE_SIZE && (
          <div className="border-t border-hairline bg-canvas/20">
            <Pagination
              page={paged.meta.page}
              pageSize={paged.meta.pageSize}
              total={paged.meta.total}
              basePath="/dashboard/units"
              params={{
                projectId: sp.projectId,
                status:    sp.status,
                bedrooms:  sp.bedrooms,
                priceMin:  sp.priceMin,
                priceMax:  sp.priceMax,
                areaMin:   sp.areaMin,
                areaMax:   sp.areaMax,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
