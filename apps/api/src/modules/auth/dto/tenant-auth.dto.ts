/**
 * MT-026 / MT-027 / MT-028 / MT-029 / MT-030 — Tenant-aware auth DTOs.
 *
 * These DTOs cover the new Phase C-Expand auth endpoints that accept an
 * explicit X-Tenant-Slug header or a slug in the request body to resolve
 * the tenant before performing identity operations.
 */

import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MinLength,
  IsOptional,
  Equals,
} from 'class-validator';

// ---------------------------------------------------------------------------
// MT-026 — Staff login
// ---------------------------------------------------------------------------

export class StaffLoginDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// ---------------------------------------------------------------------------
// MT-027 — Super-admin login
// ---------------------------------------------------------------------------

export class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// ---------------------------------------------------------------------------
// MT-028 — Tenant-aware customer login
// ---------------------------------------------------------------------------

export class TenantCustomerLoginDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

// ---------------------------------------------------------------------------
// MT-029 — Tenant-aware customer registration
// ---------------------------------------------------------------------------

export class TenantCustomerRegisterDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format (+CC…)' })
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Equals(true, { message: 'Terms must be accepted' })
  acceptTerms!: boolean;

  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() interestType?: string;
  @IsOptional() @IsString() budgetRange?: string;
  @IsOptional() @IsString() preferredContactMethod?: string;
}

// ---------------------------------------------------------------------------
// MT-030 — Tenant-aware OTP + forgot/reset password
// ---------------------------------------------------------------------------

export class TenantOtpRequestDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @MinLength(1)
  phone!: string;
}

export class TenantOtpVerifyDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;
}

export class TenantForgotPasswordDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsEmail()
  email!: string;
}

export class TenantResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
