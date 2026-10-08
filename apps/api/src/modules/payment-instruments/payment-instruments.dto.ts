import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentInstrumentStatus, PaymentInstrumentType } from '@prisma/client';

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

  /**
   * Sub-case B only: how to reopen installments that were PAID.
   * REOPEN_AS_OVERDUE = OVERDUE if dueDate < now(), else PENDING (tenant default).
   * REOPEN_AS_PENDING = always PENDING.
   * Operator selects from dropdown in bounce modal; this stored value is what counts.
   * Has no effect on Sub-case A installments (they were never PAID).
   */
  @IsOptional()
  @IsEnum(['REOPEN_AS_OVERDUE', 'REOPEN_AS_PENDING'])
  installmentAction?: 'REOPEN_AS_OVERDUE' | 'REOPEN_AS_PENDING';
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

/** FG-01 — the cheques page: filter by state, type and due date. */
export class ListPaymentInstrumentsQueryDto {
  @IsOptional() @IsEnum(PaymentInstrumentStatus) status?: PaymentInstrumentStatus;
  @IsOptional() @IsEnum(PaymentInstrumentType) type?: PaymentInstrumentType;
  /** Cheque due on or after this date. */
  @IsOptional() @IsDateString() dueFrom?: string;
  /** Cheque due on or before this date. */
  @IsOptional() @IsDateString() dueTo?: string;
  /** Cheque / reference number, drawer bank, or the customer's name. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
