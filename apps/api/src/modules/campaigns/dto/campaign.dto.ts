import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignChannel, CampaignStatus } from '@prisma/client';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[a-z0-9][a-z0-9_-]{1,59}$/;

export class CreateCampaignDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  /** The utm_campaign its links carry; made from the name when left out. */
  @IsOptional() @IsString() @Matches(CODE, { message: 'code: lowercase letters, digits, - and _ (2–60)' }) code?: string;
  @IsEnum(CampaignChannel) channel!: CampaignChannel;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @Matches(DAY) startDate?: string;
  @IsOptional() @Matches(DAY) endDate?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) budget?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(CampaignChannel) channel?: CampaignChannel;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  /** null clears it. */
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() projectId?: string | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() sourceId?: string | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @Matches(DAY) startDate?: string | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @Matches(DAY) endDate?: string | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) budget?: number | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class AddCampaignSpendDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  /** The day it was spent (company day, YYYY-MM-DD). */
  @IsDateString() @Matches(DAY) spentOn!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
