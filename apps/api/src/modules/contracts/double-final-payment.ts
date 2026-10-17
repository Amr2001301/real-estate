import { InstallmentStatus, PlanPaymentType, Prisma, PrismaClient } from '@prisma/client';
import { UNCLEARED_INSTRUMENT_STATUSES } from '../deposits/review-queue';
import { SURCHARGE_PAYMENT_TYPES } from '../installments/live-contract';
import { rescaleUnpaid } from './rescale-unpaid';

/**
 * Contracts converted before #83 bill the final (balloon) payment twice: it
 * was left inside the monthly split and also added as its own row, so the
 * schedule (booking + its payments) adds up to more than the contract price.
 * The price is right; the schedule is not.
 *
 * The fix takes the excess off the unpaid monthly installments, in proportion
 * to their amounts (the same arithmetic as a price change), so the schedule
 * adds up to the price again. Nothing paid is touched. A contract is left for
 * an admin when a payment for it is waiting (proof under review, cheque not
 * cleared) or when the unpaid months cannot absorb the excess (the customer
 * has already paid more than the price — a refund, not a reschedule).
 */

export interface DoubleBilledContract {
  id: string;
  contractNumber: string | null;
  companyId: string | null;
  totalAmount: number;
  scheduled: number;
  excess: number;
}

export type FixOutcome =
  | { status: 'fixed'; rows: number; excess: number }
  | { status: 'skipped'; reason: 'no_longer_over' | 'payment_waiting' | 'excess_exceeds_unpaid' };

const OPEN: InstallmentStatus[] = [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE];
const toCents = (v: Prisma.Decimal | number | string) => Math.round(Number(v) * 100);

/** Live contracts whose schedule adds up to more than their price (by more than one unit). */
export async function findDoubleBilledContracts(db: PrismaClient): Promise<DoubleBilledContract[]> {
  const rows = await db.$queryRaw<
    Array<{ id: string; contractNumber: string | null; companyId: string | null; totalAmount: Prisma.Decimal; scheduled: Prisma.Decimal }>
  >(Prisma.sql`
    SELECT c."id", c."contractNumber", c."companyId", c."totalAmount",
           COALESCE(r."bookingAmount", 0) + SUM(i."amount") AS scheduled
    FROM "Contract" c
    JOIN "InstallmentPlan" p ON p."contractId" = c."id" AND p."cancelledAt" IS NULL
    JOIN "Installment" i ON i."planId" = p."id"
    LEFT JOIN "Reservation" r ON r."id" = c."reservationId"
    WHERE i."type"::text NOT IN (${Prisma.join(SURCHARGE_PAYMENT_TYPES)})
      AND i."status" <> 'CANCELLED'
      AND c."status" <> 'CANCELLED' AND c."deletedAt" IS NULL
    GROUP BY c."id", r."bookingAmount"
    HAVING COALESCE(r."bookingAmount", 0) + SUM(i."amount") > c."totalAmount" + 1
    ORDER BY c."companyId", c."contractNumber"
  `);
  return rows.map((r) => ({
    id: r.id,
    contractNumber: r.contractNumber,
    companyId: r.companyId,
    totalAmount: Number(r.totalAmount),
    scheduled: Number(r.scheduled),
    excess: (toCents(r.scheduled) - toCents(r.totalAmount)) / 100,
  }));
}

/**
 * Bring one contract's schedule back to its price. Re-checks everything on
 * locked rows, so it is safe to run twice or alongside the app.
 */
export async function fixDoubleBilledContract(db: PrismaClient, contractId: string): Promise<FixOutcome> {
  return db.$transaction(async (tx) => {
    const contract = await tx.contract.findUniqueOrThrow({
      where: { id: contractId },
      select: {
        id: true,
        companyId: true,
        totalAmount: true,
        reservation: { select: { bookingAmount: true } },
        installmentPlan: { select: { id: true, cancelledAt: true } },
      },
    });
    const plan = contract.installmentPlan;
    if (!plan || plan.cancelledAt) return { status: 'skipped', reason: 'no_longer_over' };
    await tx.$executeRaw`SELECT 1 FROM "Installment" WHERE "planId" = ${plan.id}::uuid FOR UPDATE`;

    const rows = await tx.installment.findMany({
      where: { planId: plan.id, status: { not: InstallmentStatus.CANCELLED }, type: { notIn: SURCHARGE_PAYMENT_TYPES } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, amount: true, status: true, type: true },
    });
    const scheduledCents =
      toCents(contract.reservation?.bookingAmount ?? 0) + rows.reduce((a, r) => a + toCents(r.amount), 0);
    const excessCents = scheduledCents - toCents(contract.totalAmount);
    if (excessCents <= 100) return { status: 'skipped', reason: 'no_longer_over' };

    const waiting = await tx.deposit.count({
      where: {
        deletedAt: null,
        OR: [{ contractId }, { installment: { planId: plan.id } }],
        AND: [
          {
            OR: [
              { reviewStatus: 'PENDING_REVIEW' },
              { paymentInstrument: { status: { in: UNCLEARED_INSTRUMENT_STATUSES } } },
            ],
          },
        ],
      },
    });
    if (waiting > 0) return { status: 'skipped', reason: 'payment_waiting' };

    const open = rows.filter((r) => r.type === PlanPaymentType.INSTALLMENT && OPEN.includes(r.status));
    const amounts = open.length ? rescaleUnpaid(open.map((r) => Number(r.amount)), -excessCents / 100) : null;
    if (!amounts) return { status: 'skipped', reason: 'excess_exceeds_unpaid' };

    for (const [k, row] of open.entries()) {
      const amount = amounts[k]!;
      const res = await tx.installment.updateMany({
        where: { id: row.id, status: { in: OPEN } },
        // A month left owing nothing is no longer a payment.
        data: amount > 0 ? { amount: new Prisma.Decimal(amount) } : { amount: new Prisma.Decimal(0), status: InstallmentStatus.CANCELLED },
      });
      if (res.count === 0) throw new Error(`installment ${row.id} changed while fixing contract ${contractId}`);
    }
    await tx.auditLog.create({
      data: {
        action: 'contract.schedule-corrected',
        entityType: 'Contract',
        entityId: contractId,
        before: { scheduled: scheduledCents / 100, rows: open.map((r) => ({ id: r.id, amount: Number(r.amount) })) },
        after: {
          scheduled: (scheduledCents - excessCents) / 100,
          excessRemoved: excessCents / 100,
          rows: open.map((r, k) => ({ id: r.id, amount: amounts[k] })),
          reason: 'Final payment billed twice (contracts converted before #83)',
        },
        companyId: contract.companyId,
      },
    });
    return { status: 'fixed', rows: open.length, excess: excessCents / 100 };
  });
}
