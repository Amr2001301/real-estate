import { ContractStatus, Prisma } from '@prisma/client';

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
