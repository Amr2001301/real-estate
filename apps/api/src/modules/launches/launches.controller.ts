import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { LaunchesService } from './launches.service';
import {
  AllocateEoiDto,
  CreateEoiDto,
  CreateLaunchDto,
  PayEoiDto,
  UpdateLaunchDto,
} from './dto/launch.dto';

const ALL = [UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES] as const;
const RUNNERS = [UserRole.ADMIN, UserRole.SALES_MANAGER] as const;

/**
 * BRK-6 — launches and expressions of interest (brokerage companies only).
 * Every sales role records EOIs; the admin and managers run the launch, take
 * the payments, allocate and refund.
 */
@ApiTags('launches')
@Controller('launches')
export class LaunchesController {
  constructor(private readonly launches: LaunchesService) {}

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get()
  list() {
    return this.launches.list();
  }

  @Roles(...RUNNERS)
  @Permissions('listings:manage')
  @Post()
  create(@Body() dto: CreateLaunchDto) {
    return this.launches.create(dto);
  }

  @Roles(...RUNNERS)
  @Permissions('listings:manage')
  @Post('eois/:id/pay')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayEoiDto,
  ) {
    return this.launches.pay(user, id, dto);
  }

  @Roles(...RUNNERS)
  @Permissions('listings:manage')
  @Post('eois/:id/allocate')
  allocate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateEoiDto,
  ) {
    return this.launches.allocate(user, id, dto);
  }

  @Roles(...RUNNERS)
  @Permissions('listings:manage')
  @Post('eois/:id/refund')
  refund(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.launches.refund(user, id);
  }

  @Roles(...ALL)
  @Permissions('listings:manage')
  @Post('eois/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.launches.cancel(user, id);
  }

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.launches.get(user, id);
  }

  @Roles(...RUNNERS)
  @Permissions('listings:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLaunchDto) {
    return this.launches.update(id, dto);
  }

  @Roles(...ALL)
  @Permissions('listings:manage')
  @Post(':id/eois')
  createEoi(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEoiDto,
  ) {
    return this.launches.createEoi(user, id, dto);
  }
}
