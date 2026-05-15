import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsPositive,
} from 'class-validator';
import { UnitStatus } from '@prisma/client';

export class CreateUnitDto {
  @IsUUID()
  buildingId!: string;

  @IsString()
  code!: string;

  @IsString()
  type!: string;

  @IsNumber()
  @IsPositive()
  area!: number;

  @IsInt()
  @Min(0)
  bedrooms!: number;

  @IsInt()
  @Min(0)
  bathrooms!: number;

  @IsInt()
  @Min(0)
  floor!: number;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}

export class UpdateUnitDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @IsPositive() area?: number;
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) floor?: number;
  @IsOptional() @IsNumber() @IsPositive() price?: number;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
}

export class UnitQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
  @IsOptional() @IsNumber() priceMin?: number;
  @IsOptional() @IsNumber() priceMax?: number;
  @IsOptional() @IsNumber() areaMin?: number;
  @IsOptional() @IsNumber() areaMax?: number;
  @IsOptional() @IsInt() bedrooms?: number;
  @IsOptional() @IsInt() page?: number;
  @IsOptional() @IsInt() pageSize?: number;
  @IsOptional() @IsBoolean() withoutPlan?: boolean;
}

export class UpdateUnitStatusDto {
  @IsEnum(UnitStatus)
  status!: UnitStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CalcInstallmentDto {
  @IsNumber() @IsPositive() totalPrice!: number;
  @IsNumber() @Min(0) downPayment!: number;
  @IsInt() @Min(1) totalMonths!: number;
}
