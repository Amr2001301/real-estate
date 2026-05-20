import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerCommissionsService } from './broker-commissions.service';
import {
  ApproveBrokerCommissionDto,
  BrokerCommissionsQueryDto,
  CancelBrokerCommissionDto,
  RejectBrokerCommissionDto,
} from './dto/broker-commission.dto';

@ApiTags('broker-commissions')
@Controller('broker-commissions')
export class BrokerCommissionsController {
  constructor(private readonly svc: BrokerCommissionsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('broker_commissions:read')
  @Get()
  list(@Query() query: BrokerCommissionsQueryDto) {
    return this.svc.list(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Permissions('broker_commissions:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // Strict: ADMIN must hold the code explicitly. Approval is the money-release
  // moment — it makes the commission eligible for payout batching.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_commissions:approve')
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBrokerCommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.approve(id, dto, user);
  }

  // Strict: rejection reverses an approval and notifies the broker. Treated
  // as a financial state mutation for segregation of duties.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_commissions:reject')
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBrokerCommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.reject(id, dto, user);
  }

  // Strict: cancellation is terminal and disqualifies the commission from
  // any future payout. Highest "remove from books" stakes.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_commissions:cancel')
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBrokerCommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.cancel(id, dto, user);
  }
}
