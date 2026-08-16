import Link from 'next/link';
import { ArrowLeft, ReceiptText, Building2, Bookmark, CalendarClock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Deposit, DepositType } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { OwnerDocumentsCard } from '@/components/documents/owner-documents-card';
import { VerifyToggle } from '../verify-toggle';
import { PrintButton } from '@/components/print/PrintButton';
import {
  ApproveDepositButton,
  RejectDepositDialog,
} from '../../payments/review/_actions';

export const dynamic = 'force-dynamic';

export default async function DepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [currency, locale, session] = await Promise.all([
    getReportsCurrency(),
    getLocale(),
    getSession(),
  ]);
  const m = uiT(locale).pages.depositsDetail;
  const isAdmin = session?.role === 'ADMIN';

  const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
    BOOKING_AMOUNT: m.typeBOOKING_AMOUNT,
    DOWN_PAYMENT:   m.typeDOWN_PAYMENT,
    INSTALLMENT:    m.typeINSTALLMENT,
    FINAL_PAYMENT:  m.typeFINAL_PAYMENT,
  };

  const REVIEW_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    NO_PROOF:       { label: m.reviewNO_PROOF,       cls: 'bg-slate-100 text-slate-600' },
    PENDING_REVIEW: { label: m.reviewPENDING_REVIEW, cls: 'bg-amber-100 text-amber-700' },
    APPROVED:       { label: m.reviewAPPROVED,       cls: 'bg-success-100 text-success-700' },
    REJECTED:       { label: m.reviewREJECTED,       cls: 'bg-danger-100 text-danger-700' },
  };

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH:          m.methodCASH,
    BANK_TRANSFER: m.methodBANK_TRANSFER,
    CHEQUE:        m.methodCHEQUE,
    OTHER:         m.methodOTHER,
  };

  const res = await safe(api.get<Deposit>(`/deposits/${id}`));
  const d = res.data;

  if (!d) {
    return (
      <div className="space-y-5">
        <PageHeader title={m.pageTitle} breadcrumbs={[{ label: m.breadcrumbDeposits, href: '/dashboard/deposits' }, { label: m.breadcrumbDetail }]} />
        <div className="rounded-xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {m.errorLoad}{res.error ?? m.errorNotFound}
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
        title={m.pageTitle}
        description={m.pageDesc(d.id.slice(0, 8).toUpperCase())}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbDeposits, href: '/dashboard/deposits' },
          { label: m.breadcrumbDetail },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PrintButton path="deposits" id={d.id} />
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                d.verified ? 'bg-success-100 text-success-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {d.verified ? `✓ ${uiT(locale).pages.deposits.verifiedBadge}` : uiT(locale).pages.deposits.notVerifiedBadge}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">{m.sectionTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label={m.fieldType}      value={DEPOSIT_TYPE_LABELS[d.type] ?? d.type} />
              <Field label={m.fieldAmount}    value={formatCurrency(d.amount, currency)} />
              <Field label={m.fieldPaidAt}    value={formatDate(d.paidAt)} />
              <Field label={m.fieldCreatedAt} value={formatDateTime(d.createdAt)} />
              <Field label={m.fieldCustomer}  value={customerName} />
              <Field label={m.fieldUnit}      value={unitCode} ltr />
            </div>
            <div className="pt-2 border-t border-hairline flex flex-wrap items-center gap-3">
              {d.contractId && (
                <Link href={`/dashboard/contracts/${d.contractId}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {d.contract?.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                </Link>
              )}
              {d.reservationId && (
                <Link href={`/dashboard/reservations/${d.reservationId}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 inline-flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5" /> {d.reservation?.reservationNumber ?? `#${d.reservationId.slice(0, 8)}`}
                </Link>
              )}
              {d.installment?.dueDate && (
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> {m.fieldInstallmentDue}{formatDate(d.installment.dueDate)}
                </span>
              )}
            </div>
            {d.reviewStatus && d.reviewStatus !== 'NO_PROOF' && (
              <div className="pt-2 border-t border-hairline space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">{m.reviewStatusLabel}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${REVIEW_STATUS_LABELS[d.reviewStatus]?.cls ?? ''}`}
                  >
                    {REVIEW_STATUS_LABELS[d.reviewStatus]?.label ?? d.reviewStatus}
                  </span>
                  {d.paymentMethod && (
                    <span className="text-xs text-slate-500">
                      {m.reviewMethodLabel}{PAYMENT_METHOD_LABELS[d.paymentMethod] ?? d.paymentMethod}
                    </span>
                  )}
                  {d.reviewedAt && d.reviewedBy?.fullName && (
                    <span className="text-xs text-slate-500">
                      {m.reviewedByLabel}{d.reviewedBy.fullName} — {formatDateTime(d.reviewedAt)}
                    </span>
                  )}
                </div>
                {d.reviewStatus === 'REJECTED' && d.rejectionReason && (
                  <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 p-2.5 text-xs text-danger-700">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{m.rejectionReasonTitle}</p>
                      <p className="mt-0.5">{d.rejectionReason}</p>
                    </div>
                  </div>
                )}
                {d.reviewStatus === 'APPROVED' && (
                  <p className="flex items-center gap-1.5 text-xs text-success-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {m.approvedNote}
                  </p>
                )}
                {isAdmin && d.reviewStatus === 'PENDING_REVIEW' && (
                  <div className="flex items-center gap-2 pt-1">
                    <ApproveDepositButton depositId={d.id} contractId={d.contractId ?? null} />
                    <RejectDepositDialog depositId={d.id} contractId={d.contractId ?? null} />
                  </div>
                )}
              </div>
            )}
            {isAdmin && (!d.reviewStatus || d.reviewStatus === 'NO_PROOF') && (
              <div className="pt-2 border-t border-hairline flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">{m.verifyStatusLabel}</span>
                <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} locale={locale} />
              </div>
            )}
          </CardBody>
        </Card>

        <div className="lg:col-span-1 space-y-1.5">
          <p className="text-[11px] text-slate-400 px-1">
            {m.docsHint}
          </p>
          <OwnerDocumentsCard
            ownerType="DEPOSIT"
            ownerId={d.id}
            title={m.docsTitle}
            legacy={d.receiptUrl ? [{ label: m.docsLegacyLabel, href: d.receiptUrl, hint: m.docsLegacyHint }] : undefined}
          />
        </div>
      </div>

      <Link
        href="/dashboard/deposits"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        {m.backLink}
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
