import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LeadCallResult, LeadFollowUpType, LeadNoteKind, LeadStage } from '@prisma/client';

export class CreateLeadDto {
  // When `clientId` is provided we link to an existing User and ignore the
  // person-level fields below. When omitted, the service finds-or-creates a
  // User by phone (legacy callers stay compatible).
  @IsOptional() @IsUUID() clientId?: string;

  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsUUID() projectInterestId?: string;
  @IsOptional() @IsUUID() unitInterestId?: string;
  @IsOptional() @IsUUID() assignedSalesId?: string;
  @IsOptional() @IsString() notes?: string;
  /** The marketing campaign that brought the lead. */
  @IsOptional() @IsUUID() campaignId?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsOptional() @IsUUID() projectInterestId?: string;
  @IsOptional() @IsUUID() unitInterestId?: string;
  /** Correct the campaign that brought the lead (null: none). */
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() campaignId?: string | null;
  // No assignedSalesId: assigning goes through PATCH leads/:id/assign, which
  // checks who may assign to whom, records it and tells both reps.
}

export class UpdateLeadStageDto {
  @IsEnum(LeadStage) stage!: LeadStage;
  @IsOptional() @IsString() reason?: string;
  /** Why the lead was lost — one of the company's active lost reasons (LOST only). */
  @IsOptional() @IsUUID() lostReasonId?: string;
  /** A word on what happened (LOST only). */
  @IsOptional() @IsString() @MaxLength(1000) lostNote?: string;
}

export class AssignLeadDto {
  @IsUUID() assignedSalesId!: string;
}

export class CreateLeadNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
  /** What happened: a call, a meeting, a WhatsApp chat… (a plain note by default). */
  @IsOptional() @IsEnum(LeadNoteKind) kind?: LeadNoteKind;
  /** How the call went — calls only. */
  @ValidateIf((o: CreateLeadNoteDto) => o.callResult != null)
  @IsEnum(LeadCallResult)
  callResult?: LeadCallResult | null;
  /** A reply to another note on the same lead; replies carry no follow-up. */
  @IsOptional() @IsUUID() parentId?: string;
  /**
   * The next follow-up: an ISO instant sets it, `null` clears it, and leaving
   * it out keeps whatever the lead already has.
   */
  @ValidateIf((o: CreateLeadNoteDto) => o.nextActionAt != null)
  @IsDateString()
  nextActionAt?: string | null;
  @IsOptional() @IsEnum(LeadFollowUpType) nextActionType?: LeadFollowUpType;
  @IsOptional() @IsString() @MaxLength(500) nextActionNote?: string;
}

export class CreateLostReasonDto {
  @IsString() @IsNotEmpty() @MaxLength(120) ar!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) en!: string;
}

export class UpdateLostReasonDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) ar?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) en?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export const FOLLOW_UP_BUCKETS = ['overdue', 'today', 'upcoming'] as const;
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

export class CreateLeadSourceDto {
  @IsString() @IsNotEmpty() ar!: string;
  @IsString() @IsNotEmpty() en!: string;
}

export class UpdateLeadSourceDto {
  @IsOptional() @IsString() @IsNotEmpty() ar?: string;
  @IsOptional() @IsString() @IsNotEmpty() en?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
