/**
 * Mirror of apps/api/src/modules/installments/duration-calc.ts.
 * Keep both files in sync — same formula, identical behavior.
 */

export interface DurationCalcInput {
  netPrice: number;
  reservationAmount: number;
  downPaymentAmount: number;
  durationMonths: number;
  increasePercentage: number;
  /** A big payment every few months beside the monthly one; absent = an ordinary plan. */
  balloon?: BalloonTerms | null;
}

export interface BalloonTerms {
  /** Share of the financed amount paid in the big payments, 1–100. */
  sharePct: number;
  /** Months between two big payments: 3, 6 or 12. */
  everyMonths: number;
}

export interface DurationCalcResult {
  remainingAmount: number;
  financedAmount: number;
  /** The monthly instalment — the small one on a balloon plan. */
  monthlyInstallment: number;
  totalPayable: number;
  /** Balloon plan: each big payment (0 when none), how many, how far apart. */
  balloonAmount: number;
  balloonCount: number;
  balloonEveryMonths: number;
}

/** True when the big payments split this duration into whole periods. */
export function balloonFits(b: BalloonTerms | null | undefined, months: number): b is BalloonTerms {
  return !!b && b.sharePct > 0 && b.sharePct <= 100 && [3, 6, 12].includes(b.everyMonths) && months > 0 && months % b.everyMonths === 0;
}

export function computeDurationOption(input: DurationCalcInput): DurationCalcResult {
  const remainingAmount = Math.max(
    0,
    input.netPrice - input.reservationAmount - input.downPaymentAmount,
  );
  const financedAmount = remainingAmount * (1 + input.increasePercentage / 100);
  const months = input.durationMonths;
  // Same split as the API: the big payments are equal (whole cents), the
  // rest is paid monthly.
  const balloon = balloonFits(input.balloon, months) ? input.balloon : null;
  const balloonCount = balloon ? months / balloon.everyMonths : 0;
  const balloonAmount = balloon
    ? Math.floor(Math.round(financedAmount * balloon.sharePct) / balloonCount) / 100
    : 0;
  const monthlyInstallment = months > 0 ? (financedAmount - balloonAmount * balloonCount) / months : 0;
  const totalPayable =
    input.reservationAmount + input.downPaymentAmount + financedAmount;
  return {
    remainingAmount,
    financedAmount,
    monthlyInstallment,
    totalPayable,
    balloonAmount,
    balloonCount,
    balloonEveryMonths: balloon ? balloon.everyMonths : 0,
  };
}

/** Resolve down payment value (FIXED or PERCENTAGE) to a number. */
export function resolveDownPaymentAmount(
  type: 'FIXED' | 'PERCENTAGE',
  value: number,
  netPrice: number,
): number {
  if (type === 'PERCENTAGE') return (netPrice * value) / 100;
  return value;
}
