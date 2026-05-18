import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BrokerPayoutMethod, BrokerPayoutStatus } from '@prisma/client';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class BrokerPayoutsQueryDto {
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @IsOptional()
  @IsEnum(BrokerPayoutStatus)
  status?: BrokerPayoutStatus;

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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

export class EligibleCommissionsQueryDto {
  @IsUUID()
  brokerId!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

export class CreateBrokerPayoutDto {
  @IsUUID()
  brokerId!: string;

  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be YYYY-MM' })
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  commissionIds?: string[];
}

export class CommissionIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  commissionIds!: string[];
}

export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ProcessPayoutDto {
  @IsOptional()
  @IsEnum(BrokerPayoutMethod)
  paymentMethod?: BrokerPayoutMethod;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class MarkPayoutPaidDto {
  @IsEnum(BrokerPayoutMethod)
  paymentMethod!: BrokerPayoutMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptUrl?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelPayoutDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
