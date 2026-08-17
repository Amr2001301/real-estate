import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
