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
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { VisitsService } from './visits.service';
import {
  AssignSalesDto,
  CreateDirectAppointmentDto,
  ListAppointmentsDto,
  ListRequestsDto,
  RescheduleVisitDto,
  ScheduleVisitDto,
  UpdateAppointmentStatusDto,
  UpdateRequestStatusDto,
} from './dto/visits.dto';

@ApiTags('visits')
@Controller()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('visits/stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.visits.stats(user);
  }

  // ─── Visit Requests ───────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('visits/requests')
  listRequests(@Query() dto: ListRequestsDto, @CurrentUser() user: AuthUser) {
    return this.visits.listRequests(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('visits/requests/:id')
  getRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.visits.getRequest(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Patch('visits/requests/:id')
  updateRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateRequest(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Post('visits/requests/:id/schedule')
  scheduleVisit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.scheduleVisit(id, dto, user);
  }

  // ─── Appointments ─────────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Post('visits/appointments')
  createDirect(
    @Body() dto: CreateDirectAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.createDirectAppointment(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('visits/appointments')
  listAppointments(@Query() dto: ListAppointmentsDto, @CurrentUser() user: AuthUser) {
    return this.visits.listAppointments(dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('visits/appointments/:id')
  getAppointment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.visits.getAppointment(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Patch('visits/appointments/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.updateAppointmentStatus(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Post('visits/appointments/:id/reschedule')
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleVisitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.reschedule(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Patch('visits/appointments/:id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSalesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.assignSales(id, dto, user);
  }
}
