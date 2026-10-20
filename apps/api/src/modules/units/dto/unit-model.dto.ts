import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { UnitFinishing } from '@prisma/client';

export class CreateUnitModelDto {
  /** Short code, unique in the project (e.g. "A", "TYPE-B"). */
  @IsString() @IsNotEmpty() @MaxLength(30) @Matches(/^[\p{L}\p{N}_-]+$/u, { message: 'كود النموذج: حروف وأرقام وشرطة فقط' })
  code!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) en!: string;
  /** One of the company's unit types (code or name). */
  @IsString() @IsNotEmpty() type!: string;
  @IsNumber() @IsPositive() area!: number;
  @IsOptional() @IsNumber() @IsPositive() netArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() gardenArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() roofArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() terraceArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() landArea?: number | null;
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing | null;
}

export class UpdateUnitModelDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) ar?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) en?: string;
  @IsOptional() @IsString() @IsNotEmpty() type?: string;
  @IsOptional() @IsNumber() @IsPositive() area?: number;
  @IsOptional() @IsNumber() @IsPositive() netArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() gardenArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() roofArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() terraceArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() landArea?: number | null;
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
