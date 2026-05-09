import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { DataTable } from '@/components/table';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const role = sp.role ?? 'CLIENT';
  const r = await safe(api.get<Paged<User>>(`/users?role=${role}&pageSize=100`));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">العملاء</h1>

      <div className="flex gap-2 mb-4">
        <Link
          href="/dashboard/clients?role=CLIENT"
          className={`rounded-lg px-3 py-1.5 text-sm ${role === 'CLIENT' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Clients (متصفحون)
        </Link>
        <Link
          href="/dashboard/clients?role=CUSTOMER"
          className={`rounded-lg px-3 py-1.5 text-sm ${role === 'CUSTOMER' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Customers (مالكون)
        </Link>
      </div>

      {r.error && <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{r.error}</div>}

      {r.data && (
        <DataTable
          rowKey={(u) => u.id}
          rows={r.data.data}
          emptyMessage="لا يوجد عملاء"
          columns={[
            { key: 'name', header: 'الاسم', cell: (u) => <span className="font-medium">{u.fullName}</span> },
            { key: 'phone', header: 'الهاتف', cell: (u) => <span dir="ltr" className="text-xs font-mono">{u.phone ?? '—'}</span> },
            { key: 'email', header: 'البريد', cell: (u) => <span dir="ltr" className="text-xs">{u.email ?? '—'}</span> },
            { key: 'created', header: 'تاريخ التسجيل', cell: (u) => formatDate(u.createdAt) },
            { key: 'last', header: 'آخر دخول', cell: (u) => formatDate(u.lastLoginAt) },
          ]}
        />
      )}
    </div>
  );
}
