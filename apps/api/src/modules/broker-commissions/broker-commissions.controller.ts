import {
  Body,
  Controller,
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
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerCommissionsService } from './broker-commissions.service';
import { ClawbackResolutionService } from './clawback-resolution.service';
import {
  ApproveBrokerCommissionDto,
  BrokerCommissionsQueryDto,
  CancelBrokerCommissionDto,
  CollectClawbackDto,
  RejectBrokerCommissionDto,
  WaiveClawbackDto,
} from './dto/broker-commission.dto';

@ApiTags('broker-commissions')
@RequireCapability('feature.brokers')
@Controller('broker-commissions')
export class BrokerCommissionsController {
  constructor(
    private readonly svc: BrokerCommissionsService,
    private readonly clawbackSvc: ClawbackResolutionService,
  ) {}

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

  // Clawback resolve — OUTSTANDING|PARTIALLY_COLLECTED → COLLECTED.
  // Records amount, reference, payment method. May be called multiple times
  // for partial repayments (PARTIALLY_COLLECTED) until the full amount is recovered.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker-commissions:clawback:resolve')
  @Post(':id/clawback/collect')
  collectClawback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectClawbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clawbackSvc.collectCommission(id, dto, user);
  }

  // Clawback waive — OUTSTANDING|PARTIALLY_COLLECTED → WAIVED.
  // Mandatory reason stored in clawbackWaiveReason (separate from clawbackReason).
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker-commissions:clawback:resolve')
  @Post(':id/clawback/waive')
  waiveClawback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WaiveClawbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clawbackSvc.waiveCommission(id, dto, user);
  }
}
