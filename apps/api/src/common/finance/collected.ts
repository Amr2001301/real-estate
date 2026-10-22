import {
  DepositReviewStatus,
  DepositType,
  PaymentCorrectionType,
  PaymentInstrumentStatus,
  Prisma,
} from '@prisma/client';
import { LIVE_CONTRACT_WHERE, LIVE_PLAN_WHERE, SURCHARGE_PAYMENT_TYPES } from '../../modules/installments/live-contract';

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
 *   - not reversed (no REVERSAL correction written against it), unless it
 *     was approved again since (the reversal is then superseded).
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
    { paymentCorrections: { none: { type: PaymentCorrectionType.REVERSAL, supersededAt: null } } },
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
  paymentCorrections: { none: { type: PaymentCorrectionType.REVERSAL, supersededAt: null } },
} satisfies Prisma.DepositWhereInput;

/**
 * Money on its way: a proof the customer sent that awaits review, or a cheque
 * the bank has not cleared yet (depositState PENDING_REVIEW / CHEQUE_PENDING).
 * Disjoint from COLLECTED_DEPOSIT_WHERE.
 */
export const AWAITING_DEPOSIT_WHERE = {
  deletedAt: null,
  reviewStatus: { not: DepositReviewStatus.REJECTED },
  paymentCorrections: { none: { type: PaymentCorrectionType.REVERSAL, supersededAt: null } },
  OR: [
    {
      paymentInstrument: {
        status: { in: [PaymentInstrumentStatus.PENDING_CLEARANCE, PaymentInstrumentStatus.DEPOSITED] },
      },
    },
    {
      reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      OR: [{ paymentInstrumentId: null }, { paymentInstrument: { status: PaymentInstrumentStatus.CLEARED } }],
    },
  ],
} satisfies Prisma.DepositWhereInput;

/**
 * Decided 2026-10-16: "collected" is shown as two figures.
 *
 * Towards the price — the money paid against the price of signed live contracts:
 * their down payment, booking and installments. Not fee payments (late fee,
 * transfer fee, cheque penalty), not deposits on cancelled deals, not
 * bookings that never became a contract. The collection rate is this over
 * the contracts' value (measured against everything collected it could pass
 * 100%). Combine with COLLECTED_DEPOSIT_WHERE.
 */
const SIGNED_LIVE_CONTRACT = { ...LIVE_CONTRACT_WHERE, signedAt: { not: null } } satisfies Prisma.ContractWhereInput;

// Signed contracts only, as the contract value and what is due (decided
// 2026-10-17): an unsigned contract's booking was in "collected" but its
// price and its dues were not.
export const TOWARDS_PRICE_DEPOSIT_WHERE = {
  type: { not: DepositType.FEE },
  OR: [
    { installmentId: null, contract: { is: SIGNED_LIVE_CONTRACT } },
    {
      installment: {
        is: { type: { notIn: SURCHARGE_PAYMENT_TYPES }, plan: { ...LIVE_PLAN_WHERE, contract: SIGNED_LIVE_CONTRACT } },
      },
    },
    { installmentId: null, contractId: null, reservation: { is: { contract: { is: SIGNED_LIVE_CONTRACT } } } },
  ],
} satisfies Prisma.DepositWhereInput;

/** Fees & penalties — payments of a late fee, a transfer fee or a cheque penalty. */
export const FEES_DEPOSIT_WHERE = {
  OR: [{ type: DepositType.FEE }, { installment: { is: { type: { in: SURCHARGE_PAYMENT_TYPES } } } }],
} satisfies Prisma.DepositWhereInput;
