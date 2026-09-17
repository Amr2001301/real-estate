import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BrokerCommissionStatus, PaymentMethod } from '@prisma/client';

export class BrokerCommissionsQueryDto {
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @IsOptional()
  @IsUUID()
  brokerAgentId?: string;

  @IsOptional()
  @IsEnum(BrokerCommissionStatus)
  status?: BrokerCommissionStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

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

export class ApproveBrokerCommissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectBrokerCommissionDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class CancelBrokerCommissionDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class CollectClawbackDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class WaiveClawbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
