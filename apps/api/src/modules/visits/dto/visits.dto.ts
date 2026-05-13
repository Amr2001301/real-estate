import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  AppointmentStatus,
  VisitRequestSource,
  VisitRequestStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class ListRequestsDto {
  @IsOptional() @IsEnum(VisitRequestStatus) status?: VisitRequestStatus;
  @IsOptional() @IsEnum(VisitRequestSource) source?: VisitRequestSource;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class ListAppointmentsDto {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsDateString() scheduledFrom?: string;
  @IsOptional() @IsDateString() scheduledTo?: string;
  @IsOptional() @IsString() today?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class UpdateRequestStatusDto {
  @IsEnum(VisitRequestStatus) status!: VisitRequestStatus;
  @IsOptional() @IsString() adminNotes?: string;
}

export class ScheduleVisitDto {
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetingPoint?: string;
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
}

export class RescheduleVisitDto {
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetingPoint?: string;
  @IsOptional() @IsString() salesNotes?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus) status!: AppointmentStatus;
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsString() resultNotes?: string;
  @IsOptional() @IsString() cancellationReason?: string;
  @IsOptional() @IsString() noShowReason?: string;
  @IsOptional() @IsString() customerFeedback?: string;
}

export class AssignSalesDto {
  @IsUUID() assignedSalesId!: string;
}

export class CreateDirectAppointmentDto {
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsUUID() projectId!: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) durationMinutes?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetingPoint?: string;
  @IsOptional() @IsString() salesNotes?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
}
