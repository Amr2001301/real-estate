/**
 * BRK-5 — what a developer's payment plan comes to on a given price, so plans
 * from different developers can be compared side by side. Pure: the service,
 * the dashboard's comparison and the tests read the same arithmetic.
 */
import { PlanFrequency } from '@prisma/client';

const r2 = (n: number) => Math.round(n * 100) / 100;

export const PERIODS_PER_YEAR: Record<PlanFrequency, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  ANNUAL: 1,
};

export interface PlanTerms {
  downPaymentPct: number;
  years: number;
  frequency: PlanFrequency;
  deliveryPct: number;
  cashDiscountPct: number;
}

export interface PlanBreakdown {
  /** The price after a cash discount (cash plans only). */
  total: number;
  downPayment: number;
  deliveryPayment: number;
  installments: number;
  installment: number;
  /** The instalment spread per month, to compare plans with different frequencies. */
  monthly: number;
  cash: boolean;
}

export function planBreakdown(price: number, p: PlanTerms): PlanBreakdown {
  if (p.years <= 0) {
    const total = r2(price * (1 - p.cashDiscountPct / 100));
    return {
      total,
      downPayment: total,
      deliveryPayment: 0,
      installments: 0,
      installment: 0,
      monthly: 0,
      cash: true,
    };
  }
  const downPayment = r2((price * p.downPaymentPct) / 100);
  const deliveryPayment = r2((price * p.deliveryPct) / 100);
  const installments = p.years * PERIODS_PER_YEAR[p.frequency];
  const rest = Math.max(0, price - downPayment - deliveryPayment);
  const installment = r2(rest / installments);
  return {
    total: r2(price),
    downPayment,
    deliveryPayment,
    installments,
    installment,
    monthly: r2(installment / (12 / PERIODS_PER_YEAR[p.frequency])),
    cash: false,
  };
}

/** A plan's shares must leave something to pay in instalments (or be cash). */
export function planProblem(p: PlanTerms): string | null {
  if (p.years > 0 && p.downPaymentPct + p.deliveryPct >= 100)
    return 'المقدّم مع دفعة الاستلام لا يتجاوزان 100%';
  if (p.years <= 0 && (p.downPaymentPct !== 100 || p.deliveryPct !== 0))
    return 'الخطة الكاش تُدفع كلها مقدّمًا (100%)';
  return null;
}
