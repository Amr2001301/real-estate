import { Type } from 'class-transformer';
import {
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
import { ListingKind } from '@prisma/client';

/**
 * A closed deal. From a listing, the kind, developer and agent come from it;
 * without one, `kind` is required. The customer is a lead or a name + phone.
 */
export class CreateDealDto {
  @IsOptional() @IsUUID() listingId?: string;
  @ValidateIf((o: CreateDealDto) => !o.listingId) @IsEnum(ListingKind) kind?: ListingKind;
  @IsOptional() @IsUUID() leadId?: string;
  @ValidateIf((o: CreateDealDto) => !o.leadId)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'رقم هاتف العميل غير صحيح' })
  customerPhone?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) dealValue!: number;
  @IsDateString() closedOn!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) commissionTotal!: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) developerName?: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CancelDealDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class RecordCommissionDto {
  /** The total collected so far from the parties (resale / rent). */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) commissionReceived!: number;
}

export class SetCommissionRuleDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) agentPct!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) managerPct!: number;
}

export class SubmitClaimDto {
  @IsDateString() submittedOn!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RejectClaimDto {
  @IsString() @MinLength(3) @MaxLength(1000) notes!: string;
}

export class RecordClaimPaymentDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsDateString() receivedOn!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class SetTargetDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) commissionTarget!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000) dealsTarget!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) bonusAmount!: number;
}
