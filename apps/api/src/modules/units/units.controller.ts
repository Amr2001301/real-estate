import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UnitsService } from './units.service';
import {
  CalcInstallmentDto,
  CreateUnitDto,
  InventoryMatrixQueryDto,
  UnitQueryDto,
  UpdateUnitDto,
  UpdateUnitStatusDto,
} from './dto/unit.dto';

@ApiTags('units')
@Controller()
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  // Public
  @Public()
  @Get('public/units')
  publicList(@Query() query: UnitQueryDto) {
    return this.units.findAll(query, true);
  }

  @Public()
  @Get('public/units/:id')
  publicGet(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.findOne(id, true);
  }

  // Sales installment calculator (Sales-only feature per scope) — reads
  // unit pricing context, so gated under `units:read`.
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Post('units/calc-installment')
  calc(@Body() dto: CalcInstallmentDto) {
    return this.units.calcInstallment(dto);
  }

  // Admin/Sales
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get('units')
  list(@Query() query: UnitQueryDto) {
    return this.units.findAll(query);
  }

  // Must be declared before `units/:id` so the literal segment wins over the param route.
  // "Export this list" on the admin units / inventory pages — the list
  // filters, every page. ADMIN only (the full price list of the company).
  // Declared before `units/:id`.
  @Roles(UserRole.ADMIN)
  @Permissions('units:read')
  @Get('units/export.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="units.xlsx"')
  async exportXlsx(@Query() query: UnitQueryDto): Promise<StreamableFile> {
    return new StreamableFile(await this.units.exportXlsx(query));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:read')
  @Get('units/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="units.csv"')
  exportCsv(@Query() query: UnitQueryDto): Promise<string> {
    return this.units.exportCsv(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get('units/inventory-matrix')
  inventoryMatrix(@Query() query: InventoryMatrixQueryDto) {
    return this.units.inventoryMatrix(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get('units/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:create')
  @Post('units')
  create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:update')
  @Patch('units/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(id, dto);
  }

  // Admin override path for unit status. Status is normally driven by
  // reservation/contract side effects; this route exists for corrections.
  @Roles(UserRole.ADMIN)
  @Permissions('units:change-status')
  @Patch('units/:id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.units.setStatus(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:delete')
  @Delete('units/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.remove(id);
  }
}
