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
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class CreateBuildingDto {
  @IsUUID()
  phaseId!: string;

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

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(@Query('phaseId') phaseId?: string) {
    return this.buildings.list(phaseId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateBuildingDto) {
    return this.buildings.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBuildingDto) {
    return this.buildings.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
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
