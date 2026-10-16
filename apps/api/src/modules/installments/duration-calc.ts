/**
 * Single source of truth for installment-plan duration calculations.
 *
 * Formula:
 *   remainingAmount     = netPrice - reservationAmount - downPaymentAmount - finalPaymentAmount
 *   financedAmount      = remainingAmount * (1 + increasePercentage / 100)
 *   monthlyInstallment  = financedAmount / durationMonths, rounded down to the cent
 *   lastInstallment     = financedAmount - monthlyInstallment * (durationMonths - 1)
 *   totalPayable        = reservationAmount + downPaymentAmount + financedAmount + finalPaymentAmount
 *
 * The final (balloon) payment is its own row on the schedule, so it is taken
 * out before the monthly split — leaving it in billed it twice. Money is
 * worked in cents: the monthly rows are equal and the last one carries the
 * rounding, so the schedule always adds up to totalPayable exactly.
 *
 * Inputs are accepted as plain numbers; callers are responsible for
 * converting Prisma Decimal to number before passing in.
 */

export interface DurationCalcInput {
  netPrice: number;
  reservationAmount: number;
  downPaymentAmount: number;
  durationMonths: number;
  increasePercentage: number;
  /** The balloon payment due after the last month; 0 or absent when none. */
  finalPaymentAmount?: number;
}

export interface DurationCalcResult {
  remainingAmount: number;
  financedAmount: number;
  monthlyInstallment: number;
  /** The last monthly row: the monthly amount plus the rounding remainder. */
  lastInstallment: number;
  finalPaymentAmount: number;
  totalPayable: number;
}

const toCents = (n: number) => Math.round(n * 100);

export function computeDurationOption(input: DurationCalcInput): DurationCalcResult {
  const reservation = toCents(input.reservationAmount);
  const down = toCents(input.downPaymentAmount);
  const final = toCents(input.finalPaymentAmount ?? 0);
  const remaining = Math.max(0, toCents(input.netPrice) - reservation - down - final);
  const financed = Math.round(remaining * (1 + input.increasePercentage / 100));
  const months = input.durationMonths;
  const monthly = months > 0 ? Math.floor(financed / months) : 0;
  const last = months > 0 ? financed - monthly * (months - 1) : 0;
  return {
    remainingAmount: remaining / 100,
    financedAmount: financed / 100,
    monthlyInstallment: monthly / 100,
    lastInstallment: last / 100,
    finalPaymentAmount: final / 100,
    totalPayable: (reservation + down + financed + final) / 100,
  };
}
