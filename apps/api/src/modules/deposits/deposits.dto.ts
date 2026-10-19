import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepositReviewStatus, DepositType, PaymentMethod, type Prisma } from '@prisma/client';

/** FG-01 — the cheque a payment was made with (one cheque per installment). */
export class DepositChequeDto {
  @IsString() @IsNotEmpty() @MaxLength(100) chequeNumber!: string;
  @IsOptional() @IsString() @MaxLength(200) drawerBankName?: string;
  @IsDateString() chequeDueDate!: string;
}

/** FG-01 — optional details of a bank transfer (counted as collected at once). */
export class DepositTransferDto {
  @IsOptional() @IsString() @MaxLength(200) bankName?: string;
  @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;
}

export class RecordDepositDto {
  @IsUUID() contractId!: string;
  @IsUUID() installmentId!: string;
  @IsNumber() @IsPositive() amount!: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  /**
   * Required when paymentMethod is CHEQUE. The installment is NOT marked paid:
   * the deposit waits (PENDING_REVIEW) until the cheque clears or bounces on
   * /payment-instruments.
   */
  @IsOptional() @ValidateNested() @Type(() => DepositChequeDto) cheque?: DepositChequeDto;
  /** Optional with BANK_TRANSFER; stored as a CLEARED payment instrument. */
  @IsOptional() @ValidateNested() @Type(() => DepositTransferDto) transfer?: DepositTransferDto;
}

/** Payment methods that count as collected at once (no cheque). */
export const IMMEDIATE_METHODS = [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER] as const;

/**
 * One payment covering several installments of one contract (cash or a bank
 * transfer). Each installment gets its own deposit; a transfer is one
 * instrument shared by all of them.
 */
export class RecordDepositsBatchDto {
  @IsUUID() contractId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(600) @ArrayUnique() @IsUUID('all', { each: true }) installmentIds!: string[];
  /** When given, must equal the installments' total — a check against typos. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount?: number;
  @IsIn(IMMEDIATE_METHODS) paymentMethod!: PaymentMethod;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @ValidateNested() @Type(() => DepositTransferDto) transfer?: DepositTransferDto;
}

/** Early settlement: every unpaid installment of the contract in one payment. */
export class SettleContractDto {
  @IsUUID() contractId!: string;
  /** The amount the customer is paying — must equal what's left. */
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  @IsIn(IMMEDIATE_METHODS) paymentMethod!: PaymentMethod;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @ValidateNested() @Type(() => DepositTransferDto) transfer?: DepositTransferDto;
}

/**
 * A contract signed before the system: its instalments due before it was
 * entered, marked paid on their due dates. `upTo` stops earlier (a day,
 * YYYY-MM-DD) when the customer had fallen behind.
 */
export class PaidBeforeSystemDto {
  @IsUUID() contractId!: string;
  @IsOptional() @IsDateString() upTo?: string;
}

export class VerifyDepositDto {
  @IsBoolean() verified!: boolean;
}

// Attach (or replace) the payment proof for an existing deposit. Updates the
// legacy receiptUrl AND links a first-class RECEIPT document.
export class AttachReceiptDto {
  @IsString() receiptUrl!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
  @IsOptional() @IsString() title?: string;
}

// ── P11 — payment-proof review DTOs ────────────────────────────────────────

/**
 * Customer submits a payment proof. Exactly ONE target must be provided:
 *   - `installmentId` → installment / down-payment / final-payment proof, OR
 *   - `reservationId` → booking-amount proof (Gap 3).
 * `amount` is required for the installment path (must match the installment);
 * for the booking path it is ignored — the reservation's bookingAmount is the
 * authoritative source.
 */
export class CustomerSubmitProofDto {
  @IsOptional() @IsUUID() installmentId?: string;
  @IsOptional() @IsUUID() reservationId?: string;
  @IsOptional() @IsNumber() @IsPositive() amount?: number;
  @IsDateString() paidAt!: string;
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  /** R2 public URL minted by the customer-side presign endpoint. */
  @IsString() receiptUrl!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
  /** Optional customer note / reference number (e.g. bank transfer ref). */
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Customer resubmits proof after a rejection. Allowed only when current
 *  status is REJECTED. Same payload shape as submit. */
export class CustomerResubmitProofDto {
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsString() receiptUrl!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sizeBytes?: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Admin approves a customer-submitted payment proof. */
export class ApproveDepositDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Admin rejects a customer-submitted payment proof with a required reason.
 *  Mirrors RejectBrokerLeadDto in shape and cap. */
export class RejectDepositDto {
  @IsString() @MaxLength(2000) reason!: string;
}

/**
 * Admin manually reverses an APPROVED deposit (deposits:reverse).
 * Writes a PaymentCorrection(REVERSAL) and reopens the linked installment as
 * PENDING. Reason is MANDATORY (§6.2) and stored in the correction row.
 */
export class ReverseDepositDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
}

/** Customer-side presign request (folder forced to 'receipts' server-side). */
export class CustomerPresignDto {
  @IsString() @MaxLength(120) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) sizeBytes!: number;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
}

export class ListDepositsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsUUID() contractId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsEnum(DepositType) type?: DepositType;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsDateString() paidAtFrom?: string;
  @IsOptional() @IsDateString() paidAtTo?: string;
  @IsOptional() @IsDateString() dueDateFrom?: string;
  @IsOptional() @IsDateString() dueDateTo?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsEnum(DepositReviewStatus) reviewStatus?: DepositReviewStatus;
}

export interface ListDepositsOpts {
  page: number;
  pageSize: number;
  // legacy
  contractId?: string;
  customerId?: string;
  /** Replaces the customerId match when set (the customer's own view). */
  ownerWhere?: Prisma.DepositWhereInput;
  // new filters
  type?: DepositType;
  projectId?: string;
  unitId?: string;
  q?: string;          // customer name search
  ref?: string;        // contract/reservation number search
  paidAtFrom?: string;
  paidAtTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  verified?: boolean;
  // P11
  reviewStatus?: DepositReviewStatus;
}
