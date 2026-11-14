import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClaimStatus, DealStatus, ListingKind, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { parseEnumList } from '../../common/utils/query-filters';
import { DealsService } from './deals.service';
import {
  CancelDealDto,
  CreateDealDto,
  RecordClaimPaymentDto,
  RecordCommissionDto,
  RejectClaimDto,
  SetCommissionRuleDto,
  SubmitClaimDto,
} from './dto/deal.dto';

/**
 * BRK-3 — a brokerage company's deals, commission rules, developer claims
 * and staff commission payouts. Brokerage companies only (CompanyTypeGuard).
 * Reps and managers record deals; the money side (rules, claims, collection,
 * payouts) is the admin's (deals:finance).
 */
@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('deals:read')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('agentId', new ParseUUIDPipe({ optional: true })) agentId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe) pageSize?: number,
  ) {
    return this.deals.list(user, {
      status: parseEnumList(status, DealStatus, 'status'),
      kind: parseEnumList(kind, ListingKind, 'kind'),
      q,
      agentId,
      page,
      pageSize: Math.min(pageSize ?? 25, 100),
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('deals:manage')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDealDto) {
    return this.deals.create(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('deals:read')
  @Get('rules')
  rules() {
    return this.deals.rules();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Put('rules/:kind')
  setRule(
    @Param('kind', new ParseEnumPipe(ListingKind)) kind: ListingKind,
    @Body() dto: SetCommissionRuleDto,
  ) {
    return this.deals.setRule(kind, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Get('claims')
  claims(@Query('status') status?: string) {
    return this.deals.claims(parseEnumList(status, ClaimStatus, 'status'));
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Post('claims/:id/submit')
  submitClaim(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitClaimDto) {
    return this.deals.submitClaim(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Post('claims/:id/reject')
  rejectClaim(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectClaimDto) {
    return this.deals.rejectClaim(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Post('claims/:id/payments')
  recordClaimPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordClaimPaymentDto,
  ) {
    return this.deals.recordClaimPayment(user, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Delete('claim-payments/:id')
  removeClaimPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.deals.removeClaimPayment(id);
  }

  /** The admin sees every share; anyone else their own commissions. */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('deals:read')
  @Get('splits')
  splits(
    @CurrentUser() user: AuthUser,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
    @Query('state') state?: string,
  ) {
    const s = state === 'paid' || state === 'unpaid' ? state : undefined;
    return this.deals.splits(user, user.role === UserRole.ADMIN, { userId, state: s });
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Post('splits/:id/pay')
  paySplit(@Param('id', ParseUUIDPipe) id: string) {
    return this.deals.paySplit(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Post('splits/:id/unpay')
  unpaySplit(@Param('id', ParseUUIDPipe) id: string) {
    return this.deals.unpaySplit(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('deals:read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.get(user, id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('deals:manage')
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDealDto,
  ) {
    return this.deals.cancel(user, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('deals:finance')
  @Patch(':id/commission')
  recordCommission(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCommissionDto,
  ) {
    return this.deals.recordCommission(user, id, dto);
  }
}
