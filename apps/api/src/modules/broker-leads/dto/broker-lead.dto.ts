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
import { BrokerLeadStatus, LeadStage } from '@prisma/client';

export class BrokerLeadsQueryDto {
  @IsOptional()
  @IsUUID()
  brokerId?: string;

  @IsOptional()
  @IsEnum(BrokerLeadStatus)
  brokerApprovalStatus?: BrokerLeadStatus;

  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  assignedSalesId?: string;

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

export class ApproveBrokerLeadDto {
  @IsOptional()
  @IsUUID()
  assignedSalesId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectBrokerLeadDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class MarkBrokerLeadDuplicateDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
