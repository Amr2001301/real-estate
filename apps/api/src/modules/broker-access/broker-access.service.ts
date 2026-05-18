import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GrantBrokerProjectAccessDto,
  GrantBrokerUnitAccessDto,
} from './dto/broker-access.dto';

const PROJECT_ACCESS_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      featured: true,
    },
  },
} as const;

const UNIT_ACCESS_INCLUDE = {
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      status: true,
      buildingId: true,
      building: {
        select: {
          id: true,
          name: true,
          phaseId: true,
          phase: {
            select: { id: true, projectId: true, name: true },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class BrokerAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccess(brokerId: string) {
    await this.assertBrokerExists(brokerId);
    const [projects, units] = await this.prisma.$transaction([
      this.prisma.brokerProjectAccess.findMany({
        where: { brokerId },
        orderBy: { createdAt: 'desc' },
        include: PROJECT_ACCESS_INCLUDE,
      }),
      this.prisma.brokerUnitAccess.findMany({
        where: { brokerId },
        orderBy: { createdAt: 'desc' },
        include: UNIT_ACCESS_INCLUDE,
      }),
    ]);
    return { projects, units };
  }

  async grantProject(brokerId: string, dto: GrantBrokerProjectAccessDto) {
    await this.assertBrokerExists(brokerId);
    await this.assertProjectExists(dto.projectId);

    const existing = await this.prisma.brokerProjectAccess.findUnique({
      where: {
        brokerId_projectId: { brokerId, projectId: dto.projectId },
      },
    });

    const data: Prisma.BrokerProjectAccessUncheckedUpdateInput = {
      commissionPct:
        dto.commissionPct !== undefined
          ? new Prisma.Decimal(dto.commissionPct)
          : null,
      fixedAmountPerUnit:
        dto.fixedAmountPerUnit !== undefined
          ? new Prisma.Decimal(dto.fixedAmountPerUnit)
          : null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      // Reactivate by default when granting, unless explicitly set to false.
      active: dto.active ?? true,
    };

    if (existing) {
      return this.prisma.brokerProjectAccess.update({
        where: { id: existing.id },
        data,
        include: PROJECT_ACCESS_INCLUDE,
      });
    }

    return this.prisma.brokerProjectAccess.create({
      data: {
        brokerId,
        projectId: dto.projectId,
        commissionPct:
          dto.commissionPct !== undefined
            ? new Prisma.Decimal(dto.commissionPct)
            : null,
        fixedAmountPerUnit:
          dto.fixedAmountPerUnit !== undefined
            ? new Prisma.Decimal(dto.fixedAmountPerUnit)
            : null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        active: dto.active ?? true,
      },
      include: PROJECT_ACCESS_INCLUDE,
    });
  }

  async revokeProject(brokerId: string, projectId: string) {
    await this.assertBrokerExists(brokerId);
    const existing = await this.prisma.brokerProjectAccess.findUnique({
      where: { brokerId_projectId: { brokerId, projectId } },
    });
    if (!existing) {
      throw new NotFoundException('Project access grant not found for this broker');
    }
    // Soft-revoke (mark inactive) so a future grant can reactivate the row
    // instead of creating a duplicate.
    return this.prisma.brokerProjectAccess.update({
      where: { id: existing.id },
      data: { active: false },
      include: PROJECT_ACCESS_INCLUDE,
    });
  }

  async grantUnit(brokerId: string, dto: GrantBrokerUnitAccessDto) {
    await this.assertBrokerExists(brokerId);
    await this.assertUnitGrantable(dto.unitId);

    const existing = await this.prisma.brokerUnitAccess.findUnique({
      where: { brokerId_unitId: { brokerId, unitId: dto.unitId } },
    });

    if (existing) {
      return this.prisma.brokerUnitAccess.update({
        where: { id: existing.id },
        data: { active: dto.active ?? true },
        include: UNIT_ACCESS_INCLUDE,
      });
    }

    return this.prisma.brokerUnitAccess.create({
      data: {
        brokerId,
        unitId: dto.unitId,
        active: dto.active ?? true,
      },
      include: UNIT_ACCESS_INCLUDE,
    });
  }

  async revokeUnit(brokerId: string, unitId: string) {
    await this.assertBrokerExists(brokerId);
    const existing = await this.prisma.brokerUnitAccess.findUnique({
      where: { brokerId_unitId: { brokerId, unitId } },
    });
    if (!existing) {
      throw new NotFoundException('Unit access grant not found for this broker');
    }
    return this.prisma.brokerUnitAccess.update({
      where: { id: existing.id },
      data: { active: false },
      include: UNIT_ACCESS_INCLUDE,
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async assertBrokerExists(brokerId: string) {
    const broker = await this.prisma.broker.findUnique({
      where: { id: brokerId },
      select: { id: true },
    });
    if (!broker) throw new NotFoundException('Broker not found');
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertUnitExists(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
  }

  /**
   * Phase 18A — refuse to mint a unit-level access grant when the unit is
   * already sold/contracted/reserved. The broker would not be able to
   * reserve it anyway, so the grant would be misleading.
   *
   * Reactivating an existing grant on a previously-granted unit still
   * goes through `grantUnit` and lands here too; if the unit moved into a
   * blocked status since the original grant, we refuse the reactivation.
   * Revoking is unaffected.
   */
  private async assertUnitGrantable(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, status: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === 'SOLD') {
      throw new ConflictException(
        'Unit is already sold and cannot be granted to a broker',
      );
    }
    if (unit.status === 'RESERVED') {
      throw new ConflictException(
        'Unit is currently reserved. Wait for the reservation to clear before granting access.',
      );
    }
  }
}
