/**
 * BRK-3 — the money rules of a brokerage deal, kept pure so the service and
 * the tests read the same arithmetic. Amounts are in the company's currency,
 * rounded to the piaster.
 */
import { ClaimStatus, DealSplitRole } from '@prisma/client';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SplitPlan {
  userId: string;
  role: DealSplitRole;
  sharePct: number;
  amount: number;
}

/**
 * The staff shares of a deal's commission under the company's rule: the
 * agent's share, and the agent's manager's share when the agent has one
 * (never the agent twice). A zero share is no row.
 */
export function planSplits(
  commissionTotal: number,
  rule: { agentPct: number; managerPct: number } | null,
  agentId: string | null,
  managerId: string | null,
): SplitPlan[] {
  if (!rule || !agentId) return [];
  const rows: SplitPlan[] = [];
  if (rule.agentPct > 0) {
    rows.push({
      userId: agentId,
      role: DealSplitRole.AGENT,
      sharePct: rule.agentPct,
      amount: round2((commissionTotal * rule.agentPct) / 100),
    });
  }
  if (rule.managerPct > 0 && managerId && managerId !== agentId) {
    rows.push({
      userId: managerId,
      role: DealSplitRole.MANAGER,
      sharePct: rule.managerPct,
      amount: round2((commissionTotal * rule.managerPct) / 100),
    });
  }
  return rows;
}

/** A developer claim's state from what was paid on it; a rejection stands until undone. */
export function claimStatus(c: {
  amount: number;
  paid: number;
  submittedOn: Date | null;
  rejected: boolean;
}): ClaimStatus {
  if (c.paid >= c.amount && c.amount > 0) return ClaimStatus.PAID;
  if (c.paid > 0) return ClaimStatus.PARTIALLY_PAID;
  if (c.rejected) return ClaimStatus.REJECTED;
  return c.submittedOn ? ClaimStatus.SUBMITTED : ClaimStatus.PENDING;
}
