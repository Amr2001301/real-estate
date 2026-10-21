import type { DepositState, RowPayment } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';

/**
 * Labels for a payment's state. Replaces "متحقق / غير متحقق": that flag read
 * "unverified" on cash staff recorded (collected) and "verified" on a cheque
 * that later bounced.
 */
const LABELS: Record<DepositState, { ar: string; en: string; cls: string; dot: string }> = {
  COLLECTED: { ar: 'تم التحصيل', en: 'Collected', cls: 'bg-emerald-500/12 text-emerald-600', dot: 'bg-emerald-500' },
  PENDING_REVIEW: { ar: 'إيصال بانتظار مراجعتك', en: 'Proof awaiting review', cls: 'bg-amber-500/12 text-amber-600', dot: 'bg-amber-500' },
  CHEQUE_PENDING: { ar: 'شيك لم يُصرف بعد', en: 'Cheque not cleared', cls: 'bg-sky-500/12 text-sky-600', dot: 'bg-sky-500' },
  REJECTED: { ar: 'إيصال مرفوض', en: 'Proof rejected', cls: 'bg-danger-500/12 text-danger-600', dot: 'bg-danger-500' },
  BOUNCED: { ar: 'شيك مرتد', en: 'Cheque bounced', cls: 'bg-danger-500/12 text-danger-600', dot: 'bg-danger-500' },
  REVERSED: { ar: 'دفعة معكوسة', en: 'Reversed', cls: 'bg-slate-500/12 text-slate-600', dot: 'bg-slate-400' },
  DELETED: { ar: 'محذوفة', en: 'Deleted', cls: 'bg-slate-500/10 text-slate-400', dot: 'bg-slate-400' },
};

const METHODS: Record<string, { ar: string; en: string }> = {
  CASH: { ar: 'نقدًا', en: 'in cash' },
  BANK_TRANSFER: { ar: 'بتحويل بنكي', en: 'by bank transfer' },
  CHEQUE: { ar: 'بشيك', en: 'by cheque' },
  OTHER: { ar: '', en: '' },
};

export function depositStateLabel(state: DepositState, locale: Locale = 'ar'): string {
  return LABELS[state][locale === 'en' ? 'en' : 'ar'];
}

export function methodLabel(method: string | null | undefined, locale: Locale = 'ar'): string {
  if (!method) return '';
  return METHODS[method]?.[locale === 'en' ? 'en' : 'ar'] ?? '';
}

export function DepositStateChip({
  state,
  locale = 'ar',
  className,
}: {
  state: DepositState | undefined;
  locale?: Locale;
  className?: string;
}) {
  const s = LABELS[state ?? 'COLLECTED'];
  return (
    <span
      data-testid="deposit-state"
      data-state={state ?? 'COLLECTED'}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
        s.cls,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {locale === 'en' ? s.en : s.ar}
    </span>
  );
}

/** One line under a schedule row's status: how it was paid, or what is waiting. */
export function rowPaymentNote(
  status: string,
  p: RowPayment | null | undefined,
  fmtDate: (d: string) => string,
  locale: Locale = 'ar',
): string | null {
  if (!p) return null;
  const en = locale === 'en';
  if (status === 'PAID' && p.state === 'COLLECTED') {
    const how = methodLabel(p.method, locale);
    return en ? `Paid ${how} on ${fmtDate(p.paidAt)}`.replace('  ', ' ') : `دُفع ${how} يوم ${fmtDate(p.paidAt)}`.replace('  ', ' ');
  }
  if (p.state === 'PENDING_REVIEW') return en ? `Customer sent a proof on ${fmtDate(p.paidAt)}` : `العميل أرسل إيصالًا يوم ${fmtDate(p.paidAt)}`;
  if (p.state === 'CHEQUE_PENDING') return en ? 'Cheque received, not cleared yet' : 'استُلم شيك ولم يُصرف بعد';
  if (p.state === 'REVERSED')
    return en
      ? `A payment was reversed${p.reversedAt ? ` on ${fmtDate(p.reversedAt)}` : ''} — open again`
      : `عُكست دفعة${p.reversedAt ? ` يوم ${fmtDate(p.reversedAt)}` : ''} — القسط مفتوح مجددًا`;
  if (p.state === 'BOUNCED') return en ? 'Cheque bounced — open again' : 'ارتد الشيك — القسط مفتوح مجددًا';
  if (p.state === 'REJECTED') return en ? 'Last proof was rejected' : 'رُفض آخر إيصال';
  return null;
}
