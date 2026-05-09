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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: '100' });
  if (sp.role) qs.set('role', sp.role);
  const r = await safe(api.get<Paged<User>>(`/users?${qs}`));

  const ROLES: UserRole[] = ['ADMIN', 'SALES', 'CLIENT', 'CUSTOMER'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المستخدمون</h1>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold mb-3">إنشاء مستخدم (Admin / Sales)</h2>
        <form action={createUserAction} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select name="role" defaultValue="SALES" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ADMIN">ADMIN</option>
            <option value="SALES">SALES</option>
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
                {rr}
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
            { key: 'role', header: 'الدور', cell: (u) => <span className="font-mono text-xs">{u.role}</span> },
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
