import {
  IsBoolean,
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
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepositReviewStatus, DepositType, PaymentMethod } from '@prisma/client';

export class RecordDepositDto {
  @IsUUID() contractId!: string;
  @IsUUID() installmentId!: string;
  @IsNumber() @IsPositive() amount!: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() receiptUrl?: string;
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
