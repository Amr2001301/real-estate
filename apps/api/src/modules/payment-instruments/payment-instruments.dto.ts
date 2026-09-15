import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentInstrumentType } from '@prisma/client';

export class CreatePaymentInstrumentDto {
  @IsEnum(PaymentInstrumentType)
  type: PaymentInstrumentType;

  // Bank-transfer fields
  @IsOptional() @IsString() @MaxLength(200) bankName?: string;
  @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;

  // Cheque-specific fields
  @IsOptional() @IsString() @MaxLength(100) chequeNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) drawerBankName?: string;
  @IsOptional() @IsDateString() chequeDueDate?: string;
}

export class RecordBounceDto {
  /** Mandatory reason — stored verbatim in the audit log. */
  @IsString() @IsNotEmpty() @MaxLength(500) bounceReason: string;

  @IsDateString() bounceDate: string;

  /**
   * Operator-entered penalty amount. 0 = no BOUNCE_PENALTY installment.
   * Settings value is a suggestion only — this value is what gets stored.
   */
  @IsNumber() @Min(0) penaltyAmount: number;

  /**
   * Due date for the BOUNCE_PENALTY installment. Required when penaltyAmount > 0.
   */
  @IsOptional() @IsDateString() penaltyDueDate?: string;
}

export class ReplaceInstrumentDto {
  /** New instrument details — creates a PENDING_CLEARANCE replacement. */
  @IsEnum(PaymentInstrumentType)
  type: PaymentInstrumentType;

  @IsOptional() @IsString() @MaxLength(200) bankName?: string;
  @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) chequeNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) drawerBankName?: string;
  @IsOptional() @IsDateString() chequeDueDate?: string;
}

export class RecordClearingDto {
  @IsOptional() @IsDateString() clearingDate?: string;
}
