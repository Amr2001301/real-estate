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
import { AppointmentStatus, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { VisitsService } from './visits.service';
import {
  AssignSalesDto,
  CreateDirectAppointmentDto,
  ListAppointmentsDto,
  ListRequestsDto,
  RescheduleVisitDto,
  ScheduleVisitDto,
  UpdateRequestStatusDto,
} from './dto/visits.dto';

/**
 * Thin DTOs for the four new appointment-status routes. Each only accepts
 * the optional reason/notes fields relevant to its transition; `status` is
 * forced server-side, eliminating the single-PATCH-multiplexer in favor of
 * dedicated permission-gated endpoints (mirrors reservations / bonus).
 */
class ConfirmAppointmentDto {
  @IsOptional() @IsString() salesNotes?: string;
}
class CompleteAppointmentDto {
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsString() resultNotes?: string;
  @IsOptional() @IsString() customerFeedback?: string;
}
class CancelAppointmentDto {
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsString() cancellationReason?: string;
}
class NoShowAppointmentDto {
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsString() noShowReason?: string;
}

@ApiTags('visits')
@Controller()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visits/stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.visits.stats(user);
  }

  // ─── Visit Requests ───────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visits/requests')
  listRequests(@Query() dto: ListRequestsDto, @CurrentUser() user: AuthUser) {
    return this.visits.listRequests(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visits/requests/:id')
  getRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.visits.getRequest(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('visits:approve')
  @Patch('visits/requests/:id')
  updateRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateRequest(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('visits:schedule')
  @Post('visits/requests/:id/schedule')
  scheduleVisit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.scheduleVisit(id, dto, user);
  }

  // ─── Appointments ─────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:create')
  @Post('visits/appointments')
  createDirect(
    @Body() dto: CreateDirectAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.createDirectAppointment(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visits/appointments')
  listAppointments(@Query() dto: ListAppointmentsDto, @CurrentUser() user: AuthUser) {
    return this.visits.listAppointments(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:read')
  @Get('visits/appointments/:id')
  getAppointment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.visits.getAppointment(id, user);
  }

  // ─── Appointment status transitions (split from legacy PATCH) ───────────
  // The old `PATCH /visits/appointments/:id/status` multiplexer is removed.
  // Each transition is a dedicated POST route gated by its own permission;
  // SALES retains the same operational access (visits:confirm / :complete /
  // :cancel / :no-show were granted in bulk during rollout) and the existing
  // service-layer state-machine assertions still apply.

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:confirm')
  @Post('visits/appointments/:id/confirm')
  confirmAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateAppointmentStatus(
      id,
      { ...dto, status: AppointmentStatus.CONFIRMED },
      user,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:complete')
  @Post('visits/appointments/:id/complete')
  completeAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateAppointmentStatus(
      id,
      { ...dto, status: AppointmentStatus.COMPLETED },
      user,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:cancel')
  @Post('visits/appointments/:id/cancel')
  cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateAppointmentStatus(
      id,
      { ...dto, status: AppointmentStatus.CANCELLED },
      user,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('visits:no-show')
  @Post('visits/appointments/:id/no-show')
  noShowAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoShowAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateAppointmentStatus(
      id,
      { ...dto, status: AppointmentStatus.NO_SHOW },
      user,
    );
  }

  @Roles(UserRole.ADMIN)
  @Permissions('visits:reschedule')
  @Post('visits/appointments/:id/reschedule')
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.reschedule(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('visits:assign')
  @Patch('visits/appointments/:id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSalesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.assignSales(id, dto, user);
  }
}
