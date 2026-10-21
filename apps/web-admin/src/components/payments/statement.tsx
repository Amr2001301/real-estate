import type { Locale } from '@/lib/locale';
import type { StatementLine } from '@/lib/types';
import { methodLabel } from './payment-state';

const ROW: Record<string, { ar: string; en: string }> = {
  BOOKING: { ar: 'مبلغ الحجز', en: 'booking amount' },
  BOOKING_AMOUNT: { ar: 'مبلغ الحجز', en: 'booking amount' },
  RESERVATION: { ar: 'مبلغ الحجز', en: 'booking amount' },
  DOWN_PAYMENT: { ar: 'الدفعة الأولى', en: 'down payment' },
  INSTALLMENT: { ar: 'قسط', en: 'installment' },
  FINAL_PAYMENT: { ar: 'الدفعة الأخيرة', en: 'final payment' },
  LATE_FEE: { ar: 'غرامة تأخير', en: 'late fee' },
  TRANSFER_FEE: { ar: 'رسوم تنازل', en: 'transfer fee' },
  BOUNCE_PENALTY: { ar: 'غرامة شيك مرتد', en: 'bounced cheque fee' },
  FEE: { ar: 'رسوم', en: 'fee' },
};

const row = (t: string | null, en: boolean) =>
  t && ROW[t] ? ROW[t]![en ? 'en' : 'ar'] : en ? 'payment' : 'دفعة';

/** What a statement line is, in words: «سداد قسط مستحق يوم … نقدًا». */
export function statementLineLabel(
  l: StatementLine,
  fmtDate: (d: string) => string,
  locale: Locale,
): string {
  const en = locale === 'en';
  const what = row(l.rowType, en);
  const due =
    l.rowDueDate &&
    (l.rowType === 'INSTALLMENT' || l.rowType === 'DOWN_PAYMENT' || l.rowType === 'FINAL_PAYMENT')
      ? en
        ? ` due ${fmtDate(l.rowDueDate)}`
        : ` مستحق يوم ${fmtDate(l.rowDueDate)}`
      : '';
  switch (l.kind) {
    case 'CONTRACT':
      return en ? 'Contract value' : 'قيمة العقد';
    case 'FEE':
      return en ? `Charge: ${what}` : what;
    case 'WAIVER':
      return en ? `Waived: ${what}` : `إعفاء من ${what}`;
    case 'REVERSAL':
      return en ? `Reversal of ${what}${due} payment` : `عكس سداد ${what}${due}`;
    case 'PAYMENT': {
      const how = methodLabel(l.method, locale);
      const base = en
        ? `Payment: ${what}${due}${how ? ` ${how}` : ''}`
        : `سداد ${what}${due}${how ? ` ${how}` : ''}`;
      if (!l.unrecorded) return base;
      return (
        base + (en ? ' (marked paid, no payment recorded)' : ' (مُعلَّم مدفوعًا بدون إيصال مسجّل)')
      );
    }
  }
}

/** The line's second row: why it was reversed, and by whom. */
export function statementLineNote(l: StatementLine, locale: Locale): string | null {
  if (l.kind !== 'REVERSAL') return null;
  const en = locale === 'en';
  const parts = [
    l.reason ? (en ? `Reason: ${l.reason}` : `السبب: ${l.reason}`) : null,
    l.by ? (en ? `By ${l.by}` : `بواسطة ${l.by}`) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
