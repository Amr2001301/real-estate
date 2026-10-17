import { ContractStatus, DepositReviewStatus, DepositType, PlanPaymentType, Prisma } from '@prisma/client';
import { ACCESSIBLE_COMPANY_WHERE } from '../../common/tenant/company-access';
import { UNCLEARED_INSTRUMENT_STATUSES } from '../deposits/review-queue';

/** A contract that is neither cancelled nor deleted. */
export const LIVE_CONTRACT_WHERE = {
  status: { not: ContractStatus.CANCELLED },
  deletedAt: null,
} satisfies Prisma.ContractWhereInput;

/**
 * A broker commission or sales bonus that may still be approved and paid:
 * its deal is live, or the deal was cancelled with RETAIN — the commission
 * stays payable then (decided 2026-10-16).
 */
export const PAYABLE_DEAL_WHERE = {
  OR: [{ contract: LIVE_CONTRACT_WHERE }, { retainedOnCancellation: true }],
} satisfies Prisma.BrokerCommissionWhereInput;

/**
 * A commission the broker has earned and keeps: not cancelled or rejected,
 * on a deal still payable, and not being clawed back (a waived clawback
 * leaves it with the broker). Reports and the leaderboard count these, with
 * their price-change adjustments (earnedCommissionNet).
 */
export const EARNED_COMMISSION_WHERE = {
  status: { notIn: ['CANCELLED', 'REJECTED'] },
  AND: [PAYABLE_DEAL_WHERE, { OR: [{ clawbackStatus: null }, { clawbackStatus: 'WAIVED' }] }],
} satisfies Prisma.BrokerCommissionWhereInput;

/**
 * The net the broker earns on the commissions `where` selects: their net plus
 * the price-change top-ups, less the price-change clawbacks (paid out or not).
 */
export async function earnedCommissionNet(
  db: Pick<Prisma.TransactionClient, 'brokerCommission' | 'brokerCommissionAdjustment'>,
  where: Prisma.BrokerCommissionWhereInput,
): Promise<Prisma.Decimal> {
  const [agg, adjustments] = await Promise.all([
    db.brokerCommission.aggregate({ where, _sum: { netAmount: true } }),
    db.brokerCommissionAdjustment.groupBy({
      by: ['kind'],
      where: { settlesClawback: false, commission: where },
      _sum: { amount: true },
    }),
  ]);
  return adjustments.reduce(
    (sum, a) => (a.kind === 'TOP_UP' ? sum.add(a._sum.amount ?? 0) : sum.sub(a._sum.amount ?? 0)),
    new Prisma.Decimal(agg._sum.netAmount ?? 0),
  );
}

/** The same check on a row already read (contract status, the RETAIN flag). */
export function isPayableDeal(row: {
  retainedOnCancellation?: boolean | null;
  contract?: { status: ContractStatus; deletedAt: Date | null } | null;
}): boolean {
  return !isDeadContract(row.contract) || row.retainedOnCancellation === true;
}

/**
 * A plan whose contract is still live: not cancelled, not deleted. Reminders,
 * the overdue sweep and anything that (re)opens an installment must stay
 * inside it — otherwise a cancelled deal keeps billing its customer.
 */
export const LIVE_PLAN_WHERE = {
  cancelledAt: null,
  contract: LIVE_CONTRACT_WHERE,
} satisfies Prisma.InstallmentPlanWhereInput;

/**
 * A plan whose contract is signed and live. Only these are chased: an
 * unsigned contract (converted from a reservation, signing still to come) has
 * no installment overdue and no late fee yet — its down payment was dated the
 * day of conversion and turned overdue that night.
 */
export const BILLABLE_PLAN_WHERE = {
  cancelledAt: null,
  contract: { status: ContractStatus.ACTIVE, deletedAt: null },
} satisfies Prisma.InstallmentPlanWhereInput;

/**
 * A plan whose installments the automatic jobs chase (overdue, late fees):
 * billable, its customer's account active and not deleted, and its company
 * not blocked — no one is charged or notified who cannot reach the app.
 */
export const CHASED_PLAN_WHERE = {
  cancelledAt: null,
  contract: {
    status: ContractStatus.ACTIVE,
    deletedAt: null,
    customer: { active: true, deletedAt: null },
    company: ACCESSIBLE_COMPANY_WHERE,
  },
} satisfies Prisma.InstallmentPlanWhereInput;

/**
 * A payment for the row is waiting — a proof under review or a cheque not
 * cleared yet. While one is, the customer has paid as far as they can tell.
 */
export const PAYMENT_ON_ITS_WAY = {
  deletedAt: null,
  OR: [
    { reviewStatus: DepositReviewStatus.PENDING_REVIEW },
    { paymentInstrument: { status: { in: UNCLEARED_INSTRUMENT_STATUSES } } },
  ],
} satisfies Prisma.DepositWhereInput;

/**
 * The one rule for "should this installment be chased" — by the overdue
 * sweep, the due-soon reminders and the customer's home banner: its plan is
 * chased (CHASED_PLAN_WHERE: signed, live, active customer, company not
 * blocked) and no payment for it is on its way.
 */
export const CHASED_INSTALLMENT_WHERE = {
  plan: CHASED_PLAN_WHERE,
  deposits: { none: PAYMENT_ON_ITS_WAY },
} satisfies Prisma.InstallmentWhereInput;

export const CONTRACT_CANCELLED_MESSAGE = 'العقد ملغي — لا يمكن تعديل مدفوعاته أو أقساطه';

/** True when the contract is cancelled or deleted. */
export function isDeadContract(
  contract: { status: ContractStatus; deletedAt?: Date | null } | null | undefined,
): boolean {
  return !!contract && (contract.status === ContractStatus.CANCELLED || !!contract.deletedAt);
}

/**
 * Charges added on top of the price (fees and penalties). They are owed and
 * collected like installments, but are not part of the contract price — a
 * unit swap does not rescale them, the late-fee sweep does not charge on
 * them, and price-progress figures leave them out.
 */
export const SURCHARGE_PAYMENT_TYPES: PlanPaymentType[] = [
  PlanPaymentType.LATE_FEE,
  PlanPaymentType.BOUNCE_PENALTY,
  PlanPaymentType.TRANSFER_FEE,
];

/**
 * The deposit type for a payment of one schedule row. A fee or penalty is
 * recorded as FEE, so receipts, the deposits list and reports never show it
 * as an instalment of the price.
 */
export function depositTypeForInstallment(type: PlanPaymentType): DepositType {
  if (SURCHARGE_PAYMENT_TYPES.includes(type)) return DepositType.FEE;
  switch (type) {
    case PlanPaymentType.DOWN_PAYMENT:
      return DepositType.DOWN_PAYMENT;
    case PlanPaymentType.FINAL_PAYMENT:
      return DepositType.FINAL_PAYMENT;
    default:
      return DepositType.INSTALLMENT;
  }
}
