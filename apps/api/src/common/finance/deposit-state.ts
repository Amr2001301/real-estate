import {
  DepositReviewStatus,
  PaymentCorrectionType,
  PaymentInstrumentStatus,
  Prisma,
} from '@prisma/client';

/**
 * One answer to "did this money arrive?" for a recorded payment, so every
 * admin screen says the same thing. The legacy `verified` flag could not:
 * cash recorded by staff read "unverified" while it paid its installment,
 * and a cheque that bounced after clearing still read "verified".
 *
 *   COLLECTED      — counts as collected (COLLECTED_DEPOSIT_WHERE)
 *   PENDING_REVIEW — the customer sent a proof; an admin must approve or reject
 *   CHEQUE_PENDING — paid by a cheque the bank has not cleared yet
 *   REJECTED       — proof rejected
 *   BOUNCED        — the cheque bounced (or was replaced/cancelled)
 *   REVERSED       — an admin reversed it; its installment is open again
 *   DELETED        — soft-deleted
 */
export type DepositState =
  | 'COLLECTED'
  | 'PENDING_REVIEW'
  | 'CHEQUE_PENDING'
  | 'REJECTED'
  | 'BOUNCED'
  | 'REVERSED'
  | 'DELETED';

/** The relations depositState reads; spread into a Prisma select/include. */
export const DEPOSIT_STATE_SELECT = {
  paymentInstrument: { select: { status: true, type: true, chequeNumber: true } },
  paymentCorrections: {
    where: { type: PaymentCorrectionType.REVERSAL },
    select: { type: true, supersededAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.DepositInclude;

export interface DepositStateInput {
  deletedAt: Date | null;
  reviewStatus: DepositReviewStatus;
  paymentInstrument?: { status: PaymentInstrumentStatus } | null;
  paymentCorrections?: Array<{ type: PaymentCorrectionType; supersededAt: Date | null; createdAt: Date }>;
}

const UNCLEARED: PaymentInstrumentStatus[] = [
  PaymentInstrumentStatus.PENDING_CLEARANCE,
  PaymentInstrumentStatus.DEPOSITED,
];
const DEAD: PaymentInstrumentStatus[] = [
  PaymentInstrumentStatus.BOUNCED,
  PaymentInstrumentStatus.REPLACED,
  PaymentInstrumentStatus.CANCELLED,
];

/** When the standing reversal was written (null when there is none). */
export function activeReversalAt(d: DepositStateInput): Date | null {
  const r = (d.paymentCorrections ?? []).find(
    (c) => c.type === PaymentCorrectionType.REVERSAL && c.supersededAt === null,
  );
  return r ? r.createdAt : null;
}

export function depositState(d: DepositStateInput): DepositState {
  if (d.deletedAt) return 'DELETED';
  const instrument = d.paymentInstrument?.status;
  // A bounce after clearing reverses the payment; it reads as bounced.
  if (instrument && DEAD.includes(instrument)) return 'BOUNCED';
  if (activeReversalAt(d)) return 'REVERSED';
  if (d.reviewStatus === DepositReviewStatus.REJECTED) return 'REJECTED';
  if (instrument && UNCLEARED.includes(instrument)) return 'CHEQUE_PENDING';
  if (d.reviewStatus === DepositReviewStatus.PENDING_REVIEW) return 'PENDING_REVIEW';
  return 'COLLECTED';
}

/** Adds `state` (and `reversedAt`) to a deposit read with DEPOSIT_STATE_SELECT. */
export function withDepositState<T extends DepositStateInput>(d: T): T & { state: DepositState; reversedAt: Date | null } {
  return { ...d, state: depositState(d), reversedAt: activeReversalAt(d) };
}
