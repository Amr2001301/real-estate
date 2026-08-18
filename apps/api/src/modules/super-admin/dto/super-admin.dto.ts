import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  Min,
} from 'class-validator';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export class CreateCompanyDto {
  @IsString() @IsNotEmpty()
  name!: string;

  @IsString() @IsNotEmpty()
  slug!: string;

  @IsString() @IsOptional()
  country?: string;

  @IsString() @IsOptional()
  currency?: string;

  @IsString() @IsOptional()
  timezone?: string;

  @IsEnum(SubscriptionPlan) @IsOptional()
  subscriptionPlan?: SubscriptionPlan;

  @IsDateString() @IsOptional()
  subscriptionStartAt?: string;

  @IsDateString() @IsOptional()
  subscriptionEndAt?: string;

  @IsInt() @Min(1) @IsOptional()
  maxUsers?: number;

  @IsEmail() @IsOptional()
  adminEmail?: string;

  @IsString() @MinLength(8) @IsOptional()
  adminPassword?: string;

  @IsString() @IsOptional()
  adminFullName?: string;
}

export class UpdateCompanyDto {
  @IsString() @IsNotEmpty() @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  country?: string;

  @IsString() @IsOptional()
  currency?: string;

  @IsString() @IsOptional()
  timezone?: string;

  @IsEnum(SubscriptionPlan) @IsOptional()
  subscriptionPlan?: SubscriptionPlan;

  @IsEnum(SubscriptionStatus) @IsOptional()
  subscriptionStatus?: SubscriptionStatus;

  @IsDateString() @IsOptional()
  subscriptionStartAt?: string | null;

  @IsDateString() @IsOptional()
  subscriptionEndAt?: string | null;

  @IsInt() @Min(1) @IsOptional()
  maxUsers?: number | null;

  @IsBoolean() @IsOptional()
  isActive?: boolean;
}

export class CancelCompanyDto {
  @IsBoolean()
  immediate!: boolean;

  @IsString() @IsOptional()
  reason?: string;
}

export class SuspendCompanyDto {
  @IsString() @IsOptional()
  reason?: string;
}

export class CreateCompanyAdminDto {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsString() @IsNotEmpty()
  fullName!: string;
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export class CreatePricingPackageDto {
  @IsString() @IsNotEmpty()
  planTier!: string;

  @IsString() @IsNotEmpty()
  nameAr!: string;

  @IsString() @IsNotEmpty()
  nameEn!: string;

  @IsString() @IsOptional()
  descAr?: string;

  @IsString() @IsOptional()
  descEn?: string;

  @IsString() @IsOptional()
  currency?: string;

  @IsNumber() @IsOptional()
  monthlyPrice?: number;

  @IsNumber() @IsOptional()
  annualPrice?: number;

  @IsNumber() @IsOptional()
  setupFee?: number;

  @IsInt() @Min(1) @IsOptional()
  maxUsers?: number;

  @IsOptional()
  highlights?: string[];

  @IsOptional()
  specialOffer?: {
    titleAr: string;
    titleEn: string;
    discountPct: number;
    validUntil?: string;
  } | null;

  @IsInt() @IsOptional()
  sortOrder?: number;

  @IsBoolean() @IsOptional()
  isActive?: boolean;
}

export class UpdatePricingPackageDto {
  @IsString() @IsOptional()
  planTier?: string;

  @IsString() @IsOptional()
  nameAr?: string;

  @IsString() @IsOptional()
  nameEn?: string;

  @IsString() @IsOptional()
  descAr?: string;

  @IsString() @IsOptional()
  descEn?: string;

  @IsString() @IsOptional()
  currency?: string;

  @IsNumber() @IsOptional()
  monthlyPrice?: number | null;

  @IsNumber() @IsOptional()
  annualPrice?: number | null;

  @IsNumber() @IsOptional()
  setupFee?: number | null;

  @IsInt() @Min(1) @IsOptional()
  maxUsers?: number | null;

  @IsOptional()
  highlights?: string[];

  @IsOptional()
  specialOffer?: {
    titleAr: string;
    titleEn: string;
    discountPct: number;
    validUntil?: string;
  } | null;

  @IsInt() @IsOptional()
  sortOrder?: number;

  @IsBoolean() @IsOptional()
  isActive?: boolean;
}

// ── Modules ───────────────────────────────────────────────────────────────────

export class UpdateCompanyModulesDto {
  @IsObject()
  modules!: {
    broker?: boolean;
    website?: boolean;
    maintenance?: boolean;
    reports?: boolean;
    leads?: boolean;
    visits?: boolean;
    contracts?: boolean;
    installments?: boolean;
    deposits?: boolean;
  };
}
