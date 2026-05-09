import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { LeadStage } from '@prisma/client';

export class CreateLeadDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsString() phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsUUID() projectInterestId?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsUUID() projectInterestId?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
}

export class UpdateLeadStageDto {
  @IsEnum(LeadStage) stage!: LeadStage;
  @IsOptional() @IsString() reason?: string;
}

export class AssignLeadDto {
  @IsUUID() assignedSalesId!: string;
}

export class CreateLeadNoteDto {
  @IsString() body!: string;
}

export class CreateLeadSourceDto {
  @IsString() ar!: string;
  @IsString() en!: string;
}
