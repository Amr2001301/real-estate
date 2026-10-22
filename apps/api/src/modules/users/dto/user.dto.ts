import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserRole, Locale } from '@prisma/client';

const trimOrNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class CreateUserDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  // Optional team assignment: the SALES_MANAGER who owns this (SALES) user.
  @IsOptional()
  @IsUUID()
  managerId?: string;

  // A buyer's identity for the contract (see UpdateUserDto).
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^[A-Za-z0-9]{5,20}$/, { message: 'رقم الهوية من ٥ إلى ٢٠ حرفاً أو رقماً' })
  nationalId?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;
}

// ADMIN-only: assign or clear a SALES user's manager. Kept separate from the
// shared UpdateUserDto so the self-profile route (PATCH /users/me) can never
// set managerId. null clears the assignment; @IsOptional permits null/undefined.
export class OffboardUserDto {
  @IsUUID()
  toUserId!: string;
}

export class AssignManagerDto {
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  // A buyer's identity for the contract: the national ID (14 digits in Egypt)
  // or a passport number; null clears it.
  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^[A-Za-z0-9]{5,20}$/, { message: 'رقم الهوية من ٥ إلى ٢٠ حرفاً أو رقماً' })
  nationalId?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @IsOptional()
  @IsString()
  phone?: string;
}

/** Roles a staff dropdown may list. Clients and customers are never options. */
export const STAFF_OPTION_ROLES = [
  UserRole.ADMIN,
  UserRole.SALES,
  UserRole.SALES_MANAGER,
  UserRole.MAINTENANCE_SUPERVISOR,
] as const;

export class UserOptionsQueryDto {
  /** Comma-separated staff roles, e.g. "SALES,SALES_MANAGER". */
  @Matches(
    new RegExp(`^(${STAFF_OPTION_ROLES.join('|')})(,(${STAFF_OPTION_ROLES.join('|')}))*$`),
    { message: `role must be a comma-separated list of: ${STAFF_OPTION_ROLES.join(', ')}` },
  )
  role!: string;

  /** "true" → active users only. A string: implicit conversion reads "false" as true. */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
}

export class ClientSearchQueryDto {
  /** Name, phone or email fragment. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** A picker shows a short list; the search narrows it. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  pageSize?: number;
}
