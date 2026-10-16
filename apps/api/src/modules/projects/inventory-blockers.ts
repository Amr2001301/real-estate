import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ProjectStatus, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * What stops deleting part of the inventory (a phase, a building): any deal,
 * maintenance or price plan on its units, or a unit reserved or sold. A
 * phase or building delete cascades to its units, so without this check a
 * delete either removed units with their history silently or failed with a
 * raw foreign-key error (500).
 */
export async function assertInventoryDeletable(
  prisma: PrismaService,
  unitWhere: Prisma.UnitWhereInput,
  what: string,
): Promise<void> {
  const [reservations, contracts, maintenance, liveUnits, planTemplates] = await prisma.$transaction([
    prisma.reservation.count({ where: { unit: unitWhere } }),
    prisma.contract.count({ where: { unit: unitWhere } }),
    prisma.maintenanceRequest.count({ where: { unit: unitWhere } }),
    prisma.unit.count({ where: { ...unitWhere, status: { in: [UnitStatus.SOLD, UnitStatus.RESERVED] } } }),
    prisma.installmentPlanTemplate.count({ where: { unit: unitWhere } }),
  ]);
  const blockers: string[] = [];
  if (reservations > 0) blockers.push(`${reservations} حجز`);
  if (contracts > 0) blockers.push(`${contracts} عقد`);
  if (maintenance > 0) blockers.push(`${maintenance} طلب صيانة`);
  if (liveUnits > 0) blockers.push(`${liveUnits} وحدة محجوزة أو مباعة`);
  if (planTemplates > 0) blockers.push(`${planTemplates} خطة أسعار`);
  if (blockers.length > 0) {
    throw new ConflictException(
      `لا يمكن حذف ${what} لأنه مرتبط بـ: ${blockers.join('، ')}. يجب إزالة أو نقل هذه السجلات أولاً.`,
    );
  }
}

/** New reservations and contracts are refused on an archived project's units. */
export async function assertUnitOnSale(prisma: PrismaService, unitId: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { building: { select: { phase: { select: { project: { select: { status: true } } } } } } },
  });
  if (unit?.building?.phase?.project?.status === ProjectStatus.ARCHIVED) {
    throw new BadRequestException('المشروع مؤرشف — لا يمكن حجز أو بيع وحداته');
  }
}
