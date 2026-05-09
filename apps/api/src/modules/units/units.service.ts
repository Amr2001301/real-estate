import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateUnitDto,
  UnitQueryDto,
  UpdateUnitDto,
  UpdateUnitStatusDto,
  CalcInstallmentDto,
} from './dto/unit.dto';
import { paginate, takeSkip } from '../../common/utils/pagination';

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

    const where: Prisma.UnitWhereInput = {
      ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      ...(query.projectId
        ? { building: { phase: { projectId: query.projectId } } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(publicOnly
        ? {
            building: {
              phase: { project: { status: 'PUBLISHED' } },
              ...(query.projectId ? { phase: { projectId: query.projectId } } : {}),
            },
          }
        : {}),
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
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: [{ status: 'asc' }, { price: 'asc' }],
        include: {
          media: { orderBy: { order: 'asc' }, take: 1 },
          building: { include: { phase: { include: { project: true } } } },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string, publicOnly = false) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        media: { orderBy: { order: 'asc' } },
        building: { include: { phase: { include: { project: true } } } },
        history: { orderBy: { changedAt: 'desc' }, take: 10 },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    if (publicOnly && unit.building.phase.project.status !== 'PUBLISHED') {
      throw new NotFoundException('Unit not found');
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
