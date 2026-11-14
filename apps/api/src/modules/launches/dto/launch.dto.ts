import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LaunchStatus } from '@prisma/client';

export class CreateLaunchDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() developerProjectId?: string;
  /** Typed when the launch is not filed under a directory project. */
  @ValidateIf((o: CreateLaunchDto) => !o.developerProjectId)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  developerName?: string;
  @IsDateString() launchDate!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) eoiAmount!: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateLaunchDto extends PartialType(CreateLaunchDto) {
  @IsOptional() @IsEnum(LaunchStatus) status?: LaunchStatus;
}

export class CreateEoiDto {
  @IsOptional() @IsUUID() leadId?: string;
  @ValidateIf((o: CreateEoiDto) => !o.leadId)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;
  @ValidateIf((o: CreateEoiDto) => !o.leadId)
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم الهاتف غير صحيح' })
  customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) preference?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) budget?: number;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class PayEoiDto {
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(120) paymentRef?: string;
}

export class AllocateEoiDto {
  @IsString() @MinLength(2) @MaxLength(300) allocation!: string;
}
