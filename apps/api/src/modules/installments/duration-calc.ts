/**
 * Single source of truth for installment-plan duration calculations.
 *
 * Formula:
 *   remainingAmount     = netPrice - reservationAmount - downPaymentAmount
 *   financedAmount      = remainingAmount * (1 + increasePercentage / 100)
 *   monthlyInstallment  = financedAmount / durationMonths
 *   totalPayable        = reservationAmount + downPaymentAmount + financedAmount
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
}

export interface DurationCalcResult {
  remainingAmount: number;
  financedAmount: number;
  monthlyInstallment: number;
  totalPayable: number;
}

export function computeDurationOption(input: DurationCalcInput): DurationCalcResult {
  const remainingAmount = Math.max(
    0,
    input.netPrice - input.reservationAmount - input.downPaymentAmount,
  );
  const financedAmount = remainingAmount * (1 + input.increasePercentage / 100);
  const monthlyInstallment =
    input.durationMonths > 0 ? financedAmount / input.durationMonths : 0;
  const totalPayable =
    input.reservationAmount + input.downPaymentAmount + financedAmount;
  return { remainingAmount, financedAmount, monthlyInstallment, totalPayable };
}
