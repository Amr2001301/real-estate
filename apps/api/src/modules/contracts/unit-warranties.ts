import { PrismaService } from '../../common/prisma/prisma.service';

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
        ? (() => {
            const d = new Date(warrantyStartAt);
            d.setMonth(d.getMonth() + months);
            return d;
          })()
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