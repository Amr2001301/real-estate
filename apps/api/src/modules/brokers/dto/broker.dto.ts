import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BrokerCommissionModel, BrokerStatus } from '@prisma/client';

// Codes are stored case-sensitive in the DB but we standardise on
// uppercase + alnum + dash so they're URL-safe and readable.
const BROKER_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

export class CreateBrokerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  commercialName?: string;

  @IsOptional()
  @IsString()
  @Matches(BROKER_CODE_REGEX, {
    message: 'code must be 2-32 chars: uppercase letters, digits, dashes; must start with [A-Z0-9]',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  commercialRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankIban?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultCommissionPct?: number;

  @IsOptional()
  @IsEnum(BrokerCommissionModel)
  commissionModel?: BrokerCommissionModel;

  @IsOptional()
  @IsDateString()
  contractStartAt?: string;

  @IsOptional()
  @IsDateString()
  contractEndAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractPdfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateBrokerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  commercialName?: string;

  @IsOptional()
  @IsString()
  @Matches(BROKER_CODE_REGEX, {
    message: 'code must be 2-32 chars: uppercase letters, digits, dashes; must start with [A-Z0-9]',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  commercialRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bankIban?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultCommissionPct?: number;

  @IsOptional()
  @IsEnum(BrokerCommissionModel)
  commissionModel?: BrokerCommissionModel;

  @IsOptional()
  @IsDateString()
  contractStartAt?: string;

  @IsOptional()
  @IsDateString()
  contractEndAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractPdfUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/**
 * PATCH /brokers/:id/status now handles ONLY the non-destructive transitions
 * (reactivate → ACTIVE, send back to PENDING). The destructive transitions —
 * SUSPENDED and TERMINATED — moved to dedicated strict routes
 * (POST /:id/suspend, POST /:id/terminate) so each carries its own permission
 * code. The @IsIn whitelist makes the split tamper-proof: a caller holding
 * only brokers:update cannot suspend/terminate through this generic route.
 */
export class UpdateBrokerStatusDto {
  @IsIn([BrokerStatus.ACTIVE, BrokerStatus.PENDING])
  status!: BrokerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/** Body for the dedicated suspend/terminate routes — status is implied by the
 *  route, so only the optional audit reason travels in the body. */
export class BrokerStatusReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
