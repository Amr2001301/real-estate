import {
  Body,
  Controller,
  Delete,
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
import { IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ENTITY_CODE_PATTERN, normalizeEntityCode } from '../../common/utils/entity-code';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';

class CreateBuildingDto {
  @IsUUID()
  phaseId!: string;

  @Transform(({ value }) => normalizeEntityCode(value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(ENTITY_CODE_PATTERN, {
    message: 'code must be 2–64 characters: uppercase letters, digits, and hyphens (e.g. TOWER-A)',
  })
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalFloors?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

class UpdateBuildingDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(1) totalFloors?: number;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

@Injectable()
class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(phaseId?: string) {
    return this.prisma.building.findMany({
      where: phaseId ? { phaseId } : {},
      orderBy: { order: 'asc' },
      include: { _count: { select: { units: true } } },
    });
  }

  async get(id: string) {
    const b = await this.prisma.building.findUnique({
      where: { id },
      include: { units: true },
    });
    if (!b) throw new NotFoundException('Building not found');
    return b;
  }

  create(dto: CreateBuildingDto) {
    return this.prisma.building.create({
      data: {
        phaseId: dto.phaseId,
        code: dto.code,
        name: dto.name,
        totalFloors: dto.totalFloors ?? 1,
        order: dto.order ?? 0,
      },
    });
  }

  update(id: string, dto: UpdateBuildingDto) {
    return this.prisma.building.update({ where: { id }, data: { ...dto } });
  }

  remove(id: string) {
    return this.prisma.building.delete({ where: { id } });
  }
}

@ApiTags('buildings')
@Controller('buildings')
class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('projects:read')
  @Get()
  list(@Query('phaseId') phaseId?: string) {
    return this.buildings.list(phaseId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('projects:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('buildings:manage')
  @Post()
  create(@Body() dto: CreateBuildingDto) {
    return this.buildings.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('buildings:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBuildingDto) {
    return this.buildings.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('buildings:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.remove(id);
  }
}

@Module({
  controllers: [BuildingsController],
  providers: [BuildingsService],
})
export class BuildingsModule {}
