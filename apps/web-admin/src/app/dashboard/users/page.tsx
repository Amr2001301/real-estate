import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';
import type { Paged, User, UserRole } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { DataTable } from '@/components/table';

async function deactivateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/deactivate`);
  revalidatePath('/dashboard/users');
}

async function activateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/activate`);
  revalidatePath('/dashboard/users');
}

async function createUserAction(formData: FormData) {
  'use server';
  await api.post('/users', {
    role: String(formData.get('role') ?? 'SALES'),
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? '') || undefined,
    phone: String(formData.get('phone') ?? '') || undefined,
    password: String(formData.get('password') ?? '') || undefined,
  });
  revalidatePath('/dashboard/users');
}

// ADMIN-only: assign/clear the SALES_MANAGER who owns a SALES rep. An empty
// value clears the assignment (managerId = null).
async function assignManagerAction(userId: string, formData: FormData) {
  'use server';
  const managerId = String(formData.get('managerId') ?? '') || null;
  await api.patch(`/users/${userId}/manager`, { managerId });
  revalidatePath('/dashboard/users');
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '100' });
  if (sp.role) qs.set('role', sp.role);
  const [r, managersRes] = await Promise.all([
    safe(api.get<Paged<User>>(`/users?${qs}`)),
    safe(api.get<Paged<User>>('/users?role=SALES_MANAGER&pageSize=100')),
  ]);
  const managers = managersRes.data?.data ?? [];

  const ROLES: UserRole[] = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'CLIENT', 'CUSTOMER'];
  const ROLE_LABEL: Record<UserRole, string> = {
    ADMIN: 'مدير النظام',
    SALES: 'مبيعات',
    SALES_MANAGER: 'مدير مبيعات',
    MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
    CLIENT: 'متصفّح',
    CUSTOMER: 'عميل',
    BROKER: 'وسيط',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المستخدمون</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">إنشاء مستخدم (Admin / Sales)</h2>
        <form action={createUserAction} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select name="role" defaultValue="SALES" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ADMIN">مدير النظام</option>
            <option value="SALES">مبيعات</option>
            <option value="SALES_MANAGER">مدير مبيعات</option>
            <option value="MAINTENANCE_SUPERVISOR">مشرف الصيانة</option>
          </select>
          <input
            name="fullName"
            required
            placeholder="الاسم الكامل"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="email"
            dir="ltr"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="كلمة المرور (8+)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 text-sm">
            إنشاء
          </button>
        </form>
      </section>

      <form className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">الدور</label>
          <select name="role" defaultValue={sp.role ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">الكل</option>
            {ROLES.map((rr) => (
              <option key={rr} value={rr}>
                {ROLE_LABEL[rr]}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm">تصفية</button>
      </form>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>}
      {r.data && (
        <DataTable
          rowKey={(u) => u.id}
          rows={r.data.data}
          emptyMessage="لا يوجد مستخدمون"
          columns={[
            { key: 'name', header: 'الاسم', cell: (u) => u.fullName },
            { key: 'role', header: 'الدور', cell: (u) => <span className="text-xs">{ROLE_LABEL[u.role] ?? u.role}</span> },
            {
              key: 'manager',
              header: 'مدير المبيعات',
              // Manager assignment applies to SALES reps only.
              cell: (u) =>
                u.role === 'SALES' ? (
                  <form action={assignManagerAction.bind(null, u.id)} className="flex items-center gap-1">
                    <select
                      name="managerId"
                      defaultValue={u.managerId ?? ''}
                      className="text-xs rounded border border-gray-300 px-1.5 py-0.5 max-w-[140px]"
                    >
                      <option value="">بدون مدير</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>{m.fullName}</option>
                      ))}
                    </select>
                    <button className="text-xs rounded bg-gray-800 text-white px-2 py-0.5">حفظ</button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                ),
            },
            { key: 'contact', header: 'تواصل', cell: (u) => <span dir="ltr" className="text-xs">{u.email || u.phone || '—'}</span> },
            { key: 'created', header: 'انضم', cell: (u) => formatDate(u.createdAt) },
            { key: 'last', header: 'آخر دخول', cell: (u) => formatDate(u.lastLoginAt) },
            {
              key: 'state',
              header: 'الحالة',
              cell: (u) =>
                u.active ? (
                  <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">نشط</span>
                ) : (
                  <span className="rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-xs">معطل</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              cell: (u) =>
                u.active ? (
                  <form action={deactivateAction.bind(null, u.id)}>
                    <button className="text-xs text-red-600 hover:underline">إلغاء التفعيل</button>
                  </form>
                ) : (
                  <form action={activateAction.bind(null, u.id)}>
                    <button className="text-xs text-green-600 hover:underline">تفعيل</button>
                  </form>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
