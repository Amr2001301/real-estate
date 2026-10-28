import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
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
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UnitsService } from './units.service';
import { UnitTypesService } from './unit-types.service';
import { CreateUnitTypeDto, UpdateUnitTypeDto } from './dto/unit-type.dto';
import { UnitModelsService } from './unit-models.service';
import { CreateUnitModelDto, UpdateUnitModelDto } from './dto/unit-model.dto';
import {
  CalcInstallmentDto,
  CreateUnitDto,
  InventoryMatrixQueryDto,
  UnitQueryDto,
  UpdateUnitDto,
  UpdateUnitStatusDto,
  RepriceUnitsDto,
} from './dto/unit.dto';

@ApiTags('units')
@Controller()
export class UnitsController {
  constructor(
    private readonly units: UnitsService,
    private readonly unitTypes: UnitTypesService,
    private readonly unitModels: UnitModelsService,
  ) {}

  // Unit types (F10): the company's list, managed by an admin.
  @Public()
  @Get('public/unit-types')
  publicUnitTypes() {
    return this.unitTypes.list(true);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get('unit-types')
  listUnitTypes() {
    return this.unitTypes.list();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('settings:write')
  @Post('unit-types')
  createUnitType(@Body() dto: CreateUnitTypeDto) {
    return this.unitTypes.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('settings:write')
  @Patch('unit-types/:id')
  updateUnitType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitTypeDto) {
    return this.unitTypes.update(id, dto);
  }

  // Unit models (F10): a project's layouts, units are entered from.
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get('projects/:projectId/unit-models')
  listUnitModels(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.unitModels.list(projectId);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:create')
  @GrantedBy('units:create')
  @Post('projects/:projectId/unit-models')
  createUnitModel(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateUnitModelDto) {
    return this.unitModels.create(projectId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:update')
  @GrantedBy('units:update')
  @Patch('unit-models/:id')
  updateUnitModel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitModelDto) {
    return this.unitModels.update(id, dto);
  }

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
  @GrantedBy('units:create')
  @Post('units')
  create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto);
  }

  /** Reprice by the meter the units for sale in a project, phase or building. */
  @Roles(UserRole.ADMIN)
  @Permissions('units:update')
  @GrantedBy('units:update')
  @Post('units/reprice')
  @HttpCode(200)
  reprice(@Body() dto: RepriceUnitsDto) {
    return this.units.reprice(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:update')
  @GrantedBy('units:update')
  @Patch('units/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(id, dto);
  }

  // Admin override path for unit status. Status is normally driven by
  // reservation/contract side effects; this route exists for corrections.
  @Roles(UserRole.ADMIN)
  @Permissions('units:change-status')
  @GrantedBy('units:change-status')
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
  @GrantedBy('units:delete')
  @Delete('units/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.remove(id);
  }
}
