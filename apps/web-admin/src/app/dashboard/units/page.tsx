import Link from 'next/link';
import {
  Plus,
  Box,
  CheckCircle2,
  Bookmark,
  CircleDollarSign,
  ArrowRight,
  Download,
  Filter,
  BedDouble,
  Ruler,
  Building2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, Project } from '@/lib/types';
import { tx, formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { UnitStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  status?: string;
  bedrooms?: string;
  priceMin?: string;
  priceMax?: string;
  areaMin?: string;
  areaMax?: string;
}

const PAGE_SIZE = 12;

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.status) qs.set('status', sp.status);
  if (sp.bedrooms) qs.set('bedrooms', sp.bedrooms);
  if (sp.priceMin) qs.set('priceMin', sp.priceMin);
  if (sp.priceMax) qs.set('priceMax', sp.priceMax);
  if (sp.areaMin) qs.set('areaMin', sp.areaMin);
  if (sp.areaMax) qs.set('areaMax', sp.areaMax);

  const [pagedRes, snapshotRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Unit>>(`/units?${qs.toString()}`)),
    safe(api.get<Paged<Unit>>('/units?pageSize=500')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = pagedRes.data;
  const rows = paged?.data ?? [];
  const all = snapshotRes.data?.data ?? [];

  const total = snapshotRes.data?.meta.total ?? all.length;
  const available = all.filter((u) => u.status === 'AVAILABLE').length;
  const reserved = all.filter((u) => u.status === 'RESERVED').length;
  const sold = all.filter((u) => u.status === 'SOLD').length;

  const projects = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إدارة الوحدات السكنية"
        description="استعرض وتابع محفظة الوحدات بدقة عالية من خلال نظام إدارة المخزون المتقدم."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات' },
        ]}
        actions={
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
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="القيمة الإجمالية"
          value={formatCurrency(
            all.reduce((s, u) => s + Number(u.price ?? 0), 0),
          )}
          icon={<CircleDollarSign />}
          tone="brand"
        />
        <KpiCard
          label="إجمالي المتاح"
          value={available}
          sub={`من أصل ${total} وحدة`}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <KpiCard
          label="قيد الحجز"
          value={reserved}
          icon={<Bookmark />}
          tone="warning"
        />
        <KpiCard
          label="إجمالي المبيعات"
          value={sold}
          icon={<Box />}
          tone="info"
        />
      </div>

      {pagedRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الوحدات: {pagedRes.error}
        </div>
      )}

      <FilterBar
        method="get"
        action="/dashboard/units"
        trailing={
          <Button type="submit" variant="secondary" size="sm" leftIcon={<Filter className="h-4 w-4" />}>
            تطبيق
          </Button>
        }
      >
        <FilterField label="المشروع" htmlFor="filter-project">
          <Select
            id="filter-project"
            name="projectId"
            inputSize="sm"
            defaultValue={sp.projectId ?? ''}
          >
            <option value="">الكل</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.name)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="الحالة" htmlFor="filter-status">
          <Select
            id="filter-status"
            name="status"
            inputSize="sm"
            defaultValue={sp.status ?? ''}
          >
            <option value="">الكل</option>
            <option value="AVAILABLE">متاحة</option>
            <option value="RESERVED">محجوزة</option>
            <option value="SOLD">مباعة</option>
          </Select>
        </FilterField>
        <FilterField label="غرف النوم" htmlFor="filter-bedrooms" className="min-w-[120px]">
          <Input
            id="filter-bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            inputSize="sm"
            placeholder="—"
            defaultValue={sp.bedrooms ?? ''}
          />
        </FilterField>
        <FilterField label="السعر من" htmlFor="filter-price-min" className="min-w-[140px]">
          <Input
            id="filter-price-min"
            name="priceMin"
            type="number"
            min={0}
            inputSize="sm"
            placeholder="0"
            defaultValue={sp.priceMin ?? ''}
          />
        </FilterField>
        <FilterField label="السعر إلى" htmlFor="filter-price-max" className="min-w-[140px]">
          <Input
            id="filter-price-max"
            name="priceMax"
            type="number"
            min={0}
            inputSize="sm"
            placeholder="∞"
            defaultValue={sp.priceMax ?? ''}
          />
        </FilterField>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">كود الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">المشروع / المرحلة</th>
                <th className="text-start font-semibold py-3 px-4">النوع</th>
                <th className="text-start font-semibold py-3 px-4">المساحة</th>
                <th className="text-start font-semibold py-3 px-4">الغرف</th>
                <th className="text-start font-semibold py-3 px-4">السعر</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">آخر تحديث</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<Box />}
                      title="لا توجد وحدات بعد"
                      description="ابدأ بإضافة أول وحدة إلى محفظة العقارات."
                      action={
                        <Link href={'/dashboard/units/new' as never}>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            إضافة وحدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => {
                const projectName = tx(u.building?.phase?.project?.name);
                const phaseName = tx(u.building?.phase?.name);
                return (
                  <tr
                    key={u.id}
                    className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 ps-5 pe-4">
                      <Link
                        href={`/dashboard/units/${u.id}` as never}
                        className="font-mono text-sm font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {u.code}
                      </Link>
                    </td>
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {projectName}
                          </p>
                          {phaseName !== '—' && (
                            <p className="text-2xs text-slate-500 truncate">
                              {phaseName}
                              {u.building?.name && ` · مبنى ${u.building.name}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{u.type}</td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-3.5 w-3.5 text-slate-400" />
                        {u.area} م²
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5 text-slate-400" />
                        {u.bedrooms}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-brand-700 tabular-nums whitespace-nowrap">
                      {formatCurrency(u.price)}
                    </td>
                    <td className="py-3 px-4">
                      <UnitStatusBadge status={u.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(u.updatedAt)}
                    </td>
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/dashboard/units/${u.id}` as never}>
                        <IconButton label="عرض الوحدة" variant="ghost" size="sm">
                          <ArrowRight className="rtl:rotate-180" />
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
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/dashboard/units"
            params={{
              projectId: sp.projectId,
              status: sp.status,
              bedrooms: sp.bedrooms,
              priceMin: sp.priceMin,
              priceMax: sp.priceMax,
              areaMin: sp.areaMin,
              areaMax: sp.areaMax,
            }}
          />
        )}
      </Card>
    </div>
  );
}
