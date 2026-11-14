import { applyDecorators } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PlanFrequency } from '@prisma/client';

/** A percentage: 0–100, two decimals. */
const PCT = () =>
  applyDecorators(
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0),
    Max(100),
  );

export class CreateDeveloperDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم الهاتف غير صحيح' })
  phone?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @PCT() defaultCommissionPct?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateDeveloperDto extends PartialType(CreateDeveloperDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @PCT() commissionPct?: number;
  @IsOptional() @IsDateString() deliveryDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreatePlanDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @PCT() downPaymentPct!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(30) years!: number;
  @IsOptional() @IsEnum(PlanFrequency) frequency?: PlanFrequency;
  @IsOptional() @PCT() deliveryPct?: number;
  @IsOptional() @PCT() cashDiscountPct?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ComparePlansDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsUUID(undefined, { each: true })
  planIds!: string[];
}
