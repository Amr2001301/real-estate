/**
 * seed-schedule.ts — a contract's payment schedule for the demo seeds, built
 * the way the API builds it so the money adds up in every report:
 *
 *   totalAmount = booking (on the reservation) + down payment row + monthly rows
 *
 * The monthly rows share what is left; the last one takes the piasters the
 * split leaves over. Rows due before `paidBefore` are PAID with an approved
 * deposit on the row (the down payment is paid on signing); the rest are
 * PENDING, or OVERDUE when their due day has passed.
 */
import { DepositReviewStatus, DepositType, InstallmentStatus, PaymentMethod, PlanPaymentType, PrismaClient } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;

function monthsFrom(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Splits `amount` (piasters kept exact) into `n` rows; the last takes the remainder. */
export function splitRows(amount: number, n: number): number[] {
  const piasters = Math.round(amount * 100);
  const each = Math.floor(piasters / n);
  const rows = Array.from({ length: n }, () => each / 100);
  rows[n - 1] = (piasters - each * (n - 1)) / 100;
  return rows;
}

export async function seedSchedule(
  prisma: PrismaClient,
  opts: {
    companyId: string;
    contractId: string;
    recordedById: string;
    totalAmount: number;
    /** Booking paid on the reservation (counts towards the price), 0 if none. */
    booking: number;
    downPayment: number;
    months: number;
    signedAt: Date;
    /** Rows due before this are paid. Defaults to now (everything due is paid). */
    paidBefore?: Date;
    /** Not signed yet: nothing is late before signing. */
    unsigned?: boolean;
  },
): Promise<{ paidRows: number }> {
  const { companyId, contractId, recordedById, signedAt, months } = opts;
  const financed = opts.totalAmount - opts.booking - opts.downPayment;
  if (financed <= 0) throw new Error(`Contract ${contractId}: booking + down payment exceed the total`);
  const monthly = splitRows(financed, months);
  const startsAt = monthsFrom(signedAt, 1);
  const paidBefore = (opts.paidBefore ?? new Date()).getTime();
  const now = Date.now();

  const plan = await prisma.installmentPlan.create({
    data: { companyId, contractId, totalMonths: months, monthlyAmount: monthly[0], startsAt, createdAt: signedAt },
    select: { id: true },
  });

  const rows: Array<{ type: PlanPaymentType; dueDate: Date; amount: number; depositType: DepositType }> = [
    { type: PlanPaymentType.DOWN_PAYMENT, dueDate: signedAt, amount: opts.downPayment, depositType: DepositType.DOWN_PAYMENT },
    ...monthly.map((amount, i) => ({
      type: PlanPaymentType.INSTALLMENT,
      dueDate: monthsFrom(startsAt, i),
      amount,
      depositType: DepositType.INSTALLMENT,
    })),
  ];

  let paidRows = 0;
  for (const [i, row] of rows.entries()) {
    const paid = row.dueDate.getTime() <= paidBefore;
    const paidAt = new Date(Math.min(row.dueDate.getTime() + (i === 0 ? 0 : 2 * DAY), now));
    const inst = await prisma.installment.create({
      data: {
        companyId,
        planId: plan.id,
        type: row.type,
        dueDate: row.dueDate,
        amount: row.amount,
        status: paid
          ? InstallmentStatus.PAID
          : !opts.unsigned && row.dueDate.getTime() < now
            ? InstallmentStatus.OVERDUE
            : InstallmentStatus.PENDING,
        paidAt: paid ? paidAt : undefined,
      },
      select: { id: true },
    });
    if (!paid) continue;
    paidRows++;
    await prisma.deposit.create({
      data: {
        companyId,
        type: row.depositType,
        contractId,
        installmentId: inst.id,
        amount: row.amount,
        paidAt,
        paymentMethod: i % 2 ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
        recordedById,
        verified: true,
        reviewStatus: DepositReviewStatus.APPROVED,
        reviewedAt: paidAt,
        reviewedById: recordedById,
      },
    });
  }
  return { paidRows };
}

/** The deposit behind a booking marked PAID (the API never marks it paid without one). */
export async function seedBookingDeposit(
  prisma: PrismaClient,
  opts: { companyId: string; reservationId: string; amount: number; paidAt: Date; recordedById: string },
): Promise<void> {
  await prisma.deposit.create({
    data: {
      companyId: opts.companyId,
      type: DepositType.BOOKING_AMOUNT,
      reservationId: opts.reservationId,
      amount: opts.amount,
      paidAt: opts.paidAt,
      paymentMethod: PaymentMethod.CASH,
      recordedById: opts.recordedById,
      verified: true,
      reviewStatus: DepositReviewStatus.APPROVED,
      reviewedAt: opts.paidAt,
      reviewedById: opts.recordedById,
    },
  });
}
