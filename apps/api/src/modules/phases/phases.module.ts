import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class TranslatableDto {
  @IsString() ar!: string;
  @IsString() en!: string;
}

class CreatePhaseDto {
  @IsUUID()
  projectId!: string;

  @ValidateNested()
  @Type(() => TranslatableDto)
  name!: TranslatableDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
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

  create(dto: CreatePhaseDto) {
    return this.prisma.phase.create({
      data: {
        projectId: dto.projectId,
        name: dto.name as unknown as Prisma.InputJsonValue,
        order: dto.order ?? 0,
      },
    });
  }

  update(id: string, dto: UpdatePhaseDto) {
    const data: Prisma.PhaseUpdateInput = {};
    if (dto.name) data.name = dto.name as unknown as Prisma.InputJsonValue;
    if (dto.order !== undefined) data.order = dto.order;
    return this.prisma.phase.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.phase.delete({ where: { id } });
  }
}

@ApiTags('phases')
@Controller('phases')
class PhasesController {
  constructor(private readonly phases: PhasesService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.phases.list(projectId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.phases.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreatePhaseDto) {
    return this.phases.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePhaseDto) {
    return this.phases.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
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
