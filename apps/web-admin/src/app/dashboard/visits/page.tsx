import { api, safe } from '@/lib/api';
import type { Paged, VisitRequest, VisitStatus } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { DataTable } from '@/components/table';
import { VisitStatusBadge } from '@/components/badges';
import { revalidatePath } from 'next/cache';

async function setVisitStatusAction(id: string, formData: FormData) {
  'use server';
  const status = String(formData.get('status') ?? 'PENDING') as VisitStatus;
  const scheduledAt = String(formData.get('scheduledAt') ?? '') || undefined;
  await api.patch(`/visit-requests/${id}`, { status, scheduledAt });
  revalidatePath('/dashboard/visits');
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '50' });
  if (sp.status) qs.set('status', sp.status);
  const r = await safe(api.get<Paged<VisitRequest>>(`/visit-requests?${qs}`));

  const STATUSES: VisitStatus[] = ['PENDING', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">طلبات الزيارة</h1>

      <form className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">الحالة</label>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">الكل</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm">تصفية</button>
      </form>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{r.error}</div>}

      {r.data && (
        <DataTable
          rowKey={(v) => v.id}
          rows={r.data.data}
          emptyMessage="لا توجد طلبات زيارة"
          columns={[
            { key: 'project', header: 'المشروع', cell: (v) => tx(v.project?.name) },
            { key: 'unit', header: 'الوحدة', cell: (v) => v.unit?.code ?? '—' },
            { key: 'preferred', header: 'التاريخ المفضل', cell: (v) => formatDate(v.preferredDate) },
            { key: 'scheduled', header: 'موعد مجدول', cell: (v) => formatDateTime(v.scheduledAt) },
            { key: 'status', header: 'الحالة', cell: (v) => <VisitStatusBadge status={v.status} /> },
            { key: 'sales', header: 'المندوب', cell: (v) => v.assignedSales?.fullName ?? '—' },
            {
              key: 'actions',
              header: '',
              cell: (v) => (
                <form action={setVisitStatusAction.bind(null, v.id)} className="flex gap-1 items-center">
                  <select
                    name="status"
                    defaultValue={v.status}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    defaultValue={v.scheduledAt ? v.scheduledAt.slice(0, 16) : ''}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  />
                  <button className="text-xs rounded bg-gray-800 text-white px-2 py-1">حفظ</button>
                </form>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
