import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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
  ValidateIf,
} from 'class-validator';
import { ListingKind, ListingStatus, MandateKind, UnitFinishing, UnitUsage, UnitView } from '@prisma/client';

/** A stored photo is the upload's public URL. */
const PHOTO_URL = /^https?:\/\/\S+$/;

export class CreateListingDto {
  @IsEnum(ListingKind) kind!: ListingKind;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MinLength(1) @MaxLength(60) unitType!: string;
  @IsOptional() @IsEnum(UnitUsage) usage?: UnitUsage;

  @IsString() @MinLength(2) @MaxLength(80) city!: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(120) compound?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  /** A primary sale is a developer's unit: the developer is required. */
  @ValidateIf((o: CreateListingDto) => o.kind === ListingKind.PRIMARY || o.developerName !== undefined)
  @IsString() @MinLength(2) @MaxLength(120) developerName?: string;
  @IsOptional() @IsString() @MaxLength(120) projectName?: string;

  @Type(() => Number) @IsNumber() @Min(1) area!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-5) floor?: number;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing;
  @IsOptional() @IsEnum(UnitView) view?: UnitView;

  /** The asking price, or the monthly rent for RENT. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) downPayment?: number;
  @IsOptional() @IsDateString() deliveryDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم هاتف المالك غير صحيح' }) ownerPhone?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Matches(PHOTO_URL, { each: true }) photos?: string[];
  @IsOptional() @IsUUID() agentId?: string;
}

/** Every field may change; the kind stays (a rent is never re-filed as a sale). */
export class UpdateListingDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) unitType?: string;
  @IsOptional() @IsEnum(UnitUsage) usage?: UnitUsage;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string | null;
  @IsOptional() @IsString() @MaxLength(120) compound?: string | null;
  @IsOptional() @IsString() @MaxLength(240) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) developerName?: string | null;
  @IsOptional() @IsString() @MaxLength(120) projectName?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) area?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-5) floor?: number | null;
  @IsOptional() @IsEnum(UnitFinishing) finishing?: UnitFinishing | null;
  @IsOptional() @IsEnum(UnitView) view?: UnitView | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) downPayment?: number | null;
  @IsOptional() @IsDateString() deliveryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string | null;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم هاتف المالك غير صحيح' }) ownerPhone?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Matches(PHOTO_URL, { each: true }) photos?: string[];
  @IsOptional() @IsUUID() agentId?: string | null;
}

export class SetListingStatusDto {
  @IsEnum(ListingStatus) status!: ListingStatus;
}

export class ListingPhotoPresignDto {
  @IsString() @Matches(/^image\/(jpeg|png|webp)$/, { message: 'الصور فقط: JPEG أو PNG أو WebP' }) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @IsOptional() @IsString() @MaxLength(8) extension?: string;
}

// ─── Mandates and tenancies (BRK-2) ─────────────────────────────────────────

export class CreateMandateDto {
  @IsEnum(MandateKind) kind!: MandateKind;
  /** A share of the deal (e.g. 2.5), or `commissionAmount` — one of them. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) commissionPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) commissionAmount?: number;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreateTenancyDto {
  @IsString() @MinLength(2) @MaxLength(120) tenantName!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم هاتف المستأجر غير صحيح' }) tenantPhone!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) monthlyRent!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(28) paymentDay!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deposit?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RecordRentPaymentDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'الشهر بصيغة YYYY-MM' }) period!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsDateString() paidOn!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
