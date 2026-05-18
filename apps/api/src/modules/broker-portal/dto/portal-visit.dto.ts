import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VisitRequestStatus, VisitStatus } from '@prisma/client';

export class CreatePortalVisitRequestDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsDateString()
  preferredDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Required only when no leadId is provided. Validated at runtime by the
  // service since class-validator can't easily express "either leadId or
  // (customerName + customerPhone)".
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}

export class PortalVisitsQueryDto {
  @IsOptional()
  @IsEnum(VisitRequestStatus)
  requestStatus?: VisitRequestStatus;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

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
