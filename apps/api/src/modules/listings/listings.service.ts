import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingKind, ListingStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { paginate, takeSkip, toCounts } from '../../common/utils/pagination';
import { R2Service } from '../media/r2.service';
import { UnitTypesService } from '../units/unit-types.service';
import { CreateListingDto, ListingPhotoPresignDto, UpdateListingDto } from './dto/listing.dto';

export interface ListingQuery {
  kind?: ListingKind[];
  status?: ListingStatus[];
  q?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const AGENT = { select: { id: true, fullName: true, phone: true } } as const;

/**
 * BRK-2 — a brokerage company's listings: what it sells for developers
 * (primary), resells for owners, and rents out. Every query runs inside the
 * tenant context, so the Prisma middleware scopes it to the caller's company.
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitTypes: UnitTypesService,
    private readonly r2: R2Service,
  ) {}

  async list(query: ListingQuery) {
    const q = query.q?.trim();
    const base: Prisma.ListingWhereInput = {
      ...(query.agentId ? { agentId: query.agentId } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { district: { contains: q, mode: 'insensitive' } },
              { compound: { contains: q, mode: 'insensitive' } },
              { projectName: { contains: q, mode: 'insensitive' } },
              { developerName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where: Prisma.ListingWhereInput = {
      ...base,
      ...(query.kind?.length ? { kind: { in: query.kind } } : {}),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
    };
    const p = { page: query.page ?? 1, pageSize: query.pageSize ?? 24 };
    const [data, total, byKind, byStatus] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        ...takeSkip(p),
        include: { agent: AGENT },
      }),
      this.prisma.listing.count({ where }),
      // The kind tabs count within the other filters; the status chips within the kind.
      this.prisma.listing.groupBy({
        by: ['kind'],
        where: { ...base, ...(query.status?.length ? { status: { in: query.status } } : {}) },
        _count: true,
      }),
      this.prisma.listing.groupBy({
        by: ['status'],
        where: { ...base, ...(query.kind?.length ? { kind: { in: query.kind } } : {}) },
        _count: true,
      }),
    ]);
    return paginate(data, total, p, {
      counts: {
        kind: toCounts(byKind.map((g) => [String(g.kind), g._count] as const)),
        status: toCounts(byStatus.map((g) => [String(g.status), g._count] as const)),
      },
    });
  }

  async get(id: string) {
    const listing = await this.prisma.listing.findFirst({ where: { id }, include: { agent: AGENT } });
    if (!listing) throw new NotFoundException('الوحدة غير موجودة');
    return listing;
  }

  async create(dto: CreateListingDto, userId: string) {
    const type = await this.unitTypes.resolveActive(dto.unitType);
    if (dto.agentId) await this.assertAgent(dto.agentId);
    this.assertMoney(dto.kind, dto.price, dto.downPayment);

    const data = {
      kind: dto.kind,
      title: dto.title.trim(),
      unitType: type.code,
      usage: dto.usage ?? type.usage,
      city: dto.city.trim(),
      district: clean(dto.district),
      compound: clean(dto.compound),
      address: clean(dto.address),
      developerName: clean(dto.developerName),
      projectName: clean(dto.projectName),
      area: dto.area,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      floor: dto.floor ?? null,
      finishing: dto.finishing ?? null,
      view: dto.view ?? null,
      price: new Prisma.Decimal(dto.price),
      downPayment: dto.downPayment !== undefined ? new Prisma.Decimal(dto.downPayment) : null,
      deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
      description: clean(dto.description),
      ownerName: clean(dto.ownerName),
      ownerPhone: clean(dto.ownerPhone),
      photos: dto.photos ?? [],
      agentId: dto.agentId ?? null,
      createdById: userId,
    };

    // The next code in the company (L-0001…); two saves at once can pick the
    // same one — the unique index refuses the second, which tries the next.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = await this.nextCode();
      try {
        return await this.prisma.listing.create({ data: { ...data, code }, include: { agent: AGENT } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }
    throw new BadRequestException('تعذّر حفظ الوحدة، حاول مرة أخرى');
  }

  async update(id: string, dto: UpdateListingDto) {
    const current = await this.get(id);
    const type = dto.unitType !== undefined ? await this.unitTypes.resolveActive(dto.unitType) : null;
    if (dto.agentId) await this.assertAgent(dto.agentId);
    const price = dto.price ?? Number(current.price);
    const down = dto.downPayment === undefined ? (current.downPayment === null ? undefined : Number(current.downPayment)) : dto.downPayment ?? undefined;
    this.assertMoney(current.kind, price, down);
    if (current.kind === ListingKind.PRIMARY && dto.developerName !== undefined && !clean(dto.developerName)) {
      throw new BadRequestException('اسم المطوّر مطلوب لوحدة البيع الأولي');
    }

    const data: Prisma.ListingUncheckedUpdateManyInput = {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(type ? { unitType: type.code, usage: dto.usage ?? type.usage } : dto.usage ? { usage: dto.usage } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...optional('district', dto.district),
      ...optional('compound', dto.compound),
      ...optional('address', dto.address),
      ...optional('developerName', dto.developerName),
      ...optional('projectName', dto.projectName),
      ...optional('description', dto.description),
      ...optional('ownerName', dto.ownerName),
      ...optional('ownerPhone', dto.ownerPhone),
      ...(dto.area !== undefined ? { area: dto.area } : {}),
      ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
      ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
      ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
      ...(dto.finishing !== undefined ? { finishing: dto.finishing } : {}),
      ...(dto.view !== undefined ? { view: dto.view } : {}),
      ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
      ...(dto.downPayment !== undefined ? { downPayment: dto.downPayment === null ? null : new Prisma.Decimal(dto.downPayment) } : {}),
      ...(dto.deliveryDate !== undefined ? { deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null } : {}),
      ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
      ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
    };
    // updateMany keeps the company scope on the write itself.
    await this.prisma.listing.updateMany({ where: { id }, data });
    return this.get(id);
  }

  async setStatus(id: string, status: ListingStatus) {
    await this.get(id);
    await this.prisma.listing.updateMany({ where: { id }, data: { status } });
    return this.get(id);
  }

  async remove(id: string) {
    const { count } = await this.prisma.listing.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('الوحدة غير موجودة');
    return { id };
  }

  presignPhoto(dto: ListingPhotoPresignDto) {
    if (dto.sizeBytes > MAX_PHOTO_BYTES) throw new BadRequestException('حجم الصورة أكبر من 10 ميجابايت');
    return this.r2.createPresignedUpload({
      contentType: dto.contentType,
      folder: 'listings',
      extension: dto.extension,
      sizeBytes: dto.sizeBytes,
    });
  }

  /** The agent must be a sales-side staff member of this company. */
  private async assertAgent(agentId: string) {
    const agent = await findTenantUser(this.prisma, agentId, { id: true, role: true });
    const staff: UserRole[] = [UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES];
    if (!agent || !staff.includes(agent.role)) throw new BadRequestException('الموظف المسؤول غير موجود');
  }

  private assertMoney(kind: ListingKind, price: number, downPayment?: number) {
    if (downPayment === undefined) return;
    if (kind === ListingKind.RENT) throw new BadRequestException('لا مقدم لوحدة إيجار');
    if (downPayment > price) throw new BadRequestException('المقدم أكبر من السعر');
  }

  /** One past the company's highest L-number. */
  private async nextCode(): Promise<string> {
    const rows = await this.prisma.listing.findMany({ select: { code: true } });
    const max = rows.reduce((m, r) => Math.max(m, Number(/^L-(\d+)$/.exec(r.code)?.[1] ?? 0)), 0);
    return `L-${String(max + 1).padStart(4, '0')}`;
  }
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function optional<K extends string>(key: K, v: string | null | undefined): Partial<Record<K, string | null>> {
  if (v === undefined) return {};
  return { [key]: clean(v) } as Record<K, string | null>;
}
