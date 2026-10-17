import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addMonths } from '../../common/utils/add-months';

/**
 * Start warranties for a sold unit's active maintenance items. For each item
 * that has not yet started (warrantyStart == null), freeze the warranty
 * duration (item snapshot if present, else the category's current duration)
 * and set warrantyStart = warrantyStartAt (the contract CREATION date),
 * warrantyEnd = warrantyStartAt + duration months. Idempotent.
 */
export async function startUnitWarranties(prisma: PrismaService, unitId: string, warrantyStartAt: Date) {
  const items = await prisma.unitMaintenanceItem.findMany({
    where: { unitId, active: true, warrantyStart: null },
    include: { category: { select: { warrantyDurationMonths: true } } },
  });
  for (const item of items) {
    const months = item.warrantyDurationMonthsSnapshot ?? item.category?.warrantyDurationMonths ?? null;
    const warrantyEnd =
      months != null
        ? addMonths(warrantyStartAt, months)
        : null;
    await prisma.unitMaintenanceItem.update({
      where: { id: item.id },
      data: {
        warrantyStart: warrantyStartAt,
        warrantyEnd,
        warrantyDurationMonthsSnapshot: months,
      },
    });
  }
}
/**
 * A released unit goes back on sale: the cancelled buyer's warranties are
 * cleared so the next contract's signing starts them afresh (signing only
 * starts items whose warrantyStart is still empty, and freezes the duration).
 */
export async function resetUnitWarranties(tx: Prisma.TransactionClient, unitId: string) {
  await tx.unitMaintenanceItem.updateMany({
    where: { unitId, warrantyStart: { not: null } },
    data: { warrantyStart: null, warrantyEnd: null, warrantyDurationMonthsSnapshot: null },
  });
}


/**
 * When the customer no longer holds the unit (the sale was cancelled, the
 * contract moved to another unit, or was transferred to another customer),
 * their open requests on it are closed: no crew is sent to a unit that may
 * already be resold, and a new owner files their own. Returns how many closed.
 *
 * A RESOLVED one waiting on the customer's confirmation is closed too, and
 * one still waiting for review is rejected: before, an auto-closed request
 * could still be approved, assigned or reopened.
 */
export async function closeOpenMaintenance(
  tx: Prisma.TransactionClient,
  unitId: string,
  customerId: string,
  companyId: string,
): Promise<number> {
  const now = new Date();
  const scope = { unitId, customerId, companyId, status: { not: 'CLOSED' as const } };
  await tx.maintenanceRequest.updateMany({
    where: { ...scope, reviewStatus: 'PENDING' },
    data: { reviewStatus: 'REJECTED', rejectedAt: now },
  });
  const closed = await tx.maintenanceRequest.updateMany({
    where: scope,
    data: { status: 'CLOSED', closedAt: now, dueAt: null },
  });
  return closed.count;
}
