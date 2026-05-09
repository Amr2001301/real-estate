import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Contract } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { DataTable } from '@/components/table';

export default async function ContractsPage() {
  const r = await safe(api.get<Paged<Contract>>('/contracts?pageSize=50'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">العقود</h1>
        <Link
          href="/dashboard/contracts/new"
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          + عقد جديد
        </Link>
      </div>

      {r.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{r.error}</div>
      )}

      {r.data && (
        <DataTable
          rowKey={(c) => c.id}
          rows={r.data.data}
          emptyMessage="لا توجد عقود بعد"
          columns={[
            {
              key: 'customer',
              header: 'العميل',
              cell: (c) => <span className="font-medium">{c.customer?.fullName ?? '—'}</span>,
            },
            {
              key: 'unit',
              header: 'الوحدة',
              cell: (c) => (
                <span className="text-xs text-gray-600">
                  {c.unit?.code ?? '—'} · {tx(c.unit?.building?.phase?.project?.name)}
                </span>
              ),
            },
            { key: 'total', header: 'الإجمالي', cell: (c) => formatCurrency(c.totalAmount) },
            { key: 'down', header: 'المقدم', cell: (c) => formatCurrency(c.downPayment) },
            {
              key: 'pdf',
              header: 'العقد PDF',
              cell: (c) => (c.pdfUrl ? '✓' : '—'),
            },
            { key: 'created', header: 'التاريخ', cell: (c) => formatDate(c.createdAt) },
            {
              key: 'actions',
              header: '',
              cell: (c) => (
                <Link href={`/dashboard/contracts/${c.id}`} className="text-brand-600 hover:underline text-sm">
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
