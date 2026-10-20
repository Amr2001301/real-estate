import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsPositive,
  Max,
  MaxLength,
} from 'class-validator';
import { UnitFinishing, UnitOrientation, UnitStatus, UnitUsage, UnitView } from '@prisma/client';
import { MAX_PAGE_SIZE } from '../../../common/utils/pagination';

export class CreateUnitDto {
  @IsUUID('all', { message: 'يجب اختيار مبنى صالح' })
  buildingId!: string;

  @IsString()
  code!: string;

  /** One of the company's unit types (code or name, any case). */
  @IsString()
  type!: string;

  @IsNumber()
  @IsPositive()
  area!: number;

  /** Ignored (0) unless the type is residential. */
  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms: number = 0;

  @IsInt()
  @Min(0)
  floor!: number;

  /** The whole price — or leave it out and give the price per meter. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  /** Priced by the meter: the price is this × the gross area. */
  @IsOptional() @IsNumber() @IsPositive() pricePerMeter?: number | null;

  /** The project's model the unit is entered from (F10). */
  @IsOptional() @IsUUID() modelId?: string | null;

  /** Its own handover date (YYYY-MM-DD); none → the phase's. */
  @IsOptional() @IsDateString() deliveryDate?: string | null;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  // Specs (F10) — all optional; null clears one.
  @IsOptional() @IsNumber() @IsPositive() netArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() gardenArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() roofArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() terraceArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() landArea?: number | null;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing | null;
  @IsOptional() @IsEnum(UnitView) view?: UnitView | null;
  @IsOptional() @IsEnum(UnitOrientation) orientation?: UnitOrientation | null;
}

export class UpdateUnitDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @IsPositive() area?: number;
  @IsOptional() @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) floor?: number;
  @IsOptional() @IsNumber() @IsPositive() price?: number;
  /** Set → the price follows it (× the gross area); null → priced as a whole. */
  @IsOptional() @IsNumber() @IsPositive() pricePerMeter?: number | null;
  /** The project's model (F10); null → none. */
  @IsOptional() @IsUUID() modelId?: string | null;
  /** Its own handover date; null → the phase's. */
  @IsOptional() @IsDateString() deliveryDate?: string | null;
  @IsOptional() @IsNumber() @IsPositive() netArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() gardenArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() roofArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() terraceArea?: number | null;
  @IsOptional() @IsNumber() @IsPositive() landArea?: number | null;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing | null;
  @IsOptional() @IsEnum(UnitView) view?: UnitView | null;
  @IsOptional() @IsEnum(UnitOrientation) orientation?: UnitOrientation | null;
  // No `status` here: a status change goes through PATCH /units/:id/status,
  // which checks for a live reservation/contract and writes the history.
}

/** Whitelisted public sort options — each maps to a real scalar Unit column. */
export enum UnitSort {
  newest = 'newest',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  area_asc = 'area_asc',
  area_desc = 'area_desc',
  bedrooms_asc = 'bedrooms_asc',
  bedrooms_desc = 'bedrooms_desc',
}

export class UnitQueryDto {
  /** Case-insensitive match on the unit code (staff pickers search by it). */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(UnitSort) sort?: UnitSort;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsString() city?: string;
  /** Match any of these project cities (e.g. Arabic + English spellings). */
  @IsOptional() @IsArray() @IsString({ each: true }) cityIn?: string[];
  @IsOptional() @IsString() type?: string;
  /** Match any of these unit types (e.g. a category that spans 1BR/2BR/3BR). */
  @IsOptional() @IsArray() @IsString({ each: true }) typeIn?: string[];
  /** Residential, commercial, administrative, medical or parking units only. */
  @IsOptional() @IsEnum(UnitUsage) usage?: UnitUsage;
  /** The units of one of the project's models. */
  @IsOptional() @IsUUID() modelId?: string;
  /** Handed over by this date (YYYY-MM-DD): the unit's own date, or its phase's. */
  @IsOptional() @IsDateString() deliveryBy?: string;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing;
  @IsOptional() @IsEnum(UnitView) view?: UnitView;
  @IsOptional() @IsEnum(UnitOrientation) orientation?: UnitOrientation;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
  @IsOptional() @IsNumber() priceMin?: number;
  @IsOptional() @IsNumber() priceMax?: number;
  @IsOptional() @IsNumber() areaMin?: number;
  @IsOptional() @IsNumber() areaMax?: number;
  @IsOptional() @IsInt() bedrooms?: number;
  @IsOptional() @IsInt() bathrooms?: number;
  @IsOptional() @IsInt() page?: number;
  @IsOptional() @IsInt() @Max(MAX_PAGE_SIZE) pageSize?: number;
  @IsOptional() @IsBoolean() withoutPlan?: boolean;
}

/**
 * Reprice by the meter every unit for sale in a project, phase or building
 * (optionally one type). Reserved and sold units keep their price.
 */
export class RepriceUnitsDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() phaseId?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  /** One of the company's unit types (code). */
  @IsOptional() @IsString() type?: string;
  @IsNumber() @IsPositive() pricePerMeter!: number;
  /** Count only — nothing is changed. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
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

export class InventoryMatrixQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
}
