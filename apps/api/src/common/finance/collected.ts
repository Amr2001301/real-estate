import {
  DepositReviewStatus,
  PaymentCorrectionType,
  PaymentInstrumentStatus,
  Prisma,
} from '@prisma/client';

/**
 * The one definition of money the company has actually collected. Every
 * report and dashboard sums deposits through it, so the same label never
 * means two different totals on two screens.
 *
 * A deposit is collected when it is:
 *   - not deleted;
 *   - APPROVED (proof accepted / cheque cleared) or NO_PROOF (cash or a
 *     transfer recorded by staff, which pays its installment at once);
 *   - not paid by a cheque that has not cleared — or that bounced, was
 *     replaced or cancelled;
 *   - not reversed (no REVERSAL correction written against it).
 *
 * Refunds on cancelled contracts are not subtracted here; see the refunds
 * report.
 */
export const COLLECTED_DEPOSIT_WHERE = {
  deletedAt: null,
  reviewStatus: { in: [DepositReviewStatus.APPROVED, DepositReviewStatus.NO_PROOF] },
  AND: [
    {
      OR: [
        { paymentInstrumentId: null },
        { paymentInstrument: { status: PaymentInstrumentStatus.CLEARED } },
      ],
    },
    { paymentCorrections: { none: { type: PaymentCorrectionType.REVERSAL } } },
  ],
} satisfies Prisma.DepositWhereInput;

/**
 * Every payment recorded and still standing — collected or waiting (proof
 * under review, cheque not yet cleared). Excludes deleted, rejected (bounced)
 * and reversed ones.
 */
export const RECORDED_DEPOSIT_WHERE = {
  deletedAt: null,
  reviewStatus: { not: DepositReviewStatus.REJECTED },
  paymentCorrections: { none: { type: PaymentCorrectionType.REVERSAL } },
} satisfies Prisma.DepositWhereInput;
