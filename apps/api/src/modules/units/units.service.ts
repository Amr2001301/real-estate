import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, ReservationStatus, UnitStatus, UnitUsage } from '@prisma/client';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CalcInstallmentDto,
  CreateUnitDto,
  InventoryMatrixQueryDto,
  RepriceUnitsDto,
  UnitQueryDto,
  UnitSort,
  UpdateUnitDto,
  UpdateUnitStatusDto,
} from './dto/unit.dto';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { PlanLimitService } from '../../common/capabilities/plan-limit.service';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { serializePublicUnit } from './public-unit.serializer';
import { UnitTypesService } from './unit-types.service';
import { UnitModelsService } from './unit-models.service';
import { arText, collectPages, isoDate, listCsv, listXlsx, type ListColumn } from '../../common/utils/list-export';
import { ReportBrandService } from '../company-branding/report-brand.service';
import { resetUnitWarranties } from '../contracts/unit-warranties';
import { dateOnlyString, toDateOnly } from '../../common/time/date-only';

/** A unit's handover date: its own, or its phase's (F10). */
function effectiveDelivery(unit: { deliveryDate: Date | null; building?: { phase?: { deliveryDate: Date | null } } }) {
  return dateOnlyString(unit.deliveryDate ?? unit.building?.phase?.deliveryDate ?? null);
}

/** A unit priced by the meter: the price per meter × its gross area. */
export function meterPrice(pricePerMeter: Prisma.Decimal.Value, area: number): Prisma.Decimal {
  return new Prisma.Decimal(pricePerMeter).mul(area).toDecimalPlaces(2);
}

const NOT_PRICED = 'أدخل سعر الوحدة أو سعر المتر';

/** The unit's specs (F10): written as sent, null clears one. */
const SPEC_FIELDS = [
  'netArea',
  'gardenArea',
  'roofArea',
  'terraceArea',
  'landArea',
  'finishing',
  'view',
  'orientation',
] as const satisfies ReadonlyArray<keyof CreateUnitDto & keyof UpdateUnitDto>;

function specData(dto: CreateUnitDto | UpdateUnitDto) {
  const data: Partial<Record<(typeof SPEC_FIELDS)[number], unknown>> = {};
  for (const f of SPEC_FIELDS) if (dto[f] !== undefined) data[f] = dto[f];
  return data as Pick<Prisma.UnitUncheckedCreateInput, (typeof SPEC_FIELDS)[number]>;
}

