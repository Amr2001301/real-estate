import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UnitUsage } from '@prisma/client';

export class CreateUnitTypeDto {
  @IsString() @IsNotEmpty() @MaxLength(100) ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) en!: string;
  @IsEnum(UnitUsage) usage!: UnitUsage;
  /** What units of this type store; defaults to the English name. Fixed once created. */
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(50) code?: string;
}

export class UpdateUnitTypeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) ar?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) en?: string;
  @IsOptional() @IsEnum(UnitUsage) usage?: UnitUsage;
  @IsOptional() @IsBoolean() active?: boolean;
}
