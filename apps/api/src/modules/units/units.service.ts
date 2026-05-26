import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateUnitDto,
  UnitQueryDto,
  UnitSort,
  UpdateUnitDto,
  UpdateUnitStatusDto,
  CalcInstallmentDto,
} from './dto/unit.dto';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { serializePublicUnit } from './public-unit.serializer';

/**
 * Map a whitelisted UnitSort to a Prisma orderBy. Each adds a stable `id`
 * tiebreaker for deterministic pagination. No sort → the existing default
 * (available first, then cheapest) is preserved.
 */
function unitOrderBy(sort?: UnitSort): Prisma.UnitOrderByWithRelationInput[] {
  switch (sort) {
    case UnitSort.newest:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case UnitSort.price_asc:
      return [{ price: 'asc' }, { id: 'asc' }];
    case UnitSort.price_desc:
      return [{ price: 'desc' }, { id: 'asc' }];
    case UnitSort.area_asc:
      return [{ area: 'asc' }, { id: 'asc' }];
    case UnitSort.area_desc:
      return [{ area: 'desc' }, { id: 'asc' }];
    case UnitSort.bedrooms_asc:
      return [{ bedrooms: 'asc' }, { id: 'asc' }];
    case UnitSort.bedrooms_desc:
      return [{ bedrooms: 'desc' }, { id: 'asc' }];
    default:
      return [{ status: 'asc' }, { price: 'asc' }];
  }
}

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        buildingId: dto.buildingId,
        code: dto.code,
        type: dto.type,
        area: dto.area,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        floor: dto.floor,
        price: new Prisma.Decimal(dto.price),
        status: dto.status ?? UnitStatus.AVAILABLE,
      },
    });
  }

  async findAll(query: UnitQueryDto, publicOnly = false) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);

    // Build the building → phase → project filter in one place so that
    // projectId, city, and the public PUBLISHED constraint compose correctly
    // (the previous spread form could overwrite `phase`).
    const projectWhere: Prisma.ProjectWhereInput = {
      ...(publicOnly ? { status: 'PUBLISHED' } : {}),
      ...(query.city ? { city: query.city } : {}),
    };
    const phaseWhere: Prisma.PhaseWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(Object.keys(projectWhere).length ? { project: projectWhere } : {}),
    };
    const buildingWhere: Prisma.BuildingWhereInput | undefined = Object.keys(phaseWhere).length
      ? { phase: phaseWhere }
      : undefined;

    const where: Prisma.UnitWhereInput = {
      ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      ...(buildingWhere ? { building: buildingWhere } : {}),
      // Public listing defaults to AVAILABLE; an explicit status filter (any
      // UnitStatus is a public-safe label) may override it.
      ...(query.status
        ? { status: query.status }
        : publicOnly
          ? { status: UnitStatus.AVAILABLE }
          : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.bathrooms !== undefined ? { bathrooms: query.bathrooms } : {}),
      ...(query.priceMin !== undefined || query.priceMax !== undefined
        ? {
            price: {
              ...(query.priceMin !== undefined ? { gte: new Prisma.Decimal(query.priceMin) } : {}),
              ...(query.priceMax !== undefined ? { lte: new Prisma.Decimal(query.priceMax) } : {}),
            },
          }
        : {}),
      ...(query.areaMin !== undefined || query.areaMax !== undefined
        ? {
            area: {
              ...(query.areaMin !== undefined ? { gte: query.areaMin } : {}),
              ...(query.areaMax !== undefined ? { lte: query.areaMax } : {}),
            },
          }
        : {}),
      ...(query.bedrooms !== undefined ? { bedrooms: query.bedrooms } : {}),
      ...(query.withoutPlan ? { planTemplates: { none: {} } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: unitOrderBy(query.sort),
        include: {
          media: { orderBy: { order: 'asc' }, take: 1 },
          building: { include: { phase: { include: { project: true } } } },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);

    if (publicOnly) {
      const serialized = data.map((u) =>
        serializePublicUnit({ ...u, project: u.building.phase.project }),
      );
      return paginate(serialized, total, { page, pageSize });
    }

    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string, publicOnly = false) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        media: { orderBy: { order: 'asc' } },
        building: { include: { phase: { include: { project: true } } } },
        // History carries actor + reason and is admin-only; skip for public.
        ...(publicOnly ? {} : { history: { orderBy: { changedAt: 'desc' }, take: 10 } }),
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (publicOnly && unit.building.phase.project.status !== 'PUBLISHED') {
      throw new NotFoundException('Unit not found');
    }
    if (publicOnly) {
      return serializePublicUnit({ ...unit, project: unit.building.phase.project });
    }
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.assertExists(id);
    const data: Prisma.UnitUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.area !== undefined) data.area = dto.area;
    if (dto.bedrooms !== undefined) data.bedrooms = dto.bedrooms;
    if (dto.bathrooms !== undefined) data.bathrooms = dto.bathrooms;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.unit.update({ where: { id }, data });
  }

  async setStatus(id: string, dto: UpdateUnitStatusDto, changedById?: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === dto.status) return unit;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id },
        data: {
          status: dto.status,
          reservationExpiresAt: dto.status === UnitStatus.RESERVED ? unit.reservationExpiresAt : null,
        },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId: id,
          oldStatus: unit.status,
          newStatus: dto.status,
          changedById: changedById ?? null,
          reason: dto.reason ?? null,
        },
      });
      return updated;
    });
  }

  async remove(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === UnitStatus.SOLD) {
      throw new BadRequestException('Cannot delete a SOLD unit');
    }

    const [reservations, contracts, maintenance] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where: { unitId: id } }),
      this.prisma.contract.count({ where: { unitId: id } }),
      this.prisma.maintenanceRequest.count({ where: { unitId: id } }),
    ]);

    const blockers: string[] = [];
    if (reservations > 0) blockers.push(`${reservations} حجز`);
    if (contracts > 0) blockers.push(`${contracts} عقد`);
    if (maintenance > 0) blockers.push(`${maintenance} طلب صيانة`);

    if (blockers.length > 0) {
      throw new ConflictException(
        `لا يمكن حذف الوحدة لأنها مرتبطة بـ: ${blockers.join('، ')}. يجب إلغاء أو نقل هذه السجلات أولاً.`,
      );
    }

    return this.prisma.unit.delete({ where: { id } });
  }

  calcInstallment(dto: CalcInstallmentDto) {
    const remaining = dto.totalPrice - dto.downPayment;
    if (remaining < 0) throw new BadRequestException('Down payment exceeds total price');
    const monthlyAmount = Math.round((remaining / dto.totalMonths) * 100) / 100;
    const schedule: Array<{ month: number; amount: number; cumulative: number }> = [];
    let cumulative = dto.downPayment;
    for (let m = 1; m <= dto.totalMonths; m++) {
      cumulative = Math.round((cumulative + monthlyAmount) * 100) / 100;
      schedule.push({ month: m, amount: monthlyAmount, cumulative });
    }
    return { monthlyAmount, schedule };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Unit not found');
  }
}
