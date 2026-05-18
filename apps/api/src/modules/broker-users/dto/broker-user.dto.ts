import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BrokerUserStatus, Locale } from '@prisma/client';

export class CreateBrokerUserDto {
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

  // Optional: if the platform wants to set a password at creation. Otherwise
  // the broker user signs in later via OTP, same as CLIENT/CUSTOMER.
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

export class UpdateBrokerUserDto {
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

export class UpdateBrokerUserStatusDto {
  @IsEnum(BrokerUserStatus)
  status!: BrokerUserStatus;
}
