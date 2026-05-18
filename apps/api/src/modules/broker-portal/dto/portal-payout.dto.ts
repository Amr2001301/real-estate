import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BrokerPayoutStatus } from '@prisma/client';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class PortalPayoutsQueryDto {
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
