import { ContractStatus, DepositType, PlanPaymentType, Prisma } from '@prisma/client';

/** A contract that is neither cancelled nor deleted. */
export const LIVE_CONTRACT_WHERE = {
  status: { not: ContractStatus.CANCELLED },
  deletedAt: null,
} satisfies Prisma.ContractWhereInput;

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
