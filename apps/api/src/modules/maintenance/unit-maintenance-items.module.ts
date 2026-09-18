import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Prisma, UserRole, WarrantyStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';

class CreateMaintenanceItemDto {
  @IsString() @MinLength(1) ar!: string;
  @IsString() @MinLength(1) en!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsDateString() warrantyStart?: string;
  @IsOptional() @IsDateString() warrantyEnd?: string;
  @IsOptional() @IsString() @MaxLength(200) supplierName?: string;
  @IsOptional() @IsString() @MaxLength(200) contractorName?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateMaintenanceItemDto {
  @IsOptional() @IsString() @MinLength(1) ar?: string;
  @IsOptional() @IsString() @MinLength(1) en?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsDateString() warrantyStart?: string;
  @IsOptional() @IsDateString() warrantyEnd?: string;
  @IsOptional() @IsString() @MaxLength(200) supplierName?: string;
  @IsOptional() @IsString() @MaxLength(200) contractorName?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// Display-only verdict for item management. The authoritative value for a
// request is snapshotted onto MaintenanceRequest.warrantyStatus at creation
// (a later batch) — it is never persisted on the item itself.
function computeWarrantyStatus(warrantyEnd: Date | null): WarrantyStatus {
  if (!warrantyEnd) return WarrantyStatus.UNKNOWN;
  return warrantyEnd.getTime() >= Date.now()
    ? WarrantyStatus.IN_WARRANTY
    : WarrantyStatus.OUT_OF_WARRANTY;
}

type ItemRow = Prisma.UnitMaintenanceItemGetPayload<{
  include: { category: { select: { id: true; code: true; name: true; active: true } } };
}>;

function withWarrantyStatus(item: ItemRow) {
  return { ...item, warrantyStatus: computeWarrantyStatus(item.warrantyEnd) };
}

const CATEGORY_SELECT = { id: true, code: true, name: true, active: true } as const;

@Injectable()
class UnitMaintenanceItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(unitId: string, includeInactive = false) {
    await this.assertUnit(unitId);
    const rows = await this.prisma.unitMaintenanceItem.findMany({
      where: { unitId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: CATEGORY_SELECT } },
    });
    return rows.map(withWarrantyStatus);
  }

  async create(unitId: string, dto: CreateMaintenanceItemDto) {
    await this.assertUnit(unitId);
    if (dto.categoryId) await this.assertActiveCategory(dto.categoryId);
    const warrantyStart = dto.warrantyStart ? new Date(dto.warrantyStart) : null;
    const warrantyEnd = dto.warrantyEnd ? new Date(dto.warrantyEnd) : null;
    this.assertDateOrder(warrantyStart, warrantyEnd);

    const created = await this.prisma.unitMaintenanceItem.create({
      data: {
        unitId,
        categoryId: dto.categoryId ?? null,
        name: { ar: dto.ar.trim(), en: dto.en.trim() } as Prisma.InputJsonValue,
        warrantyStart,
        warrantyEnd,
        supplierName: dto.supplierName?.trim() ?? null,
        contractorName: dto.contractorName?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        active: dto.active ?? true,
      },
      include: { category: { select: CATEGORY_SELECT } },
    });
    return withWarrantyStatus(created);
  }

  async update(unitId: string, itemId: string, dto: UpdateMaintenanceItemDto) {
    const current = await this.prisma.unitMaintenanceItem.findUnique({ where: { id: itemId } });
    if (!current || current.unitId !== unitId) {
      throw new NotFoundException('Maintenance item not found');
    }
    // A warranty that has already started (on contract signing) can't be
    // unselected — the coverage stays on record for the sold unit.
    if (dto.active === false && current.warrantyStart != null) {
      throw new BadRequestException('Cannot deactivate an item whose warranty has already started');
    }
    if (dto.categoryId) await this.assertActiveCategory(dto.categoryId);

    // Effective dates merge the patch over the stored values so the order check
    // holds even when only one bound is being changed.
    const warrantyStart =
      dto.warrantyStart !== undefined ? new Date(dto.warrantyStart) : current.warrantyStart;
    const warrantyEnd =
      dto.warrantyEnd !== undefined ? new Date(dto.warrantyEnd) : current.warrantyEnd;
    this.assertDateOrder(warrantyStart, warrantyEnd);

    const data: Prisma.UnitMaintenanceItemUpdateInput = {};
    if (dto.ar !== undefined || dto.en !== undefined) {
      const prev = (current.name ?? {}) as { ar?: string; en?: string };
      data.name = {
        ar: (dto.ar ?? prev.ar ?? '').trim(),
        en: (dto.en ?? prev.en ?? '').trim(),
      } as Prisma.InputJsonValue;
    }
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.warrantyStart !== undefined) data.warrantyStart = warrantyStart;
    if (dto.warrantyEnd !== undefined) data.warrantyEnd = warrantyEnd;
    if (dto.supplierName !== undefined) data.supplierName = dto.supplierName?.trim() ?? null;
    if (dto.contractorName !== undefined) data.contractorName = dto.contractorName?.trim() ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.unitMaintenanceItem.update({
      where: { id: itemId },
      data,
      include: { category: { select: CATEGORY_SELECT } },
    });
    return withWarrantyStatus(updated);
  }

  private async assertUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unit not found');
  }

  private async assertActiveCategory(categoryId: string) {
    const cat = await this.prisma.maintenanceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, active: true },
    });
    if (!cat) throw new BadRequestException('Category not found');
    if (!cat.active) throw new BadRequestException('Category is inactive');
  }

  private assertDateOrder(start: Date | null, end: Date | null) {
    if (start && end && end.getTime() < start.getTime()) {
      throw new BadRequestException('warrantyEnd must be on or after warrantyStart');
    }
  }
}

@ApiTags('maintenance')
@RequireCapability('feature.maintenance')
@Controller()
class UnitMaintenanceItemsController {
  constructor(private readonly svc: UnitMaintenanceItemsService) {}

  // Active items by default; ADMIN may pass includeInactive=true.
  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:read')
  @Get('units/:unitId/maintenance-items')
  list(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.svc.list(unitId, includeInactive === 'true');
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:items:manage')
  @Post('units/:unitId/maintenance-items')
  create(@Param('unitId', ParseUUIDPipe) unitId: string, @Body() dto: CreateMaintenanceItemDto) {
    return this.svc.create(unitId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('maintenance:items:manage')
  @Patch('units/:unitId/maintenance-items/:itemId')
  update(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMaintenanceItemDto,
  ) {
    return this.svc.update(unitId, itemId, dto);
  }
}

@Module({
  controllers: [UnitMaintenanceItemsController],
  providers: [UnitMaintenanceItemsService],
})
export class UnitMaintenanceItemsModule {}
