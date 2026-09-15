import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions, PermissionsStrict } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ChequeLifecycleService } from './payment-instruments.service';
import {
  CreatePaymentInstrumentDto,
  RecordBounceDto,
  RecordClearingDto,
  ReplaceInstrumentDto,
} from './payment-instruments.dto';

@ApiTags('payment-instruments')
@Controller('payment-instruments')
export class PaymentInstrumentsController {
  constructor(private readonly svc: ChequeLifecycleService) {}

  // ── Create instrument ────────────────────────────────────────────────────────
  // ADMIN + SALES_MANAGER; no strict (routine operation)

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentInstrumentDto) {
    return this.svc.create(dto, user.sub);
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  // ── PENDING_CLEARANCE → DEPOSITED ─────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @HttpCode(HttpStatus.OK)
  @Post(':id/deposit')
  deposit(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.transitionToDeposited(id);
  }

  // ── PENDING_CLEARANCE → CANCELLED ─────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.transitionToCancelled(id);
  }

  // ── DEPOSITED → CLEARED ──────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @HttpCode(HttpStatus.OK)
  @Post(':id/clear')
  clear(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordClearingDto) {
    return this.svc.transitionToCleared(id, dto);
  }

  // ── DEPOSITED → BOUNCED ──────────────────────────────────────────────────
  // ADMIN only; @PermissionsStrict; reason is mandatory in the DTO

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('payment-instruments:bounce')
  @HttpCode(HttpStatus.OK)
  @Post(':id/bounce')
  bounce(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordBounceDto,
  ) {
    return this.svc.recordBounce(id, dto, user.sub);
  }

  // ── BOUNCED → REPLACED ───────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('payment-instruments:manage')
  @Post(':id/replace')
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceInstrumentDto,
  ) {
    return this.svc.transitionToReplaced(id, dto, user.sub);
  }
}
