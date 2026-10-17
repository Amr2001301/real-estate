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

/**
 * A contract's sale price in SQL: its total less the instalment markup
 * (decided 2026-10-17: "sales" and "contract value" are the net price, as the
 * commission base). The query must alias the contract `c` and join its
 * reservation: LEFT JOIN "Reservation" r ON r.id = c."reservationId".
 */
export const NET_PRICE_SQL = Prisma.sql`(c."totalAmount" - GREATEST(COALESCE(r."snapshotFinancedAmount" - r."snapshotRemainingAmount", 0), 0))`;

type NetValueDb = Pick<Prisma.TransactionClient, 'contract' | 'reservation'>;

/** The net price (total less markup) of the contracts `where` selects. */
export async function netContractValue(db: NetValueDb, where: Prisma.ContractWhereInput): Promise<number> {
  const [total, markup] = await Promise.all([
    db.contract.aggregate({ where, _sum: { totalAmount: true } }),
    db.reservation.aggregate({
      where: { contract: { is: where }, snapshotFinancedAmount: { not: null }, snapshotRemainingAmount: { not: null } },
      _sum: { snapshotFinancedAmount: true, snapshotRemainingAmount: true },
    }),
  ]);
  const added = Number(markup._sum.snapshotFinancedAmount ?? 0) - Number(markup._sum.snapshotRemainingAmount ?? 0);
  return Number(total._sum.totalAmount ?? 0) - Math.max(0, added);
}
