import { DepositReviewStatus, PaymentInstrumentStatus, Prisma } from '@prisma/client';

/** FG-01 — a cheque the bank has not paid or returned yet. */
export const UNCLEARED_INSTRUMENT_STATUSES: PaymentInstrumentStatus[] = [
  PaymentInstrumentStatus.PENDING_CLEARANCE,
  PaymentInstrumentStatus.DEPOSITED,
];

/**
 * Deposits waiting on a reviewer. A deposit paid by an uncleared cheque is
 * PENDING_REVIEW too, but it waits on the bank — it is approved by the
 * clearing and rejected by a bounce, never by a reviewer — so it is left out
 * of the review queue and of the dashboard's "pending review" count.
 */
export const notAwaitingChequeWhere: Prisma.DepositWhereInput = {
  OR: [
    { paymentInstrumentId: null },
    { paymentInstrument: { status: { notIn: UNCLEARED_INSTRUMENT_STATUSES } } },
  ],
};

export const awaitingReviewerWhere: Prisma.DepositWhereInput = {
  reviewStatus: DepositReviewStatus.PENDING_REVIEW,
  ...notAwaitingChequeWhere,
};
