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
import { BrokerPayoutsService } from './broker-payouts.service';
import {
  ApprovePayoutDto,
  BrokerPayoutsQueryDto,
  CancelPayoutDto,
  CommissionIdsDto,
  CreateBrokerPayoutDto,
  EligibleCommissionsQueryDto,
  MarkPayoutPaidDto,
  ProcessPayoutDto,
} from './dto/broker-payout.dto';

@ApiTags('broker-payouts')
@RequireCapability('feature.brokers')
@Controller('broker-payouts')
export class BrokerPayoutsController {
  constructor(private readonly svc: BrokerPayoutsService) {}

  // Note: `eligible-commissions` is declared BEFORE `:id` so it is matched
  // first and not interpreted as a UUID param.
  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:read')
  @Get('eligible-commissions')
  eligible(@Query() query: EligibleCommissionsQueryDto) {
    return this.svc.listEligibleCommissions(query);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:read')
  @Get()
  list(@Query() query: BrokerPayoutsQueryDto) {
    return this.svc.list(query);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:create')
  @Post()
  create(
    @Body() dto: CreateBrokerPayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:update')
  @Post(':id/add-commissions')
  addCommissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommissionIdsDto,
  ) {
    return this.svc.addCommissions(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('broker_payouts:update')
  @Post(':id/remove-commissions')
  removeCommissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommissionIdsDto,
  ) {
    return this.svc.removeCommissions(id, dto);
  }

  // Strict: approval makes the payout eligible to process. Classic
  // segregation-of-duties gate — the admin who created the DRAFT must not,
  // by default, also approve it.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_payouts:approve')
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovePayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.approve(id, dto, user);
  }

  // Strict: marks the payout as payment-initiated; signals downstream finance
  // workflows that funds are leaving.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_payouts:process')
  @Patch(':id/process')
  process(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessPayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.process(id, dto, user);
  }

  // Strict: final money-out confirmation. Highest financial stakes in the
  // entire system.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_payouts:pay')
  @Patch(':id/mark-paid')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPayoutPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.markPaid(id, dto, user);
  }

  // Strict: cancelling unlinks commissions and zeros totals. For APPROVED
  // payouts this reverses an explicit financial release.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_payouts:cancel')
  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.cancel(id, dto, user);
  }
}
