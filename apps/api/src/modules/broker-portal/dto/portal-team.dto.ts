import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BrokerUserStatus, Locale } from '@prisma/client';

export class PortalTeamQueryDto {
  @IsOptional()
  @IsEnum(BrokerUserStatus)
  status?: BrokerUserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class CreatePortalTeamMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageBrokerUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewCommissions?: boolean;
}

export class UpdatePortalTeamMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageBrokerUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewCommissions?: boolean;
}

const PORTAL_STATUSES = [
  BrokerUserStatus.ACTIVE,
  BrokerUserStatus.SUSPENDED,
  BrokerUserStatus.REMOVED,
] as const;

export class UpdatePortalTeamMemberStatusDto {
  // Brokers can transition to ACTIVE/SUSPENDED/REMOVED only. INVITED is set
  // by the create path on first invite — managers cannot revert to INVITED.
  @IsEnum(PORTAL_STATUSES)
  status!: (typeof PORTAL_STATUSES)[number];
}
