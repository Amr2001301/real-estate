import { ContractStatus, PlanPaymentType, Prisma } from '@prisma/client';

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
