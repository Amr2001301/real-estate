import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';
import { ENTITY_CODE_PATTERN, normalizeEntityCode } from '../../../common/utils/entity-code';

export class TranslatableDto {
  @IsString()
  ar!: string;

  @IsString()
  en!: string;
}

export class CreateProjectDto {
  @Transform(({ value }) => normalizeEntityCode(value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(ENTITY_CODE_PATTERN, {
    message: 'code must be 2–64 characters: uppercase letters, digits, and hyphens (e.g. NILE-CREST)',
  })
  code!: string;

  @ValidateNested()
  @Type(() => TranslatableDto)
  name!: TranslatableDto;

  @ValidateNested()
  @Type(() => TranslatableDto)
  description!: TranslatableDto;

  @IsString()
  city!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslatableDto)
  services?: TranslatableDto[];
}

export class UpdateProjectDto {
  @IsOptional()
  @Transform(({ value }) => normalizeEntityCode(value))
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(ENTITY_CODE_PATTERN, {
    message: 'code must be 2–64 characters: uppercase letters, digits, and hyphens (e.g. NILE-CREST)',
  })
  code?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranslatableDto)
  name?: TranslatableDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TranslatableDto)
  description?: TranslatableDto;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslatableDto)
  services?: TranslatableDto[];
}

/**
 * Whitelisted public sort options. Maps only to real, safe scalar fields
 * (createdAt). Project has no price column and `name` is JSON (not orderable by
 * Prisma), so price/name sorts are intentionally unsupported.
 */
export enum ProjectSort {
  newest = 'newest',
  oldest = 'oldest',
}

export class ProjectQueryDto {
  @IsOptional()
  @IsEnum(ProjectSort)
  sort?: ProjectSort;

  @IsOptional()
  @IsString()
  city?: string;

  /** Match any of these cities (e.g. Arabic + English spellings). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cityIn?: string[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
