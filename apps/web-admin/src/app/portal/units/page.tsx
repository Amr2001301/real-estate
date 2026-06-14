import Link from 'next/link';
import { IconButton } from '@/components/ui/icon-button';
import {
  Home,
  ShieldCheck,
  Layers,
  CheckCircle2,
  BookmarkCheck,
  Tag,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalUnit } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { UnitStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  projectId?: string;
  status?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  q?: string;
}

const PAGE_SIZE = 20;

const ACCESS_LABEL: Record<'PROJECT_ACCESS' | 'UNIT_ACCESS', string> = {
  PROJECT_ACCESS: 'صلاحية مشروع',
  UNIT_ACCESS:    'صلاحية وحدة',
};

export default async function PortalUnitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['projectId', 'status', 'type', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'q'] as const) {
    const value = sp[key];
    if (value) qs.set(key, value);
  }

  const [unitsRes, projectsRes, rAvailable, rReserved, rSold] = await Promise.all([
    safe(api.get<Paged<PortalUnit>>(`/portal/units?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=AVAILABLE')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=RESERVED')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?page=1&pageSize=1&status=SOLD')),
  ]);

  const paged          = unitsRes.data;
  const rows           = paged?.data ?? [];
  const projects       = projectsRes.data ?? [];
  const availableCount = rAvailable.data?.meta.total ?? 0;
  const reservedCount  = rReserved.data?.meta.total  ?? 0;
  const soldCount      = rSold.data?.meta.total      ?? 0;

  const knownTypes = Array.from(new Set(rows.map((u) => u.type))).filter(Boolean);
  const typeOptions = knownTypes.length > 0
    ? knownTypes
    : ['studio', '1BR', '2BR', '3BR', '4BR', 'villa'];

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="الوحدات المتاحة"
        description="استعرض الوحدات التي يحق لك العمل عليها — متاحة، محجوزة، أو مباعة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الوحدات' },
        ]}
      />

      {unitsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل الوحدات: {unitsRes.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الوحدات"  value={paged?.meta.total ?? 0} icon={<Home />}          tone="brand"   />
        <PageKpiCard label="متاحة للبيع"     value={availableCount}         icon={<CheckCircle2 />}  tone="success" />
        <PageKpiCard label="محجوزة"          value={reservedCount}          icon={<BookmarkCheck />} tone="warning" />
        <PageKpiCard label="مباعة"           value={soldCount}              icon={<Tag />}           tone="info"    />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <form
        method="get"
        action="/portal/units"
        className="rounded-xl border border-hairline bg-white p-3 shadow-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
      >
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>

        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">كل الحالات</option>
          <option value="AVAILABLE">متاحة</option>
          <option value="RESERVED">محجوزة</option>
          <option value="SOLD">مباعة</option>
        </Select>

        <Select name="type" inputSize="sm" defaultValue={sp.type ?? ''}>
          <option value="">كل الأنواع</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>

        <Select name="bedrooms" inputSize="sm" defaultValue={sp.bedrooms ?? ''}>
          <option value="">عدد الغرف</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>{n} غرف</option>
          ))}
        </Select>

        <Input
          inputSize="sm"
          name="minPrice"
          type="number"
          min={0}
          placeholder="سعر من"
          defaultValue={sp.minPrice ?? ''}
        />
        <Input
          inputSize="sm"
          name="maxPrice"
          type="number"
          min={0}
          placeholder="سعر إلى"
          defaultValue={sp.maxPrice ?? ''}
        />
        <Input
          inputSize="sm"
          name="q"
          placeholder="رمز الوحدة"
          defaultValue={sp.q ?? ''}
          className="md:col-span-2"
        />
        <Select name="bathrooms" inputSize="sm" defaultValue={sp.bathrooms ?? ''}>
          <option value="">عدد الحمامات</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={String(n)}>{n}</option>
          ))}
        </Select>

        <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.projectId || sp.status || sp.type || sp.q || sp.minPrice || sp.maxPrice || sp.bedrooms || sp.bathrooms) && (
            <Link href="/portal/units">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>وحدة مطابقة للتصفية</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">المشروع / المبنى</th>
                <th className="text-start font-semibold py-3 px-4">المواصفات</th>
                <th className="text-start font-semibold py-3 px-4">السعر</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">نوع الصلاحية</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<Home />}
                      title="لا توجد وحدات متاحة بعد"
                      description="جرّب تعديل الفلاتر، أو تواصل مع الإدارة لتوسيع صلاحيتك."
                    />
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                >
                  {/* Unit code + type */}
                  <td className="py-3 ps-5 pe-4">
                    <p className="font-mono font-bold text-slate-900 text-sm" dir="ltr">
                      {u.code}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5 uppercase tracking-wide">
                      {u.type}
                    </p>
                  </td>

                  {/* Project / Building */}
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-800 text-xs">
                      {tx(u.building.phase.project.name)}
                    </p>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      {u.building.phase.project.city}
                    </p>
                    <p className="text-2xs text-slate-500 mt-1 inline-flex items-center gap-1">
                      <Layers className="h-3 w-3 text-slate-400" />
                      {u.building.name}
                    </p>
                  </td>

                  {/* Specs */}
                  <td className="py-3 px-4">
                    <div className="text-xs text-slate-700 space-y-0.5">
                      <p className="font-medium tabular-nums">{u.area} م²</p>
                      <p className="text-slate-500">
                        {u.bedrooms} غرف • {u.bathrooms} حمامات
                      </p>
                      <p className="text-slate-400 text-2xs">دور {u.floor}</p>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4 tabular-nums font-bold text-slate-900 text-xs">
                    {formatCurrency(u.price)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <UnitStatusBadge status={u.status} />
                  </td>

                  {/* Access source */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-2xs text-slate-600">
                      <ShieldCheck className="h-3 w-3 text-brand-500" />
                      {ACCESS_LABEL[u.accessSource]}
                    </span>
                  </td>

                  {/* Reserve action */}
                  <td className="py-3 ps-4 pe-5">
                    {u.status === 'AVAILABLE' && (
                      <Link href="/portal/reservations/new">
                        <IconButton label="احجز" variant="ghost" size="sm">
                          <Plus />
                        </IconButton>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/units"
            params={{
              projectId: sp.projectId,
              status:    sp.status,
              type:      sp.type,
              minPrice:  sp.minPrice,
              maxPrice:  sp.maxPrice,
              bedrooms:  sp.bedrooms,
              bathrooms: sp.bathrooms,
              q:         sp.q,
            }}
          />
        )}
      </Card>
    </div>
  );
}
