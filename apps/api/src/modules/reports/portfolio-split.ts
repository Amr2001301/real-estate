import { InstallmentStatus, Prisma, PrismaClient, ReservationBookingPaymentStatus } from '@prisma/client';
import { BILLABLE_PLAN_WHERE, PAYMENT_ON_ITS_WAY, SURCHARGE_PAYMENT_TYPES } from '../installments/live-contract';

/**
 * Where the signed contracts' value stands today, on one base so the parts
 * add up to it: paid + awaiting confirmation + late + not due yet + not on a
 * schedule = their total (instalment markup included). One definition for
 * the dashboard and the financial report — they read different figures
 * ("late" from the stored status on one, past the due day on the other).
 *
 * `instWhere` scopes installments to the signed contracts (and any filter);
 * `signedContractWhere` the same contracts.
 */
export async function portfolioSplit(
  db: Pick<PrismaClient, 'contract' | 'installment' | 'reservation'>,
  opts: {
    signedContractWhere: Prisma.ContractWhereInput;
    instWhere: (extra: Prisma.InstallmentWhereInput) => Prisma.InstallmentWhereInput;
    today: Date;
  },
) {
  const { signedContractWhere, instWhere, today } = opts;
  const unpaid: Prisma.InstallmentWhereInput = {
    status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
    type: { notIn: SURCHARGE_PAYMENT_TYPES },
  };
  const [grossAgg, paidRowsAgg, paidBookingAgg, openAgg, awaitingAgg, lateAgg] = await Promise.all([
    db.contract.aggregate({ where: signedContractWhere, _sum: { totalAmount: true } }),
    db.installment.aggregate({
      where: instWhere({ status: InstallmentStatus.PAID, type: { notIn: SURCHARGE_PAYMENT_TYPES } }),
      _sum: { amount: true },
    }),
    db.reservation.aggregate({
      where: {
        contract: { is: signedContractWhere },
        bookingPaymentStatus: { in: [ReservationBookingPaymentStatus.PAID, ReservationBookingPaymentStatus.WAIVED] },
      },
      _sum: { bookingAmount: true },
    }),
    db.installment.aggregate({ where: instWhere(unpaid), _sum: { amount: true } }),
    // A proof under review or a cheque not cleared: the customer has paid.
    db.installment.aggregate({ where: instWhere({ ...unpaid, deposits: { some: PAYMENT_ON_ITS_WAY } }), _sum: { amount: true } }),
    // Late: past its due day in the company's time zone, nothing on its way
    // — whether or not the nightly sweep has marked it yet.
    db.installment.aggregate({
      where: instWhere({
        ...unpaid,
        plan: BILLABLE_PLAN_WHERE,
        deposits: { none: PAYMENT_ON_ITS_WAY },
        dueDate: { lt: today },
      }),
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const D = (v: Prisma.Decimal | number | null | undefined) => new Prisma.Decimal(v ?? 0);
  const zero = new Prisma.Decimal(0);
  const gross = D(grossAgg._sum.totalAmount);
  const open = D(openAgg._sum.amount);
  const awaiting = D(awaitingAgg._sum.amount);
  const late = D(lateAgg._sum.amount);
  const paid = D(paidRowsAgg._sum.amount).plus(D(paidBookingAgg._sum.bookingAmount));
  return {
    grossValue: gross,
    paid,
    awaiting,
    overdue: late,
    overdueCount: lateAgg._count?._all ?? 0,
    notYetDue: Prisma.Decimal.max(zero, open.minus(awaiting).minus(late)),
    unscheduled: Prisma.Decimal.max(zero, gross.minus(paid).minus(open)),
  };
}
