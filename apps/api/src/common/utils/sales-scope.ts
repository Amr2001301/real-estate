import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';

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

export async function teamSalesIds(
  prisma: PrismaService,
  managerId: string,
): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: UserRole.SALES, managerId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
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
    const ids = await teamSalesIds(prisma, user.sub);
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
 *   - SALES_MANAGER  → true only when the owner is a SALES rep on their team.
 *                      A null/absent owner is out of scope for a manager.
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
    const ids = await teamSalesIds(prisma, user.sub);
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
