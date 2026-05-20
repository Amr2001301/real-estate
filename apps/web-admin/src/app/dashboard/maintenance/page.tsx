import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import type { Paged, MaintenanceRequest, MaintenanceStatus, User } from '@/lib/types';
import { formatDate, tx } from '@/lib/format';
import { DataTable } from '@/components/table';
import { MaintenanceStatusBadge } from '@/components/badges';

async function updateMaintAction(id: string, formData: FormData) {
  'use server';
  // The legacy PATCH /maintenance-requests/:id multiplexer has been removed.
  // Assignment and status changes each route to a dedicated POST endpoint
  // with its own permission code (maintenance:assign vs maintenance:resolve).
  // When both fields are submitted we call assign first, then status —
  // matching the natural admin workflow.
  const status = String(formData.get('status') ?? '') as MaintenanceStatus | '';
  const assignedAdminId = String(formData.get('assignedAdminId') ?? '') || undefined;

  if (assignedAdminId) {
    await api.post(`/maintenance-requests/${id}/assign`, { assignedAdminId });
  }
  if (status) {
    await api.post(`/maintenance-requests/${id}/status`, { status });
  }

  revalidatePath('/dashboard/maintenance');
}

async function createCategoryAction(formData: FormData) {
  'use server';
  await api.post('/maintenance-categories', {
    ar: String(formData.get('ar') ?? ''),
    en: String(formData.get('en') ?? ''),
  });
  revalidatePath('/dashboard/maintenance');
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '50' });
  if (sp.status) qs.set('status', sp.status);

  const [reqsRes, catsRes, adminsRes] = await Promise.all([
    safe(api.get<Paged<MaintenanceRequest>>(`/maintenance-requests?${qs}`)),
    safe(api.get<Array<{ id: string; name: { ar: string; en: string } }>>('/maintenance-categories')),
    safe(api.get<Paged<User>>('/users?role=ADMIN&pageSize=50')),
  ]);

  const STATUSES: MaintenanceStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الصيانة</h1>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">التصنيفات</h2>
        <ul className="flex flex-wrap gap-2 mb-4">
          {(catsRes.data ?? []).map((c) => (
            <li
              key={c.id}
              className="bg-gray-100 rounded-full px-3 py-1 text-xs"
            >
              {tx(c.name)}
            </li>
          ))}
          {(catsRes.data ?? []).length === 0 && (
            <li className="text-xs text-gray-400">لا توجد تصنيفات</li>
          )}
        </ul>
        <form action={createCategoryAction} className="flex flex-wrap gap-2">
          <input
            name="ar"
            required
            dir="rtl"
            placeholder="بالعربية"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <input
            name="en"
            required
            dir="ltr"
            placeholder="English"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm">
            + إضافة تصنيف
          </button>
        </form>
      </section>

      {reqsRes.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{reqsRes.error}</div>
      )}

      {reqsRes.data && (
        <DataTable
          rowKey={(m) => m.id}
          rows={reqsRes.data.data}
          emptyMessage="لا توجد طلبات صيانة"
          columns={[
            { key: 'customer', header: 'العميل', cell: (m) => m.customer?.fullName ?? '—' },
            { key: 'unit', header: 'الوحدة', cell: (m) => m.unit?.code ?? '—' },
            { key: 'category', header: 'التصنيف', cell: (m) => tx(m.category?.name) },
            { key: 'desc', header: 'الوصف', cell: (m) => <span className="text-xs">{m.description.slice(0, 60)}{m.description.length > 60 ? '…' : ''}</span> },
            { key: 'status', header: 'الحالة', cell: (m) => <MaintenanceStatusBadge status={m.status} /> },
            { key: 'created', header: 'التاريخ', cell: (m) => formatDate(m.createdAt) },
            {
              key: 'actions',
              header: '',
              cell: (m) => (
                <form
                  action={updateMaintAction.bind(null, m.id)}
                  className="flex gap-1 items-center"
                >
                  <select
                    name="status"
                    defaultValue={m.status}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    name="assignedAdminId"
                    defaultValue={m.assignedAdminId ?? ''}
                    className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    <option value="">— مسند —</option>
                    {adminsRes.data?.data.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fullName}
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
