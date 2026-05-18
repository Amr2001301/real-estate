import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReservationStatus } from '@prisma/client';

export class BrokerReservationsQueryDto {
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  salesId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

/**
 * Phase 18A — admin entry-point for creating a broker-originated reservation
 * on behalf of a broker. The admin chooses the brokerId (and optional
 * brokerAgentId); the rest of the validation mirrors the portal flow.
 */
export class CreateAdminBrokerReservationDto {
  @IsUUID() brokerId!: string;

  @IsOptional() @IsUUID() brokerAgentId?: string;

  @IsUUID() leadId!: string;

  @IsUUID() unitId!: string;

  @IsOptional() @IsUUID() installmentPlanTemplateId?: string;

  @IsOptional() @IsUUID() selectedDurationOptionId?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720)
  expiresInHours?: number;
}
