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
import { CompanyLifecycleStatus, CompanyType, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
// CompanyType imported for CreateCompanyDto.type — intentionally NOT in UpdateCompanyDto
// (type is immutable post-creation; see MT-042 company type mutability decision)

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

  // MT-040: company classification (defaults to DEVELOPER in service if omitted)
  @IsEnum(CompanyType) @IsOptional()
  type?: CompanyType;

  // MT-040A: exposure flags (service defaults all to true if omitted)
  @IsBoolean() @IsOptional()
  websiteEnabled?: boolean;

  @IsBoolean() @IsOptional()
  customerAppEnabled?: boolean;

  @IsBoolean() @IsOptional()
  staffAppEnabled?: boolean;
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

  // MT-036: lifecycle status (administrative control — enforcement added in D2/MT-034)
  // Company.type is intentionally absent from UpdateCompanyDto — type is immutable
  // after provisioning. A future safe reclassification workflow may be added later.
  @IsEnum(CompanyLifecycleStatus) @IsOptional()
  lifecycleStatus?: CompanyLifecycleStatus;

  // MT-040A: exposure flags (enforcement deferred to respective surface D2 tickets)
  @IsBoolean() @IsOptional()
  websiteEnabled?: boolean;

  @IsBoolean() @IsOptional()
  customerAppEnabled?: boolean;

  @IsBoolean() @IsOptional()
  staffAppEnabled?: boolean;
}

// MT-042 — Dedicated DTO for capability updates.
// Validated as a plain object; CapabilityService enforces boolean values.
export class UpdateCapabilitiesDto {
  @IsObject()
  capabilities!: Record<string, boolean>;
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

// MT-033: Create any staff user (role-parameterised) in a target company.
// SUPER_ADMIN role is blocked at the service layer.
const ALLOWED_STAFF_ROLES = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER'] as const;
type AllowedStaffRole = typeof ALLOWED_STAFF_ROLES[number];

export class CreateCompanyUserDto {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsString() @IsNotEmpty()
  fullName!: string;

  @IsEnum(ALLOWED_STAFF_ROLES)
  role!: AllowedStaffRole;

  @IsString() @IsOptional()
  phone?: string;
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
