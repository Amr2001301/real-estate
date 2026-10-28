import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import { managerScopeIds } from '../utils/sales-scope';
import { effectiveCodes, loadHeldCodes, type ReqWithCodes } from './staff-codes';

/**
 * PRM phase 2 — money records a rep owns, or the whole company (owner's
 * decision, 2026-10-28).
 *
 * Contracts and their payments belong to the rep who made the sale (the
 * reservation's salesId). Without a «whole company» code a rep sees their
 * own, a sales manager their own and their team's; an admin, or anyone
 * granted the code, sees the whole company. The codes are in no role's
 * starting set: an admin ticks them on purpose.
 */
export const COMPANY_WIDE_CODES = {
  contracts: 'contracts:read:all',
  deposits: 'deposits:read:all',
  bonus: 'bonus:entries:read:all',
} as const;

/** True when the caller sees the whole company's records (an admin, or the code). */
export async function seesWholeCompany(
  prisma: PrismaService,
  req: ReqWithCodes,
  user: AuthUser,
  wideCode: string,
): Promise<boolean> {
  if (user.role === UserRole.ADMIN) return true;
  return effectiveCodes(user.role, await loadHeldCodes(prisma, req, user.sub)).has(wideCode);
}

/** The reps whose records the caller sees, or undefined for the whole company. */
export async function ownedSalesIds(
  prisma: PrismaService,
  req: ReqWithCodes,
  user: AuthUser,
  wideCode: string,
): Promise<string[] | undefined> {
  if (await seesWholeCompany(prisma, req, user, wideCode)) return undefined;
  if (user.role === UserRole.SALES_MANAGER) return managerScopeIds(prisma, user.sub);
  return [user.sub];
}

/**
 * 404 when one record's rep is outside what the caller sees (existence is
 * not leaked). The rep is looked up only for a caller limited to their own.
 */
export async function assertOwnedRecord(
  prisma: PrismaService,
  req: ReqWithCodes,
  user: AuthUser,
  wideCode: string,
  recordSalesId: () => Promise<string | null>,
): Promise<void> {
  const ids = await ownedSalesIds(prisma, req, user, wideCode);
  if (!ids) return;
  const salesId = await recordSalesId();
  if (!(salesId && ids.includes(salesId))) throw new NotFoundException('Not found');
}
