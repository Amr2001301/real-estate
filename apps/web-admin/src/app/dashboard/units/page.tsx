import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Unit, Project } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { DataTable } from '@/components/table';
import { UnitStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  projectId?: string;
  status?: string;
}

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '50', ...sp });
  const [unitsRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Unit>>(`/units?${qs}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الوحدات</h1>
        <Link
          href="/dashboard/units/new"
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          + وحدة جديدة
        </Link>
      </div>

      {projectsRes.data && (
        <form className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">المشروع</label>
            <select
              name="projectId"
              defaultValue={sp.projectId ?? ''}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">الكل</option>
              {projectsRes.data.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {tx(p.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">الحالة</label>
            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">الكل</option>
              <option value="AVAILABLE">متاحة</option>
              <option value="RESERVED">محجوزة</option>
              <option value="SOLD">مباعة</option>
            </select>
          </div>
          <button className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm">تصفية</button>
        </form>
      )}

      {unitsRes.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{unitsRes.error}</div>
      )}

      {unitsRes.data && (
        <DataTable
          rowKey={(u) => u.id}
          rows={unitsRes.data.data}
          emptyMessage="لا توجد وحدات بعد — أضف وحدة جديدة"
          columns={[
            {
              key: 'code',
              header: 'الرمز',
              cell: (u) => <span className="font-mono text-sm">{u.code}</span>,
            },
            { key: 'type', header: 'النوع', cell: (u) => u.type },
            {
              key: 'project',
              header: 'المشروع',
              cell: (u) => (
                <span className="text-gray-600 text-xs">
                  {tx(u.building?.phase?.project?.name) ?? '—'}
                </span>
              ),
            },
            { key: 'area', header: 'المساحة', cell: (u) => `${u.area} م²` },
            { key: 'bedrooms', header: 'غرف', cell: (u) => u.bedrooms },
            { key: 'price', header: 'السعر', cell: (u) => formatCurrency(u.price) },
            { key: 'status', header: 'الحالة', cell: (u) => <UnitStatusBadge status={u.status} /> },
            {
              key: 'actions',
              header: '',
              cell: (u) => (
                <Link href={`/dashboard/units/${u.id}`} className="text-brand-600 hover:underline text-sm">
                  عرض
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
