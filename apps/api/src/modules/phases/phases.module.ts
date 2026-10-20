import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, IsInt, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { toDateOnly } from '../../common/time/date-only';
import { Transform, Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { ENTITY_CODE_PATTERN, codeTaken, normalizeEntityCode } from '../../common/utils/entity-code';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { assertInventoryDeletable } from '../projects/inventory-blockers';

class TranslatableDto {
  @IsString() ar!: string;
  @IsString() en!: string;
}

class CreatePhaseDto {
  @IsUUID()
  projectId!: string;

  @Transform(({ value }) => normalizeEntityCode(value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(ENTITY_CODE_PATTERN, {
    message: 'الكود من 2 إلى 64 حرفاً: حروف إنجليزية كبيرة وأرقام وشرطات فقط (مثال: PH-1)',
  })
  code!: string;

  @ValidateNested()
  @Type(() => TranslatableDto)
  name!: TranslatableDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** When the phase's units are handed over (YYYY-MM-DD). */
  @IsOptional() @IsDateString() deliveryDate?: string | null;
}

class UpdatePhaseDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TranslatableDto)
  name?: TranslatableDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** null clears it. */
  @IsOptional() @IsDateString() deliveryDate?: string | null;
}

@Injectable()
class PhasesService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId?: string) {
    return this.prisma.phase.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { order: 'asc' },
      include: { buildings: true },
    });
  }

  async get(id: string) {
    const phase = await this.prisma.phase.findUnique({
      where: { id },
      include: { buildings: { include: { _count: { select: { units: true } } } } },
    });
    if (!phase) throw new NotFoundException('Phase not found');
    return phase;
  }

  async create(dto: CreatePhaseDto) {
    // The parent id comes from the client; the tenant-scoped lookup makes sure
    // it is this company's project (relation ids are not scoped on write).
    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.phase.create({
      data: {
        projectId: dto.projectId,
        code: dto.code,
        name: dto.name as unknown as Prisma.InputJsonValue,
        order: dto.order ?? 0,
        deliveryDate: toDateOnly(dto.deliveryDate),
      },
    }).catch(codeTaken('لمرحلة أخرى في هذا المشروع'));
  }

  update(id: string, dto: UpdatePhaseDto) {
    const data: Prisma.PhaseUpdateInput = {};
    if (dto.name) data.name = dto.name as unknown as Prisma.InputJsonValue;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.deliveryDate !== undefined) data.deliveryDate = toDateOnly(dto.deliveryDate);
    return this.prisma.phase.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.get(id);
    await assertInventoryDeletable(this.prisma, { building: { phaseId: id } }, 'المرحلة');
    return this.prisma.phase.delete({ where: { id } });
  }
}

@ApiTags('phases')
@Controller('phases')
class PhasesController {
  constructor(private readonly phases: PhasesService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('projects:read')
  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.phases.list(projectId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('projects:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.phases.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('phases:manage')
  @Post()
  create(@Body() dto: CreatePhaseDto) {
    return this.phases.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('phases:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePhaseDto) {
    return this.phases.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('phases:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.phases.remove(id);
  }
}

@Module({
  controllers: [PhasesController],
  providers: [PhasesService],
})
export class PhasesModule {}
