import Link from 'next/link';
import { ArrowLeft, ReceiptText, Building2, Bookmark, CalendarClock } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Deposit, DepositType } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { VerifyToggle } from '../verify-toggle';

export const dynamic = 'force-dynamic';

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

export default async function DepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  const res = await safe(api.get<Deposit>(`/deposits/${id}`));
  const d = res.data;

  if (!d) {
    return (
      <div className="space-y-5">
        <PageHeader title="تفاصيل الدفعة" breadcrumbs={[{ label: 'الدفعات', href: '/dashboard/deposits' }, { label: 'التفاصيل' }]} />
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          تعذّر تحميل الدفعة: {res.error ?? 'غير موجودة'}
        </div>
      </div>
    );
  }

  const customerName =
    d.contract?.customer?.fullName ?? d.reservation?.client?.fullName ?? d.reservation?.lead?.fullName ?? '—';
  const unitCode = d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';

  return (
    <div className="space-y-5">
      <PageHeader
        title="تفاصيل الدفعة"
        description={`رقم الدفعة: ${d.id.slice(0, 8).toUpperCase()}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات', href: '/dashboard/deposits' },
          { label: 'التفاصيل' },
        ]}
        actions={
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              d.verified ? 'bg-success-100 text-success-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {d.verified ? 'متحقق' : 'غير متحقق'}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">تفاصيل الدفعة</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="النوع" value={DEPOSIT_TYPE_LABELS[d.type] ?? d.type} />
              <Field label="المبلغ" value={formatCurrency(d.amount)} />
              <Field label="تاريخ الدفع" value={formatDate(d.paidAt)} />
              <Field label="تاريخ التسجيل" value={formatDateTime(d.createdAt)} />
              <Field label="العميل" value={customerName} />
              <Field label="الوحدة" value={unitCode} ltr />
            </div>
            <div className="pt-2 border-t border-hairline flex flex-wrap items-center gap-3">
              {d.contractId && (
                <Link href={`/dashboard/contracts/${d.contractId}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> العقد {d.contract?.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                </Link>
              )}
              {d.reservationId && (
                <Link href={`/dashboard/reservations/${d.reservationId}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 inline-flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5" /> الحجز {d.reservation?.reservationNumber ?? `#${d.reservationId.slice(0, 8)}`}
                </Link>
              )}
              {d.installment?.dueDate && (
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> استحقاق القسط: {formatDate(d.installment.dueDate)}
                </span>
              )}
            </div>
            {isAdmin && (
              <div className="pt-2 border-t border-hairline flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">حالة التحقق:</span>
                <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Documents / receipts */}
        <div className="lg:col-span-1 space-y-1.5">
          <p className="text-[11px] text-slate-400 px-1">
            ارفع إيصال الدفع أو إثبات التحويل وربطه بهذه الدفعة.
          </p>
          <OwnerDocumentsCard
            ownerType="DEPOSIT"
            ownerId={d.id}
            title="مستندات وإيصالات الدفعة"
            legacy={d.receiptUrl ? [{ label: 'إيصال الدفع', href: d.receiptUrl, hint: 'إيصال محفوظ كرابط' }] : undefined}
          />
        </div>
      </div>

      <Link
        href="/dashboard/deposits"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        العودة إلى سجل الدفعات
      </Link>
    </div>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700" dir={ltr ? 'ltr' : undefined}>{value}</p>
    </div>
  );
}
