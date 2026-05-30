import Link from 'next/link';
import type { Route } from 'next';
import { Wallet, CheckCircle2, Clock, AlertCircle, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { MeDeposit, MeDepositReviewStatus, MePaymentMethod } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';

const TYPE_LABELS: Record<string, string> = {
  BOOKING_AMOUNT: 'دفعة حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة نهائية',
};

// P11 — customer-facing review status copy.
const REVIEW_STATUS_LABELS: Record<MeDepositReviewStatus, { label: string; tone: 'success' | 'accent' | 'muted' | 'error' }> = {
  NO_PROOF: { label: 'بدون إثبات', tone: 'muted' },
  PENDING_REVIEW: { label: 'بانتظار المراجعة', tone: 'accent' },
  APPROVED: { label: 'مدفوع — تم التحقق', tone: 'success' },
  REJECTED: { label: 'مرفوض', tone: 'error' },
};

const TONE_CLASS: Record<'success' | 'accent' | 'muted' | 'error', string> = {
  success: 'bg-success/10 text-success',
  accent: 'bg-gold-100 text-gold-600',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error',
};

const PAYMENT_METHOD_LABELS: Record<MePaymentMethod, string> = {
  CASH: 'نقدًا',
  BANK_TRANSFER: 'حوالة بنكية',
  CHEQUE: 'شيك',
  OTHER: 'أخرى',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function StatusBadge({ deposit }: { deposit: MeDeposit }) {
  // P11 — prefer the explicit reviewStatus when present; fall back to the
  // legacy `verified` boolean for rows untouched by the new workflow.
  const status: MeDepositReviewStatus =
    deposit.reviewStatus ?? (deposit.verified ? 'APPROVED' : 'PENDING_REVIEW');
  const { label, tone } = REVIEW_STATUS_LABELS[status];
  const icon =
    status === 'APPROVED' ? CheckCircle2 : status === 'REJECTED' ? AlertCircle : Clock;
  const Icon = icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function DepositCard({ deposit }: { deposit: MeDeposit }) {
  const typeLabel = TYPE_LABELS[deposit.type] ?? 'دفعة';
  const subtitleParts = [
    deposit.contract?.contractNumber ? `عقد رقم ${deposit.contract.contractNumber}` : '',
    deposit.installment?.dueDate ? `قسط مستحق ${formatDate(deposit.installment.dueDate)}` : '',
  ].filter(Boolean);

  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{typeLabel}</h3>
            {subtitleParts.length > 0 && (
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{subtitleParts.join(' · ')}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <div className="font-display text-lg font-bold text-ink-strong">{formatPrice(deposit.amount)}</div>
          <div className="mt-1">
            <StatusBadge deposit={deposit} />
          </div>
        </div>
      </div>

      {/* P11 — rejection reason banner + resubmit link. Surfaces only what
          admin wrote; internal notes never reach the customer. */}
      {deposit.reviewStatus === 'REJECTED' && (
        <div className="mt-3 space-y-2">
          {deposit.rejectionReason && (
            <div className="flex items-start gap-2 rounded-xl bg-error/5 border border-error/20 p-3 text-xs text-error">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">سبب رفض الإثبات</p>
                <p className="mt-0.5">{deposit.rejectionReason}</p>
              </div>
            </div>
          )}
          <Link
            href={
              {
                pathname: routes.accountDeposits,
                query: { resubmit: deposit.id, amount: deposit.amount },
              } as unknown as Route
            }
            className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-navy/90"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            إعادة إرسال الإثبات
          </Link>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs text-ink-muted">
        <span>
          تاريخ الدفع: {formatDate(deposit.paidAt)}
          {deposit.paymentMethod && (
            <span className="ms-2">· {PAYMENT_METHOD_LABELS[deposit.paymentMethod]}</span>
          )}
        </span>
        <DocumentDownloadByOwner
          ownerType="DEPOSIT"
          ownerId={deposit.id}
          label="تحميل الإيصال"
          emptyLabel="الإيصال غير متاح بعد"
          variant="inline"
        />
      </div>
    </PremiumCard>
  );
}
