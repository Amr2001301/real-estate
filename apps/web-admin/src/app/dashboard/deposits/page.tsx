import Link from 'next/link';
import { api, safe } from '@/lib/api';
import type { Paged, Deposit, DepositType } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/table';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';

export const dynamic = 'force-dynamic';

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700',
  DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',
  FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};

function getCustomerName(d: Deposit): string {
  if (d.contract?.customer?.fullName) return d.contract.customer.fullName;
  if (d.reservation?.client?.fullName) return d.reservation.client.fullName;
  if (d.reservation?.lead?.fullName) return d.reservation.lead.fullName;
  return '—';
}

function getUnitCode(d: Deposit): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

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
        description="سجل جميع الدفعات المالية على الحجوزات والعقود."
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
                key: 'type',
                header: 'نوع الدفعة',
                cell: (d) => {
                  const type = d.type ?? 'INSTALLMENT';
                  return (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${DEPOSIT_TYPE_CLS[type as DepositType] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {DEPOSIT_TYPE_LABELS[type as DepositType] ?? type}
                    </span>
                  );
                },
              },
              {
                key: 'customer',
                header: 'العميل',
                cell: (d) => getCustomerName(d),
              },
              {
                key: 'unit',
                header: 'الوحدة',
                cell: (d) => (
                  <span className="font-mono text-xs">{getUnitCode(d)}</span>
                ),
              },
              {
                key: 'reference',
                header: 'المرجع',
                cell: (d) => {
                  if (d.contractId && d.contract) {
                    return (
                      <Link
                        href={`/dashboard/contracts/${d.contractId}`}
                        className="text-brand-600 hover:underline text-xs font-mono"
                      >
                        {d.contract.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                      </Link>
                    );
                  }
                  if (d.reservationId && d.reservation) {
                    return (
                      <Link
                        href={`/dashboard/reservations/${d.reservationId}`}
                        className="text-indigo-600 hover:underline text-xs font-mono"
                      >
                        {d.reservation.reservationNumber ?? `#${d.reservationId.slice(0, 8)}`}
                      </Link>
                    );
                  }
                  return <span className="text-slate-400 text-xs">—</span>;
                },
              },
              {
                key: 'dueDate',
                header: 'تاريخ الاستحقاق',
                cell: (d) => {
                  if (d.installment?.dueDate) {
                    return <span className="text-xs text-slate-600">{formatDate(d.installment.dueDate)}</span>;
                  }
                  if (d.type === 'BOOKING_AMOUNT' && d.reservation) {
                    const date = d.reservation.expiresAt ?? d.reservation.createdAt;
                    if (date) {
                      return (
                        <span
                          className="text-xs text-slate-600"
                          title={d.reservation.expiresAt ? 'موعد انتهاء الحجز' : 'مستحق عند الحجز'}
                        >
                          {formatDate(date)}
                        </span>
                      );
                    }
                  }
                  return <span className="text-xs text-slate-400">—</span>;
                },
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
                  <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} />
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
