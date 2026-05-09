import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class TranslatableDto {
  @IsString()
  ar!: string;

  @IsString()
  en!: string;
}

export class CreateProjectDto {
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

export class ProjectQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

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
