import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
