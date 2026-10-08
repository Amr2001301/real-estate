import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import { getRequiredCompanyId } from '../tenant/tenant-context';
import { managerScopeIds } from './sales-scope';

/**
 * Client ownership — who may act on a registered client (a CLIENT / CUSTOMER
 * user), decided 2026-10-08:
 *
 *   - SALES          → only clients they own.
 *   - SALES_MANAGER  → clients owned by themselves or their team.
 *   - ADMIN          → every client of the company.
 *
 * A rep "owns" a client when the client has a lead assigned to the rep or a
 * reservation sold by the rep. A client nobody owns (signed up in the app, or
 * whose only leads are unassigned) is given out by an ADMIN only: reps cannot
 * claim one by creating a lead for its phone number.
 *
 * Leads and reservations were already scoped this way (sales-scope.ts); clients
 * were not — reservation and visit creation accepted any client or lead id of
 * the company, and the client search was ADMIN-only, so the UI simply showed
 * reps nothing.
 */

type Db = PrismaService | Prisma.TransactionClient;

/** Sales ids whose clients the caller may act on; `null` = unrestricted (ADMIN). */
export async function clientOwnerScope(
  prisma: PrismaService,
  user: AuthUser,
): Promise<string[] | null> {
  if (user.role === UserRole.ADMIN) return null;
  if (user.role === UserRole.SALES_MANAGER) return managerScopeIds(prisma, user.sub);
  if (user.role === UserRole.SALES) return [user.sub];
  return [];
}

/** Clients owned by any of `salesIds` — for the scoped client search. */
export function ownedClientsWhere(salesIds: string[]): Prisma.UserWhereInput {
  return {
    OR: [
      { leads: { some: { assignedSalesId: { in: salesIds } } } },
      { reservationClients: { some: { salesId: { in: salesIds } } } },
    ],
  };
}

/** The reps who own `clientId`: assignees of its leads, sellers of its reservations. */
export async function clientOwnerIds(db: Db, clientId: string): Promise<string[]> {
  const companyId = getRequiredCompanyId();
  const leads = await db.lead.findMany({
    where: { clientId, companyId, assignedSalesId: { not: null } },
    select: { assignedSalesId: true },
    distinct: ['assignedSalesId'],
  });
  const reservations = await db.reservation.findMany({
    where: { clientId, companyId },
    select: { salesId: true },
    distinct: ['salesId'],
  });
  return [
    ...new Set([
      ...leads.map((l) => l.assignedSalesId as string),
      ...reservations.map((r) => r.salesId),
    ]),
  ];
}

/**
 * Throws unless the caller may act on `clientId`. Answers "Client not found"
 * — the same as a wrong id — so a rep cannot probe for other reps' clients.
 */
export async function assertClientInScope(
  db: Db,
  scope: string[] | null,
  clientId: string,
): Promise<void> {
  if (scope === null) return;
  const owners = await clientOwnerIds(db, clientId);
  if (!owners.some((id) => scope.includes(id))) {
    throw new BadRequestException('Client not found');
  }
}

/** Throws unless a lead's assignee is in the caller's scope ("Lead not found"). */
export function assertLeadInScope(scope: string[] | null, assignedSalesId: string | null): void {
  if (scope === null) return;
  if (!assignedSalesId || !scope.includes(assignedSalesId)) {
    throw new BadRequestException('Lead not found');
  }
}

/**
 * Duplicate check when a rep creates a lead for a client that already exists
 * (found by id, phone or email). The rep is told the client is taken — never
 * by whom — and who can move it.
 */
export async function assertClientClaimable(
  db: Db,
  scope: string[] | null,
  clientId: string,
): Promise<void> {
  if (scope === null) return;
  const owners = await clientOwnerIds(db, clientId);
  if (owners.some((id) => scope.includes(id))) return;
  throw new ConflictException(
    owners.length > 0
      ? 'هذا العميل مسجّل مع مندوب آخر — اطلب من مدير المبيعات نقله إليك'
      : 'هذا العميل مسجّل بدون مندوب — توزيعه على المندوبين من صلاحية الأدمن',
  );
}
