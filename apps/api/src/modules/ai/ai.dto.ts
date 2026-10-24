import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAiPackageDto {
  @IsString() @Length(2, 120) name!: string;
  /** Questions a month */
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) questions!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateAiPackageDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) questions?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  /** false stops offering it; companies already on it keep their period. */
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Activate or renew: a package, and the price agreed with the company. */
export class AiPeriodDto {
  @IsUUID() packageId!: string;
  /** Agreed price; the package's price when left out. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Extra questions for the current period; they end with it. */
export class AiTopUpDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) questions!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