/** The fields of a listed unit the export reads (findAll includes the rest). */
type UnitExportRow = {
  code: string;
  type: string;
  floor: number;
  area: number | { toString(): string };
  bedrooms: number;
  bathrooms: number;
  price: number | { toString(): string };
  status: string;
  createdAt: Date;
  building?: { name: unknown; phase?: { project?: { name: unknown } } };
};

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
    // Optional so unit tests can build the service without it.
    @Optional() private readonly reportBrand?: ReportBrandService,
    @Optional() unitTypes?: UnitTypesService,
    @Optional() unitModels?: UnitModelsService,
  ) {
    this.unitTypes = unitTypes ?? new UnitTypesService(prisma);
    this.unitModels = unitModels ?? new UnitModelsService(prisma, this.unitTypes);
  }

  private readonly unitTypes: UnitTypesService;
  private readonly unitModels: UnitModelsService;

  // ── List export (the admin units / inventory pages) ─────────────────────

  private static readonly STATUS_AR: Record<string, string> = {
    AVAILABLE: 'متاحة',
    RESERVED: 'محجوزة',
    SOLD: 'مباعة',
  };

  private static readonly EXPORT_COLUMNS: ListColumn<UnitExportRow>[] = [
    { header: 'المشروع', width: 26, value: (u) => arText(u.building?.phase?.project?.name) },
    { header: 'المبنى', width: 18, value: (u) => arText(u.building?.name) },
    { header: 'كود الوحدة', width: 14, value: (u) => u.code },
    { header: 'النوع', width: 14, value: (u) => u.type },
    { header: 'الطابق', width: 8, value: (u) => u.floor },
    { header: 'المساحة (م²)', width: 12, value: (u) => Number(u.area) },
    { header: 'غرف النوم', width: 10, value: (u) => u.bedrooms },
    { header: 'الحمامات', width: 10, value: (u) => u.bathrooms },
    { header: 'السعر', width: 16, value: (u) => Number(u.price), money: true },
    { header: 'الحالة', width: 12, value: (u) => UnitsService.STATUS_AR[u.status] ?? u.status },
    { header: 'تاريخ الإضافة', width: 14, value: (u) => isoDate(u.createdAt) },
  ];

  /** Every unit matching the list filters (no paging). */
  private async exportRows(query: UnitQueryDto): Promise<UnitExportRow[]> {
    return collectPages((page, pageSize) =>
      this.findAll({ ...query, page, pageSize }) as Promise<{ data: UnitExportRow[] }>,
    );
  }

  async exportXlsx(query: UnitQueryDto): Promise<Buffer> {
    const [rows, brand] = await Promise.all([
      this.exportRows(query),
      this.reportBrand?.forCompany(getRequiredCompanyId()),
    ]);
    return listXlsx({
      title: 'قائمة الوحدات',
      sheet: 'الوحدات',
      filters: [
        ['الحالة', query.status ? (UnitsService.STATUS_AR[query.status] ?? query.status) : ''],
        ['بحث', query.q ?? ''],
      ],
      columns: UnitsService.EXPORT_COLUMNS,
      rows,
      brand,
    });
  }

  async exportCsv(query: UnitQueryDto): Promise<string> {
    return listCsv(UnitsService.EXPORT_COLUMNS, await this.exportRows(query));
  }

  async create(dto: CreateUnitDto) {
    await this.planLimits.checkUnitLimit();
    // The parent id comes from the client: it must be this company's building.
    const building = await this.prisma.building.findFirst({ where: { id: dto.buildingId }, select: { id: true } });
    if (!building) throw new NotFoundException('Building not found');
    // A new unit is for sale. SOLD comes from a contract — a sale made
    // before the system is entered as a contract with its own number and
    // signing date — and RESERVED from a reservation: a unit created SOLD
    // showed in inventory and reports as a sale nobody made.
    if (dto.status === UnitStatus.RESERVED) {
      throw new BadRequestException('الحجز يتم من شاشة الحجوزات — لا يمكن إنشاء وحدة محجوزة');
    }
    if (dto.status === UnitStatus.SOLD) {
      throw new BadRequestException('البيع يتم بعقد — سجّل العقد (ولو مُبرماً قبل النظام) لتصبح الوحدة مباعة');
    }
    // The type is one of the company's (F10); its usage comes with it, and
    // only a residential unit has bedrooms.
    const type = await this.unitTypes.resolveActive(dto.type);
    // Priced by the meter, or as a whole.
    const pricePerMeter = dto.pricePerMeter ?? null;
    if (pricePerMeter === null && dto.price === undefined) throw new BadRequestException(NOT_PRICED);
    const price = pricePerMeter !== null ? meterPrice(pricePerMeter, dto.area) : new Prisma.Decimal(dto.price!);
    // Entered from one of its project's models (F10).
    const model = dto.modelId ? await this.unitModels.forUnit(dto.modelId, dto.buildingId) : null;
    const created = await this.prisma.unit.create({
      data: {
        buildingId: dto.buildingId,
        code: dto.code,
        type: type.code,
        usage: type.usage,
        area: dto.area,
        bedrooms: type.usage === UnitUsage.RESIDENTIAL ? dto.bedrooms : 0,
        bathrooms: dto.bathrooms,
        floor: dto.floor,
        price,
        pricePerMeter,
        modelId: model?.id ?? null,
        deliveryDate: toDateOnly(dto.deliveryDate) ?? null,
        status: dto.status ?? UnitStatus.AVAILABLE,
        ...specData(dto),
      },
    });
    return created;
  }

  /** Live reservations and contracts on the unit. */
  private async liveDeals(unitId: string): Promise<number> {
    const [reservations, contracts] = await Promise.all([
      this.prisma.reservation.count({
        where: { unitId, deletedAt: null, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
      }),
      this.prisma.contract.count({ where: { unitId, ...LIVE_CONTRACT_WHERE } }),
    ]);
    return reservations + contracts;
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
      // Any case: a link written before the types had codes ("?type=office").
      ...(query.typeIn?.length
        ? { type: { in: query.typeIn } }
        : query.type
          ? { type: { equals: query.type, mode: 'insensitive' as const } }
          : {}),
      ...(query.usage ? { usage: query.usage } : {}),
      ...(query.modelId ? { modelId: query.modelId } : {}),
      // Handed over by then: the unit's own date, or (none) its phase's.
      ...(query.deliveryBy
        ? {
            OR: [
              { deliveryDate: { lte: toDateOnly(query.deliveryBy)! } },
              { deliveryDate: null, building: { phase: { deliveryDate: { lte: toDateOnly(query.deliveryBy)! } } } },
            ],
          }
        : {}),
      ...(query.finishing ? { finishing: query.finishing } : {}),
      ...(query.view ? { view: query.view } : {}),
      ...(query.orientation ? { orientation: query.orientation } : {}),
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
      ...(query.q?.trim() ? { code: { contains: query.q.trim(), mode: 'insensitive' } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: unitOrderBy(query.sort),
        include: {
          media: { orderBy: { order: 'asc' }, take: 1 },
          building: { include: { phase: { include: { project: true } } } },
          model: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);

    // Each unit's type by its name (the company's list), not its code.
    const typeNames = await this.unitTypes.names();
    if (publicOnly) {
      // No facets here: summed prices and per-status counts would give anyone
      // the company's sales volume (?status=SOLD) — they are staff KPIs.
      const serialized = data.map((u) =>
        serializePublicUnit({
          ...u,
          project: u.building.phase.project,
          typeName: typeNames.get(u.type) ?? null,
          effectiveDeliveryDate: effectiveDelivery(u),
        }),
      );
      return paginate(serialized, total, { page, pageSize });
    }

    // Facets — computed over the whole filtered set, not the returned page, so
    // the admin KPI strip stays correct at any page size. FG-23.
    //
    // Deliberately outside the $transaction above: Prisma's groupBy relies on
    // heavy generic inference that degrades inside a $transaction array
    // literal, and these are independent read-only aggregates that gain
    // nothing from sharing the snapshot.
    const [statusGroups, priceAgg] = await Promise.all([
      this.prisma.unit.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.unit.aggregate({ where, _sum: { price: true } }),
    ]);

    const facets = {
      counts: {
        status: toCounts(statusGroups.map((g) => [String(g.status), g._count] as const)),
      },
      sums: {
        // Decimal → string, matching how money is serialised elsewhere in this
        // API. _sum is null when the filtered set is empty.
        price: (priceAgg._sum.price ?? new Prisma.Decimal(0)).toString(),
      },
    };

    return paginate(
      data.map((u) => ({ ...u, typeName: typeNames.get(u.type) ?? null, effectiveDeliveryDate: effectiveDelivery(u) })),
      total,
      { page, pageSize },
      facets,
    );
  }

  async findOne(id: string, publicOnly = false) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        media: { orderBy: { order: 'asc' } },
        model: { select: { id: true, code: true, name: true } },
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
    const typeName = (await this.unitTypes.names()).get(unit.type) ?? null;
    const effectiveDeliveryDate = effectiveDelivery(unit);
    if (publicOnly) {
      return serializePublicUnit({ ...unit, project: unit.building.phase.project, typeName, effectiveDeliveryDate });
    }
    return { ...unit, typeName, effectiveDeliveryDate };
  }

  async update(id: string, dto: UpdateUnitDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    // A new type must be one of the company's, switched on; the same type
    // written differently ("villa" for "Villa") is no change.
    const newType =
      dto.type !== undefined && dto.type.trim().toLowerCase() !== unit.type.toLowerCase()
        ? await this.unitTypes.resolveActive(dto.type)
        : null;
    const usage = newType?.usage ?? unit.usage;
    // Priced by the meter, the price follows the price per meter and the
    // gross area; a whole price sent for it is refused (it would be lost).
    const currentPpm = unit.pricePerMeter ?? null;
    const pricePerMeter = dto.pricePerMeter !== undefined ? dto.pricePerMeter : currentPpm;
    let price: Prisma.Decimal | undefined;
    if (pricePerMeter !== null) {
      price = meterPrice(pricePerMeter, dto.area ?? unit.area);
      if (dto.price !== undefined && !new Prisma.Decimal(dto.price).equals(price)) {
        throw new BadRequestException('الوحدة مسعّرة بالمتر — عدّل سعر المتر أو امسحه لتحديد سعر إجمالي');
      }
    } else if (dto.price !== undefined) {
      price = new Prisma.Decimal(dto.price);
    } else if (dto.pricePerMeter === null && currentPpm !== null) {
      throw new BadRequestException(NOT_PRICED);
    }
    const ppmChanged =
      dto.pricePerMeter !== undefined &&
      (dto.pricePerMeter === null || currentPpm === null
        ? dto.pricePerMeter !== currentPpm
        : !new Prisma.Decimal(dto.pricePerMeter).equals(currentPpm));
    const bedrooms = usage === UnitUsage.RESIDENTIAL ? dto.bedrooms : dto.bedrooms !== undefined || newType ? 0 : undefined;
    // A unit in a live deal keeps what was sold: its price, areas, type,
    // specs, floor and code are the deal's. Changing them rewrote the customer's contract
    // and portal with nothing on record. (Unchanged values pass — the edit
    // form sends every field.)
    const changed = [
      dto.code !== undefined && dto.code !== unit.code,
      newType !== null && newType.code !== unit.type,
      dto.area !== undefined && dto.area !== Number(unit.area),
      bedrooms !== undefined && bedrooms !== unit.bedrooms,
      dto.bathrooms !== undefined && dto.bathrooms !== unit.bathrooms,
      dto.floor !== undefined && dto.floor !== unit.floor,
      price !== undefined && !price.equals(unit.price),
      ppmChanged,
      ...SPEC_FIELDS.map((f) => dto[f] !== undefined && dto[f] !== unit[f]),
    ].some(Boolean);
    if (changed && (await this.liveDeals(id)) > 0) {
      throw new ConflictException('الوحدة عليها حجز أو عقد قائم — لا يمكن تعديل بياناتها أو سعرها');
    }
    const data: Prisma.UnitUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (newType) {
      data.type = newType.code;
      data.usage = newType.usage;
    }
    if (dto.area !== undefined) data.area = dto.area;
    if (bedrooms !== undefined) data.bedrooms = bedrooms;
    if (dto.bathrooms !== undefined) data.bathrooms = dto.bathrooms;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (price !== undefined) data.price = price;
    if (dto.pricePerMeter !== undefined) data.pricePerMeter = dto.pricePerMeter;
    if (dto.deliveryDate !== undefined) data.deliveryDate = toDateOnly(dto.deliveryDate);
    // The model (F10): one of the unit's project's; the one it has passes
    // even if switched off since.
    if (dto.modelId !== undefined && dto.modelId !== unit.modelId) {
      data.model = dto.modelId
        ? { connect: { id: (await this.unitModels.forUnit(dto.modelId, unit.buildingId)).id } }
        : { disconnect: true };
    }
    Object.assign(data, specData(dto));
    return this.prisma.unit.update({ where: { id }, data });
  }

  /**
   * Reprice by the meter every unit for sale in a project, phase or building
   * (F10): price = price per meter × gross area. A unit reserved, sold or
   * held by a live reservation or contract keeps its price — the deal's.
   * A unit's own price plan is then stale (booking refuses it until it is
   * updated); the count is returned so the admin knows.
   */
  async reprice(dto: RepriceUnitsDto) {
    const companyId = getRequiredCompanyId();
    if (!dto.projectId && !dto.phaseId && !dto.buildingId) {
      throw new BadRequestException('اختر مشروعاً أو مرحلة أو مبنى');
    }
    // The scope ids come from the client: they must be this company's.
    const [project, phase, building] = await Promise.all([
      dto.projectId ? this.prisma.project.findFirst({ where: { id: dto.projectId, companyId }, select: { id: true } }) : true,
      dto.phaseId ? this.prisma.phase.findFirst({ where: { id: dto.phaseId, companyId }, select: { id: true } }) : true,
      dto.buildingId ? this.prisma.building.findFirst({ where: { id: dto.buildingId, companyId }, select: { id: true } }) : true,
    ]);
    if (!project || !phase || !building) throw new NotFoundException('المشروع أو المرحلة أو المبنى غير موجود');

    const scope: Prisma.UnitWhereInput = {
      companyId,
      ...(dto.buildingId ? { buildingId: dto.buildingId } : {}),
      ...(dto.phaseId || dto.projectId
        ? {
            building: {
              ...(dto.phaseId ? { phaseId: dto.phaseId } : {}),
              ...(dto.projectId ? { phase: { projectId: dto.projectId } } : {}),
            },
          }
        : {}),
      ...(dto.type ? { type: { equals: dto.type, mode: 'insensitive' as const } } : {}),
    };
    const forSale: Prisma.UnitWhereInput = {
      ...scope,
      status: UnitStatus.AVAILABLE,
      reservations: {
        none: { deletedAt: null, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
      },
      contracts: { none: LIVE_CONTRACT_WHERE },
    };
    const [units, inScope] = await Promise.all([
      this.prisma.unit.findMany({ where: forSale, select: { id: true, area: true } }),
      this.prisma.unit.count({ where: scope }),
    ]);
    const ids = units.map((u) => u.id);
    const stalePlans = ids.length
      ? await this.prisma.installmentPlanTemplate.count({ where: { companyId, unitId: { in: ids } } })
      : 0;
    const summary = { updated: units.length, kept: inScope - units.length, stalePlans };
    if (dto.dryRun || units.length === 0) return summary;

    await this.prisma.$transaction(
      units.map((u) =>
        this.prisma.unit.updateMany({
          // Still for sale when written (a booking made meanwhile keeps its price).
          where: { id: u.id, companyId, status: UnitStatus.AVAILABLE },
          data: { pricePerMeter: new Prisma.Decimal(dto.pricePerMeter), price: meterPrice(dto.pricePerMeter, u.area) },
        }),
      ),
    );
    return summary;
  }

  async setStatus(id: string, dto: UpdateUnitStatusDto, changedById?: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === dto.status) return unit;

    return this.prisma.$transaction(async (tx) => {
      // A unit held by a live deal keeps its status: setting it AVAILABLE
      // let a second reservation or contract take a unit already sold or
      // reserved. The deal's own flow (cancel) is what frees it.
      const liveContract = await tx.contract.count({ where: { unitId: id, ...LIVE_CONTRACT_WHERE } });
      if (liveContract > 0 && dto.status !== UnitStatus.SOLD) {
        throw new ConflictException('على الوحدة عقد قائم — ألغِ العقد أولاً لتغيير حالتها');
      }
      const liveReservation = await tx.reservation.count({
        where: {
          unitId: id,
          deletedAt: null,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        },
      });
      if (liveReservation > 0 && liveContract === 0 && dto.status !== UnitStatus.RESERVED) {
        throw new ConflictException('على الوحدة حجز قائم — ألغِ الحجز أولاً لتغيير حالتها');
      }
      // Without a deal: RESERVED belongs to a reservation (which carries the
      // client and an expiry — a hand-set one never expires), and SOLD to a
      // contract (a sale made before the system is entered as one): marked
      // sold by hand, the unit showed as a sale nobody made.
      if (liveContract === 0 && liveReservation === 0) {
        if (dto.status === UnitStatus.RESERVED) {
          throw new BadRequestException('الحجز يتم من شاشة الحجوزات — لا يمكن تعليم الوحدة محجوزة يدوياً');
        }
        if (dto.status === UnitStatus.SOLD) {
          throw new BadRequestException('البيع يتم بعقد — سجّل العقد (ولو مُبرماً قبل النظام) لتصبح الوحدة مباعة');
        }
      }
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
      // Back on sale after a cancelled sale: the previous buyer's warranties
      // are cleared, as releaseUnit does — otherwise the next buyer's signing
      // skips the started items and inherits the old (shorter) dates.
      if (unit.status === UnitStatus.SOLD && liveContract === 0) {
        await resetUnitWarranties(tx, id);
      }
      return updated;
    });
  }

  async remove(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (unit.status === UnitStatus.SOLD) {
      throw new BadRequestException('Cannot delete a SOLD unit');
    }

    const [reservations, contracts, maintenance, planTemplates] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where: { unitId: id } }),
      this.prisma.contract.count({ where: { unitId: id } }),
      this.prisma.maintenanceRequest.count({ where: { unitId: id } }),
      // A unit's price plan would survive the delete with no unit (the link is
      // SET NULL) and turn into a plan for the whole project — at this unit's
      // price, bookable on any other unit.
      this.prisma.installmentPlanTemplate.count({ where: { unitId: id } }),
    ]);

    const blockers: string[] = [];
    if (reservations > 0) blockers.push(`${reservations} حجز`);
    if (planTemplates > 0) blockers.push(`${planTemplates} خطة أسعار`);
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

    // Units, buildings and phases carry their own companyId: a row hung under
    // another company's project must not count here.
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."companyId" = ${companyId}::uuid`,
      Prisma.sql`u."companyId" = ${companyId}::uuid`,
      Prisma.sql`b."companyId" = ${companyId}::uuid`,
      Prisma.sql`ph."companyId" = ${companyId}::uuid`,
    ];
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
