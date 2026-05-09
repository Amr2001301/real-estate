import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UnitsService } from './units.service';
import {
  CalcInstallmentDto,
  CreateUnitDto,
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

  // Sales installment calculator (Sales-only feature per scope)
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @Post('units/calc-installment')
  calc(@Body() dto: CalcInstallmentDto) {
    return this.units.calcInstallment(dto);
  }

  // Admin/Sales
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('units')
  list(@Query() query: UnitQueryDto) {
    return this.units.findAll(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('units/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('units')
  create(@Body() dto: CreateUnitDto) {
    return this.units.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('units/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('units/:id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.units.setStatus(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Delete('units/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.units.remove(id);
  }
}
