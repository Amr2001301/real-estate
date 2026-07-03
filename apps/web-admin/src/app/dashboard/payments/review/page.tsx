import Link from 'next/link';
import { AlertCircle, ReceiptText } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PagedDeposits, Deposit } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { ApproveDepositButton, RejectDepositDialog } from './_actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'مراجعة إثباتات الدفع' };

// P11 — Standalone payment-proof review queue. Defaults to PENDING_REVIEW
// (the dedicated backend route also defaults there). We keep this surface
// distinct from /dashboard/deposits so finance reviewers always land on
// "what needs me right now" without remembering filter state.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدًا',
  BANK_TRANSFER: 'حوالة بنكية',
  CHEQUE: 'شيك',
  OTHER: 'أخرى',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function PaymentReviewQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const page = Math.max(1, Number(firstStr(sp.page)) || 1);
  const pageSize = 20;

  const queueUrl = `/deposits/review-queue?page=${page}&pageSize=${pageSize}`;
  const res = await safe(api.get<PagedDeposits>(queueUrl));

  if (res.error || !res.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="مراجعة إثباتات الدفع" description="إثباتات الدفع المرسلة من العملاء تنتظر اعتمادك." />
        <Card>
          <CardBody>
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4" />
              تعذّر تحميل قائمة المراجعة حاليًا. يُرجى المحاولة مرة أخرى بعد لحظات.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { data, meta } = res.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="مراجعة إثباتات الدفع"
        description="إثباتات الدفع المرسلة من العملاء بانتظار قرارك."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مراجعة إثباتات الدفع' },
        ]}
      />

      {data.length === 0 ? (
        <Card>
          <CardHeader><CardTitle>لا يوجد إثباتات قيد المراجعة</CardTitle></CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600">
              لا توجد إثباتات دفع جديدة بانتظار المراجعة. ستظهر هنا فور إرسالها من العملاء.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>قائمة المراجعة ({meta.total})</CardTitle></CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-right text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">العميل</th>
                    <th className="px-3 py-2">العقد / الوحدة</th>
                    <th className="px-3 py-2">المبلغ</th>
                    <th className="px-3 py-2">طريقة الدفع</th>
                    <th className="px-3 py-2">تاريخ الإرسال</th>
                    <th className="px-3 py-2">الإثبات</th>
                    <th className="px-3 py-2 text-end">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d: Deposit) => {
                    const contractId = d.contract?.id ?? null;
                    const customer = d.contract?.customer?.fullName ?? '—';
                    const unit = d.contract?.unit?.code ?? '—';
                    const contractNum = d.contract?.contractNumber ?? '—';
                    const method =
                      d.paymentMethod ? (PAYMENT_METHOD_LABELS[d.paymentMethod] ?? d.paymentMethod) : '—';
                    const proofDocId = d.proofDocument?.id ?? null;
                    return (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="px-3 py-3 font-medium text-slate-800">{customer}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {contractNum} <span className="text-slate-400">·</span> {unit}
                        </td>
                        <td className="px-3 py-3 tabular-nums font-semibold text-slate-800">
                          {formatCurrency(Number(d.amount), currency)}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{method}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(d.createdAt ?? d.paidAt)}</td>
                        <td className="px-3 py-3">
                          {proofDocId ? (
                            <Link
                              href={`/dashboard/documents/${proofDocId}`}
                              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                            >
                              <ReceiptText className="h-4 w-4" />
                              عرض الإثبات
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <ApproveDepositButton depositId={d.id} contractId={contractId} />
                            <RejectDepositDialog depositId={d.id} contractId={contractId} />
                            <Link
                              href={`/dashboard/deposits/${d.id}`}
                              className="inline-flex items-center text-xs text-slate-600 hover:underline"
                            >
                              التفاصيل
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                total={meta.total}
                basePath="/dashboard/payments/review"
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
