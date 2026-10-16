/**
 * What the signed-in broker agent may see in the portal.
 *
 * - A firm manager (primary contact or canManageBrokerUsers) sees the whole
 *   firm's leads, reservations and contracts; any other agent sees only their
 *   own — the same rule the performance pages already apply.
 * - Money (commission rates and amounts, payouts) is shown only to agents with
 *   canViewCommissions, wherever it appears, not just on the commissions pages.
 */
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';

export interface BrokerViewer {
  userId: string;
  canSeeAllAgents: boolean;
  canViewCommissions: boolean;
}

export async function resolveBrokerViewer(
  prisma: PrismaService,
  scope: BrokerScopeContext,
): Promise<BrokerViewer> {
  const me = await prisma.brokerUser.findUnique({
    where: { id: scope.brokerUserId },
    select: { userId: true, isPrimaryContact: true, canManageBrokerUsers: true, canViewCommissions: true },
  });
  if (!me) throw new ForbiddenException('Broker profile not found');
  return {
    userId: me.userId,
    canSeeAllAgents: me.isPrimaryContact || me.canManageBrokerUsers,
    canViewCommissions: me.canViewCommissions,
  };
}

/** Row filter for models carrying brokerAgentId (Lead, Reservation, Contract). */
export function agentFilter(viewer: BrokerViewer): { brokerAgentId?: string } {
  return viewer.canSeeAllAgents ? {} : { brokerAgentId: viewer.userId };
}

/** Drops the money fields from a row unless the viewer may see commissions. */
export function withoutMoney<T extends Record<string, unknown>>(
  row: T,
  viewer: BrokerViewer,
  keys: readonly string[],
): T {
  if (viewer.canViewCommissions) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const k of keys) if (k in copy) copy[k] = null;
  return copy as T;
}

/**
 * The person the broker brought is the lead. After a transfer (تنازل) the
 * contract and its reservation belong to someone the broker never introduced;
 * the portal then shows the lead's own details instead of the new owner's.
 */
export function brokerFacingPerson<
  P extends { id: string; fullName: string; phone: string | null; email?: string | null },
>(
  owner: P | null,
  lead: { clientId?: string | null; fullName: string; phone: string | null } | null | undefined,
): (P & { transferred?: boolean }) | { id: null; fullName: string; phone: string | null; email: null; transferred: true } | null {
  if (!owner || !lead?.clientId || owner.id === lead.clientId) return owner;
  return { id: null, fullName: lead.fullName, phone: lead.phone, email: null, transferred: true };
}
