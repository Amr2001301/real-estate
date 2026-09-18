import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CalcInstallmentDto,
  CreateUnitDto,
  InventoryMatrixQueryDto,
  UnitQueryDto,
  UnitSort,
  UpdateUnitDto,
  UpdateUnitStatusDto,
} from './dto/unit.dto';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { PlanLimitService } from '../../common/capabilities/plan-limit.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitService,
  ) {}

  async create(dto: CreateUnitDto) {
    await this.planLimits.checkUnitLimit();
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
      ...(query.cityIn?.length
        ? { city: { in: query.cityIn } }
        : query.city
          ? { city: query.city }
          : {}),
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
      ...(query.typeIn?.length ? { type: { in: query.typeIn } } : query.type ? { type: query.type } : {}),
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
        building: {
          include: {
            phase: {
              include: {
                project: {
                  include: {
                    // First project image for use as hero fallback on unit detail.
                    media: { orderBy: { order: 'asc' }, take: 1 },
                  },
                },
              },
            },
          },
        },
        // History carries actor + reason and is admin-only; skip for public.
        ...(publicOnly ? {} : {
          history: { orderBy: { changedAt: 'desc' }, take: 10 },
          maintenanceItems: {
            where: { active: true },
            include: { category: { select: { name: true } } },
            orderBy: { createdAt: 'asc' as const },
          },
        }),
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

  async inventoryMatrix(query: InventoryMatrixQueryDto) {
    const pickName = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object') {
        const o = val as Record<string, string>;
        return o.ar ?? o.en ?? '';
      }
      return '';
    };
    const companyId = getRequiredCompanyId();

    const conditions: Prisma.Sql[] = [Prisma.sql`p."companyId" = ${companyId}::uuid`];
    if (query.projectId) {
      conditions.push(Prisma.sql`ph."projectId" = ${query.projectId}::uuid`);
    }
    if (query.q?.trim()) {
      const needle = `%${query.q.trim()}%`;
      conditions.push(
        Prisma.sql`(b.name ILIKE ${needle} OR p.name->>'ar' ILIKE ${needle} OR p.name->>'en' ILIKE ${needle})`,
      );
    }
    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    interface MatrixRow {
      projectId: string;
      projectName: unknown;
      projectCity: string | null;
      phaseId: string;
      phaseName: unknown;
      buildingId: string;
      buildingName: string;
      total: number;
      available: number;
      reserved: number;
      sold: number;
      valueAvailable: number;
      valueReserved: number;
      valueSold: number;
      totalValue: number;
    }

    const rows = await this.prisma.$queryRaw<MatrixRow[]>(Prisma.sql`
      SELECT
        p.id              AS "projectId",
        p.name            AS "projectName",
        p.city            AS "projectCity",
        ph.id             AS "phaseId",
        ph.name           AS "phaseName",
        b.id              AS "buildingId",
        b.name            AS "buildingName",
        COUNT(*)::int                                                             AS total,
        COUNT(*) FILTER (WHERE u.status = 'AVAILABLE')::int                      AS available,
        COUNT(*) FILTER (WHERE u.status = 'RESERVED')::int                       AS reserved,
        COUNT(*) FILTER (WHERE u.status = 'SOLD')::int                           AS sold,
        COALESCE(SUM(u.price) FILTER (WHERE u.status = 'AVAILABLE'), 0)::float8  AS "valueAvailable",
        COALESCE(SUM(u.price) FILTER (WHERE u.status = 'RESERVED'),  0)::float8  AS "valueReserved",
        COALESCE(SUM(u.price) FILTER (WHERE u.status = 'SOLD'),      0)::float8  AS "valueSold",
        COALESCE(SUM(u.price), 0)::float8                                        AS "totalValue"
      FROM "Unit" u
      JOIN "Building" b  ON b.id  = u."buildingId"
      JOIN "Phase"    ph ON ph.id = b."phaseId"
      JOIN "Project"  p  ON p.id  = ph."projectId"
      ${whereClause}
      GROUP BY p.id, p.name, p.city, ph.id, ph.name, b.id, b.name
      ORDER BY p.name->>'ar', ph.name->>'ar', b.name
    `);

    // Summary counts (always all statuses — used for KPI strip and status chips)
    const summary = rows.reduce(
      (acc, r) => ({
        available:  acc.available  + Number(r.available),
        reserved:   acc.reserved   + Number(r.reserved),
        sold:       acc.sold       + Number(r.sold),
        total:      acc.total      + Number(r.total),
        totalValue: acc.totalValue + Number(r.totalValue),
      }),
      { available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0 },
    );

    // Build nested Project → Phase → Building structure.
    // When a status filter is active, mask other-status counts to zero so the
    // matrix mirrors the previous client-side filter behaviour exactly.
    const statusKey = query.status as string | undefined;

    type PhaseBucket = {
      id: string; name: unknown;
      available: number; reserved: number; sold: number; total: number; totalValue: number;
      buildings: { id: string; name: string; available: number; reserved: number; sold: number; total: number; totalValue: number }[];
    };
    type ProjectBucket = {
      id: string; name: unknown; city: string | null;
      available: number; reserved: number; sold: number; total: number; totalValue: number;
      phases: Map<string, PhaseBucket>;
    };

    const projectMap = new Map<string, ProjectBucket>();

    for (const row of rows) {
      let av = Number(row.available);
      let rs = Number(row.reserved);
      let sl = Number(row.sold);
      let tv = Number(row.totalValue);

      if (statusKey === 'AVAILABLE') { rs = 0; sl = 0; tv = Number(row.valueAvailable); }
      else if (statusKey === 'RESERVED') { av = 0; sl = 0; tv = Number(row.valueReserved); }
      else if (statusKey === 'SOLD')     { av = 0; rs = 0; tv = Number(row.valueSold); }

      const tt = av + rs + sl;
      if (statusKey && tt === 0) continue; // building has none of the requested status

      let proj = projectMap.get(row.projectId);
      if (!proj) {
        proj = {
          id: row.projectId, name: pickName(row.projectName), city: row.projectCity,
          available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0, phases: new Map(),
        };
        projectMap.set(row.projectId, proj);
      }
      proj.available += av; proj.reserved += rs; proj.sold += sl;
      proj.total += tt;     proj.totalValue += tv;

      let phase = proj.phases.get(row.phaseId);
      if (!phase) {
        phase = {
          id: row.phaseId, name: pickName(row.phaseName),
          available: 0, reserved: 0, sold: 0, total: 0, totalValue: 0, buildings: [],
        };
        proj.phases.set(row.phaseId, phase);
      }
      phase.available += av; phase.reserved += rs; phase.sold += sl;
      phase.total += tt;     phase.totalValue += tv;
      phase.buildings.push({ id: row.buildingId, name: row.buildingName, available: av, reserved: rs, sold: sl, total: tt, totalValue: tv });
    }

    const projects = [...projectMap.values()].map((p) => ({ ...p, phases: [...p.phases.values()] }));
    return { summary, projects };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Unit not found');
  }
}
