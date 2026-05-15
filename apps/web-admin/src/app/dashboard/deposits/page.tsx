import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Deposit } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/table';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';

export const dynamic = 'force-dynamic';

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;

  const r = await safe(
    api.get<Paged<Deposit>>(`/deposits?page=${page}&pageSize=${pageSize}`),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="الدفعات"
        description="سجل جميع دفعات الأقساط المسجلة على العقود."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات' },
        ]}
        actions={
          <Link
            href="/dashboard/deposits/new"
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
          >
            + تسجيل دفعة
          </Link>
        }
      />

      {r.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{r.error}</div>
      )}

      {r.data && (
        <>
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
                    {d.contract?.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                  </Link>
                ),
              },
              {
                key: 'installment',
                header: 'القسط',
                cell: (d) =>
                  d.installment?.dueDate ? (
                    <span className="text-xs text-slate-600">{formatDate(d.installment.dueDate)}</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
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

          <Pagination
            basePath="/dashboard/deposits"
            page={page}
            pageSize={pageSize}
            total={r.data.meta.total}
          />
        </>
      )}
    </div>
  );
}
