import Link from 'next/link';
import { Home, ShieldCheck, Layers } from 'lucide-react';
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
  UNIT_ACCESS: 'صلاحية وحدة',
};

export default async function PortalUnitsPage({
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
  for (const key of ['projectId', 'status', 'type', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'q'] as const) {
    const value = sp[key];
    if (value) qs.set(key, value);
  }

  const [unitsRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<PortalUnit>>(`/portal/units?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
  ]);

  const paged = unitsRes.data;
  const rows = paged?.data ?? [];
  const projects = projectsRes.data ?? [];

  // Unit-type options derived from current page rows; falls back to common types.
  const knownTypes = Array.from(new Set(rows.map((u) => u.type))).filter(Boolean);
  const typeOptions = knownTypes.length > 0
    ? knownTypes
    : ['studio', '1BR', '2BR', '3BR', '4BR', 'villa'];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الوحدات المتاحة"
        description="استعراض الوحدات التي تستطيع العمل عليها وفقاً للصلاحيات الممنوحة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الوحدات' },
        ]}
      />

      {unitsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الوحدات: {unitsRes.error}
        </div>
      )}

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
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select name="bedrooms" inputSize="sm" defaultValue={sp.bedrooms ?? ''}>
          <option value="">عدد الغرف</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n} غرف
            </option>
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
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </Select>
        <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.projectId || sp.status || sp.type || sp.q || sp.minPrice || sp.maxPrice || sp.bedrooms || sp.bathrooms) && (
            <Link href="/portal/units">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">المبنى</th>
                <th className="text-start font-semibold py-3 px-4">المواصفات</th>
                <th className="text-start font-semibold py-3 px-4">السعر</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">الصلاحية</th>
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
                  <td className="py-3 ps-5 pe-4">
                    <p className="font-mono font-semibold text-slate-900" dir="ltr">
                      {u.code}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">{u.type}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {tx(u.building.phase.project.name)}
                    <p className="text-2xs text-slate-400">{u.building.phase.project.city}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      {u.building.name} • {tx(u.building.phase.name)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 space-y-0.5">
                    <p>المساحة: {u.area} م²</p>
                    <p>
                      {u.bedrooms} غرف • {u.bathrooms} حمامات • الدور {u.floor}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(u.price)}
                  </td>
                  <td className="py-3 px-4">
                    <UnitStatusBadge status={u.status} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-2xs text-slate-600">
                      <ShieldCheck className="h-3 w-3 text-brand-500" />
                      {ACCESS_LABEL[u.accessSource]}
                    </span>
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
              status: sp.status,
              type: sp.type,
              minPrice: sp.minPrice,
              maxPrice: sp.maxPrice,
              bedrooms: sp.bedrooms,
              bathrooms: sp.bathrooms,
              q: sp.q,
            }}
          />
        )}
      </Card>
    </div>
  );
}
