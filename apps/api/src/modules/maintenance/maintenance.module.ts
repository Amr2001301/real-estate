import {
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
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Prisma, MaintenanceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

class CreateCategoryDto {
  @IsString() ar!: string;
  @IsString() en!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateCategoryDto {
  @IsOptional() @IsString() ar?: string;
  @IsOptional() @IsString() en?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class CreateRequestDto {
  @IsUUID() unitId!: string;
  @IsUUID() categoryId!: string;
  @IsString() @MinLength(5) description!: string;
}

class UpdateRequestDto {
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
  @IsOptional() @IsUUID() assignedAdminId?: string;
}

@Injectable()
class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Categories
  listCategories() {
    return this.prisma.maintenanceCategory.findMany({ orderBy: { createdAt: 'desc' } });
  }
  createCategory(dto: CreateCategoryDto) {
    return this.prisma.maintenanceCategory.create({
      data: {
        name: { ar: dto.ar, en: dto.en } as Prisma.InputJsonValue,
        active: dto.active ?? true,
      },
    });
  }
  updateCategory(id: string, dto: UpdateCategoryDto) {
    const data: Prisma.MaintenanceCategoryUpdateInput = {};
    if (dto.ar || dto.en) {
      data.name = { ar: dto.ar ?? '', en: dto.en ?? '' } as Prisma.InputJsonValue;
    }
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.maintenanceCategory.update({ where: { id }, data });
  }

  // Requests
  async createRequest(customerId: string, dto: CreateRequestDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    const cat = await this.prisma.maintenanceCategory.findUnique({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');

    return this.prisma.maintenanceRequest.create({
      data: {
        customerId,
        unitId: dto.unitId,
        categoryId: dto.categoryId,
        description: dto.description,
      },
    });
  }

  async list(opts: {
    page: number;
    pageSize: number;
    status?: MaintenanceStatus;
    customerId?: string;
    assignedAdminId?: string;
  }) {
    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.assignedAdminId ? { assignedAdminId: opts.assignedAdminId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true } },
          category: true,
          unit: true,
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return paginate(data, total, opts);
  }

  update(id: string, dto: UpdateRequestDto) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.assignedAdminId !== undefined ? { assignedAdminId: dto.assignedAdminId } : {}),
      },
    });
  }
}

@ApiTags('maintenance')
@Controller()
class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  // Categories — Admin
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  @Get('maintenance-categories')
  listCategories() {
    return this.svc.listCategories();
  }

  @Roles(UserRole.ADMIN)
  @Post('maintenance-categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.svc.createCategory(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('maintenance-categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.updateCategory(id, dto);
  }

  // Requests — Customer creates
  @Roles(UserRole.CUSTOMER)
  @Post('me/maintenance-requests')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.svc.createRequest(user.sub, dto);
  }

  @Roles(UserRole.CUSTOMER)
  @Get('me/maintenance-requests')
  myList(
    @CurrentUser() user: AuthUser,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      customerId: user.sub,
    });
  }

  // Admin manages all
  @Roles(UserRole.ADMIN)
  @Get('maintenance-requests')
  list(
    @Query('status') status?: MaintenanceStatus,
    @Query('customerId') customerId?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      customerId,
      assignedAdminId,
    });
  }

  @Roles(UserRole.ADMIN)
  @Patch('maintenance-requests/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRequestDto) {
    return this.svc.update(id, dto);
  }
}

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
