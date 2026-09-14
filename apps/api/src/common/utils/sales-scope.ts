import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import { getRequiredCompanyId } from '../tenant/tenant-context';

/**
 * Sales-team scoping (Batch 9).
 *
 * Resolves which sales reps a caller may see, by role:
 *   - ADMIN          → unrestricted, or a single rep when a salesId is requested.
 *   - SALES_MANAGER  → only their team (SALES users whose managerId = manager id).
 *                      A requested salesId is honoured only if it is in the team;
 *                      anything else (incl. an empty team) yields an empty set —
 *                      never an all-sales fallback.
 *   - SALES (+ other) → self only; a requested salesId is ignored.
 *
 * The returned shape is meant to be spread into a service's list options:
 *   - {}                      → no sales restriction (ADMIN, all reps)
 *   - { salesId }             → a single rep (equals filter)
 *   - { salesIds }            → a set (IN filter); may be [] to match nothing
 */
export interface SalesScopeArgs {
  salesId?: string;
  salesIds?: string[];
}

/**
 * Internal sales-actor roles. A SALES_MANAGER is both a personal sales rep AND
 * a team manager, so it counts as a sales actor anywhere the system means
 * "internal salesperson who can own/be-assigned records". ADMIN is never a sales
 * actor.
 */
export const SALES_ACTOR_ROLES: UserRole[] = [UserRole.SALES, UserRole.SALES_MANAGER];

/** All internal sales actors (SALES + SALES_MANAGER) within the current tenant. */
export async function salesActorIds(prisma: PrismaService): Promise<string[]> {
  const companyId = getRequiredCompanyId();
  const rows = await prisma.user.findMany({
    where: { role: { in: SALES_ACTOR_ROLES }, companyId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** A manager's team members within the current tenant: SALES reps whose
 *  managerId is this manager. Does NOT include the manager themselves. */
export async function teamSalesIds(
  prisma: PrismaService,
  managerId: string,
): Promise<string[]> {
  const companyId = getRequiredCompanyId();
  const rows = await prisma.user.findMany({
    where: { role: UserRole.SALES, managerId, companyId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** A manager's full visible/owning scope: themselves + their team members.
 *  A manager with no team still scopes to at least themselves. */
export async function managerScopeIds(
  prisma: PrismaService,
  managerId: string,
): Promise<string[]> {
  const team = await teamSalesIds(prisma, managerId);
  return [managerId, ...team];
}

export async function resolveSalesScope(
  prisma: PrismaService,
  user: AuthUser,
  requestedSalesId?: string,
): Promise<SalesScopeArgs> {
  if (user.role === UserRole.ADMIN) {
    return requestedSalesId ? { salesId: requestedSalesId } : {};
  }
  if (user.role === UserRole.SALES_MANAGER) {
    // Manager scope = self + team. A requested salesId is honoured only when in
    // scope; out-of-scope (incl. another manager / another team) ⇒ empty set.
    const ids = await managerScopeIds(prisma, user.sub);
    if (requestedSalesId) {
      return ids.includes(requestedSalesId) ? { salesId: requestedSalesId } : { salesIds: [] };
    }
    return { salesIds: ids };
  }
  // SALES and any other authenticated role: self only.
  return { salesId: user.sub };
}

/**
 * Per-record team ownership check (Batch 10).
 *
 * Returns whether `recordSalesId` (the SALES owner of a single record) is within
 * the caller's scope:
 *   - ADMIN          → always true.
 *   - SALES          → true only when the record is their own.
 *   - SALES_MANAGER  → true for their OWN records and their team members'
 *                      records. A null/absent owner is out of scope.
 *   - other roles    → false.
 */
export async function isSalesIdInScope(
  prisma: PrismaService,
  user: AuthUser,
  recordSalesId: string | null | undefined,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.SALES) return !!recordSalesId && recordSalesId === user.sub;
  if (user.role === UserRole.SALES_MANAGER) {
    if (!recordSalesId) return false;
    const ids = await managerScopeIds(prisma, user.sub);
    return ids.includes(recordSalesId);
  }
  return false;
}

/**
 * Throws when a record's SALES owner is out of the caller's scope. Defaults to
 * NotFoundException so existence isn't leaked to a manager probing foreign ids;
 * pass mode: 'forbidden' where a 403 matches the surrounding route's style.
 *
 * No-ops for ADMIN. For SALES this enforces self-ownership; callers that already
 * have their own SALES self-checks can restrict this to managers via
 * `managersOnly: true`.
 */
export async function assertSalesRecordInScope(
  prisma: PrismaService,
  user: AuthUser,
  recordSalesId: string | null | undefined,
  opts: { mode?: 'notfound' | 'forbidden'; managersOnly?: boolean } = {},
): Promise<void> {
  if (user.role === UserRole.ADMIN) return;
  if (opts.managersOnly && user.role !== UserRole.SALES_MANAGER) return;
  const ok = await isSalesIdInScope(prisma, user, recordSalesId);
  if (ok) return;
  throw opts.mode === 'forbidden'
    ? new ForbiddenException('Record is outside your team')
    : new NotFoundException('Not found');
}
