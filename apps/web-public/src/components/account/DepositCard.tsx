import Link from 'next/link';
import type { Route } from 'next';
import { Wallet, CheckCircle2, Clock, AlertCircle, Upload, Landmark } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { MeDeposit, MeDepositReviewStatus, MePaymentMethod } from '@/lib/api-types';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { AccountCard, type AccountCardAccent } from '@/components/account/AccountCard';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';

const TONE_CLASS: Record<'success' | 'accent' | 'muted' | 'error', string> = {
  success: 'bg-success/10 text-success ring-1 ring-success/20',
  accent: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error ring-1 ring-error/20',
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export async function DepositCard({ deposit }: { deposit: MeDeposit }) {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.deposits;

  const TYPE_LABELS: Record<string, string> = {
    BOOKING_AMOUNT: m.typeBooking,
    DOWN_PAYMENT: m.typeDown,
    INSTALLMENT: m.typeInstallment,
    FINAL_PAYMENT: m.typeFinal,
  };

  const REVIEW_STATUS_LABELS: Record<MeDepositReviewStatus, { label: string; tone: 'success' | 'accent' | 'muted' | 'error' }> = {
    NO_PROOF: { label: m.statusNoProof, tone: 'muted' },
    PENDING_REVIEW: { label: m.statusPendingReview, tone: 'accent' },
    APPROVED: { label: m.statusApproved, tone: 'success' },
    REJECTED: { label: m.statusRejected, tone: 'error' },
  };

  const PAYMENT_METHOD_LABELS: Record<MePaymentMethod, string> = {
    CASH: m.methodCash,
    BANK_TRANSFER: m.methodTransfer,
    CHEQUE: m.methodCheque,
    OTHER: m.methodOther,
  };

  const typeLabel = TYPE_LABELS[deposit.type] ?? m.typeGeneric;
  const status: MeDepositReviewStatus =
    deposit.reviewStatus ?? (deposit.verified ? 'APPROVED' : 'PENDING_REVIEW');
  const { label, tone } = REVIEW_STATUS_LABELS[status];
  const StatusIcon = status === 'APPROVED' ? CheckCircle2 : status === 'REJECTED' ? AlertCircle : Clock;
  const accent: AccountCardAccent =
    status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : status === 'NO_PROOF' ? 'muted' : 'gold';

  return (
    <AccountCard accent={accent} className="p-5 sm:p-6">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-4">
        {/* Block 1 (right) — amount + verification */}
        <div className="min-w-0">
          <div className="text-base font-black text-ink-strong" dir="auto">
            {formatPrice(deposit.amount)}
          </div>
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold',
              TONE_CLASS[tone],
            )}
          >
            <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
            {label}
          </span>
        </div>

        {/* Block 2 — type + contract binding */}
        <div className="min-w-0 space-y-1 md:border-s md:border-hairline/70 md:ps-6">
          <div className="flex items-center gap-1.5 text-sm font-bold text-ink-strong">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
            {typeLabel}
          </div>
          {deposit.contract?.contractNumber && (
            <span className="inline-block rounded-md bg-surface-soft px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
              {m.contractPrefix} {deposit.contract.contractNumber}
            </span>
          )}
        </div>

        {/* Block 3 — method + timeline */}
        <div className="min-w-0 md:border-s md:border-hairline/70 md:ps-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Landmark className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
            {deposit.paymentMethod ? PAYMENT_METHOD_LABELS[deposit.paymentMethod] : '—'}
          </div>
          <div className="mt-1 text-[11px] text-ink-muted" dir="auto">
            {m.paidAtLabel} {formatDate(deposit.paidAt, locale)}
          </div>
        </div>

        {/* Block 4 (far left) — download receipt */}
        <div className="flex md:justify-end md:border-s md:border-hairline/70 md:ps-6">
          <DocumentDownloadByOwner
            ownerType="DEPOSIT"
            ownerId={deposit.id}
            label={m.downloadReceipt}
            emptyLabel={m.receiptUnavailable}
            variant="compact"
          />
        </div>
      </div>

      {/* P11 — rejection reason banner + resubmit (full width below the grid). */}
      {deposit.reviewStatus === 'REJECTED' && (
        <div className="mt-4 space-y-2 border-t border-hairline/70 pt-4">
          {deposit.rejectionReason && (
            <div className="flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">{m.rejectionTitle}</p>
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-700"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {m.resubmit}
          </Link>
        </div>
      )}
    </AccountCard>
  );
}
