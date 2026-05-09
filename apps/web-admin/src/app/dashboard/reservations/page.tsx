import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import type { Paged, Reservation, ReservationStatus } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { DataTable } from '@/components/table';
import { ReservationStatusBadge } from '@/components/badges';

async function setReservationStatusAction(id: string, formData: FormData) {
  'use server';
  const status = String(formData.get('status') ?? 'PENDING') as ReservationStatus;
  await api.patch(`/reservations/${id}/status`, { status });
  revalidatePath('/dashboard/reservations');
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '50' });
  if (sp.status) qs.set('status', sp.status);
  const r = await safe(api.get<Paged<Reservation>>(`/reservations?${qs}`));

  const STATUSES: ReservationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">الحجوزات</h1>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{r.error}</div>}

      {r.data && (
        <DataTable
          rowKey={(rv) => rv.id}
          rows={r.data.data}
          emptyMessage="لا توجد حجوزات"
          columns={[
            { key: 'unit', header: 'الوحدة', cell: (rv) => rv.unit?.code ?? '—' },
            {
              key: 'project',
              header: 'المشروع',
              cell: (rv) => tx(rv.unit?.building?.phase?.project?.name),
            },
            { key: 'sales', header: 'المندوب', cell: (rv) => rv.sales?.fullName ?? '—' },
            { key: 'lead', header: 'العميل', cell: (rv) => rv.lead?.fullName ?? '—' },
            { key: 'expires', header: 'تنتهي', cell: (rv) => formatDateTime(rv.expiresAt) },
            { key: 'status', header: 'الحالة', cell: (rv) => <ReservationStatusBadge status={rv.status} /> },
            { key: 'created', header: 'تاريخ', cell: (rv) => formatDate(rv.createdAt) },
            {
              key: 'actions',
              header: '',
              cell: (rv) => (
                <form
                  action={setReservationStatusAction.bind(null, rv.id)}
                  className="flex gap-1 items-center"
                >
                  <select
                    name="status"
                    defaultValue={rv.status}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
