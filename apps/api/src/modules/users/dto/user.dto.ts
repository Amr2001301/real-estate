import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { UserRole, Locale } from '@prisma/client';

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
}

// ADMIN-only: assign or clear a SALES user's manager. Kept separate from the
// shared UpdateUserDto so the self-profile route (PATCH /users/me) can never
// set managerId. null clears the assignment; @IsOptional permits null/undefined.
export class AssignManagerDto {
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

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
