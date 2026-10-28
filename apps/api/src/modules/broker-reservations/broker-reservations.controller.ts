import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { salesDataScope } from '../../common/permissions/company-wide';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerReservationsService } from './broker-reservations.service';
import {
  BrokerReservationsQueryDto,
  CreateAdminBrokerReservationDto,
} from './dto/broker-reservation.dto';

@ApiTags('broker-reservations')
@RequireCapability('feature.brokers')
@Controller('broker-reservations')
export class BrokerReservationsController {
  constructor(
    private readonly svc: BrokerReservationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_reservations:read')
  @Get()
  async list(
    @Query() query: BrokerReservationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    // PRM2 — sales data keeps its scope (rule 2): a rep their own, a manager their team's.
    return this.svc.list(query, await salesDataScope(this.prisma, user));
  }

  // Admin-only: create a broker-originated reservation on behalf of a broker.
  // Mounted BEFORE the `:id` GET below so the literal POST never collides.
  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_reservations:create')
  @Permissions('broker_reservations:create')
  @Post()
  createOnBehalfOfBroker(
    @Body() dto: CreateAdminBrokerReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.createOnBehalfOfBroker(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_reservations:read')
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.findOne(id, await salesDataScope(this.prisma, user));
  }
}
