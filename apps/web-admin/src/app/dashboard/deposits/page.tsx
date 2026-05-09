import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Deposit } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { DataTable } from '@/components/table';
import { VerifyToggle } from './verify-toggle';

export default async function DepositsPage() {
  const r = await safe(api.get<Paged<Deposit>>('/deposits?pageSize=50'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الدفعات</h1>
        <Link
          href="/dashboard/deposits/new"
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
        >
          + تسجيل دفعة
        </Link>
      </div>

      {r.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 mb-4 text-sm">{r.error}</div>
      )}

      {r.data && (
        <DataTable
          rowKey={(d) => d.id}
          rows={r.data.data}
          emptyMessage="لا توجد دفعات بعد"
          columns={[
            {
              key: 'customer',
              header: 'العميل',
              cell: (d) => d.contract?.customer?.fullName ?? '—',
            },
            {
              key: 'contract',
              header: 'العقد',
              cell: (d) => (
                <Link
                  href={`/dashboard/contracts/${d.contractId}`}
                  className="text-brand-600 hover:underline text-xs font-mono"
                >
                  #{d.contractId.slice(0, 8)}
                </Link>
              ),
            },
            { key: 'amount', header: 'المبلغ', cell: (d) => formatCurrency(d.amount) },
            { key: 'paidAt', header: 'تاريخ الدفع', cell: (d) => formatDate(d.paidAt) },
            {
              key: 'receipt',
              header: 'الإيصال',
              cell: (d) =>
                d.receiptUrl ? (
                  <a
                    href={d.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline text-xs"
                  >
                    عرض
                  </a>
                ) : (
                  '—'
                ),
            },
            {
              key: 'verified',
              header: 'التحقق',
              cell: (d) => (
                <VerifyToggle id={d.id} contractId={d.contractId} verified={d.verified} />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
