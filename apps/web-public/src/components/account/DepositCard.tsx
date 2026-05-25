import { Wallet, Download, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { MeDeposit } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';

const TYPE_LABELS: Record<string, string> = {
  BOOKING_AMOUNT: 'دفعة حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة نهائية',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        verified ? 'bg-success/10 text-success' : 'bg-gold-100 text-gold-600',
      )}
    >
      {verified ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
      {verified ? 'موثّق' : 'قيد المراجعة'}
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
            <VerifiedBadge verified={deposit.verified} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs text-ink-muted">
        <span>تاريخ الدفع: {formatDate(deposit.paidAt)}</span>
        {deposit.receiptUrl ? (
          <a
            href={deposit.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-gold-600 transition-colors hover:text-gold-500"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            تحميل الإيصال
          </a>
        ) : (
          <span className="text-ink-muted/70">الإيصال غير متاح بعد</span>
        )}
      </div>
    </PremiumCard>
  );
}
