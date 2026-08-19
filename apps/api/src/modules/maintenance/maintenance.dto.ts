import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';

export enum SlaUnit {
  HOURS = 'HOURS',
  DAYS = 'DAYS',
}

export enum WarrantyUnit {
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

export class CreateCategoryDto {
  @IsString() ar!: string;
  @IsString() en!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsInt() @Min(1) slaValue?: number;
  @IsOptional() @IsEnum(SlaUnit) slaUnit?: SlaUnit;
  @IsOptional() @IsInt() @Min(1) warrantyValue?: number;
  @IsOptional() @IsEnum(WarrantyUnit) warrantyUnit?: WarrantyUnit;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() ar?: string;
  @IsOptional() @IsString() en?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsInt() @Min(1) slaValue?: number;
  @IsOptional() @IsEnum(SlaUnit) slaUnit?: SlaUnit;
  @IsOptional() @IsInt() @Min(1) warrantyValue?: number;
  @IsOptional() @IsEnum(WarrantyUnit) warrantyUnit?: WarrantyUnit;
}

export class CreateRequestDto {
  @IsUUID() unitId!: string;
  // Single category (back-compat) or multiple categories (new multi-item flow);
  // at least one must resolve.
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) categoryIds?: string[];
  @IsString() @MinLength(5) description!: string;
}

// Admin create-on-behalf (uses the existing maintenance:create permission).
export class AdminCreateRequestDto {
  @IsUUID() customerId!: string;
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) categoryIds?: string[];
  @IsString() @MinLength(5) description!: string;
  @IsOptional() @IsUUID() assignedAdminId?: string;
}

export class AssignMaintenanceDto {
  @IsUUID() assignedAdminId!: string;
}

export class MaintenanceStatusDto {
  @IsEnum(MaintenanceStatus) status!: MaintenanceStatus;
}

// Customer confirms a resolved request with a required 1–5 rating + optional note.
export class ConfirmResolutionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

// Scoped maintenance uploads (supervisor + customer) — presign + register.
// Owner is forced server-side to the in-scope MAINTENANCE_REQUEST, so these
// DTOs never carry ownerType/ownerId/category/visibility from the client.
export class MaintenanceDocPresignDto {
  @IsString() @MaxLength(120) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}

export class MaintenanceDocDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(2048) fileUrl!: string;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(120) mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
}
