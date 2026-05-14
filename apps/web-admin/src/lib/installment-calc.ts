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

/** Resolve down payment value (FIXED or PERCENTAGE) to a number. */
export function resolveDownPaymentAmount(
  type: 'FIXED' | 'PERCENTAGE',
  value: number,
  netPrice: number,
): number {
  if (type === 'PERCENTAGE') return (netPrice * value) / 100;
  return value;
}
