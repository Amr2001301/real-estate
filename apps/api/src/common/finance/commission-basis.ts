import { Prisma } from '@prisma/client';

/** The reservation snapshot fields that carry the instalment markup. */
export const MARKUP_SNAPSHOT_SELECT = {
  snapshotFinancedAmount: true,
  snapshotRemainingAmount: true,
} as const;

type MarkupSnapshot = {
  snapshotFinancedAmount: Prisma.Decimal | null;
  snapshotRemainingAmount: Prisma.Decimal | null;
} | null;

/**
 * What the chosen instalment duration added on top of the price: the
 * financed amount less the amount it finances (decided at reservation, fixed
 * afterwards). Zero for a cash deal or a contract without a reservation.
 */
export function financingMarkup(reservation: MarkupSnapshot | undefined): Prisma.Decimal {
  const financed = reservation?.snapshotFinancedAmount;
  const remaining = reservation?.snapshotRemainingAmount;
  if (financed == null || remaining == null) return new Prisma.Decimal(0);
  const markup = new Prisma.Decimal(financed).sub(remaining);
  return markup.isNegative() ? new Prisma.Decimal(0) : markup;
}

/**
 * The amount broker commissions and sales bonuses are computed on (decided
 * 2026-10-16): the sale price after any discount, without the instalment
 * markup. contract.totalAmount is what the customer pays in all — price plus
 * markup; a price change or a unit swap moves it, the markup stays.
 */
export function commissionBasis(
  totalAmount: Prisma.Decimal | number,
  reservation: MarkupSnapshot | undefined,
): Prisma.Decimal {
  const basis = new Prisma.Decimal(totalAmount).sub(financingMarkup(reservation));
  return basis.isNegative() ? new Prisma.Decimal(0) : basis.toDecimalPlaces(2);
}
