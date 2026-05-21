import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
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
