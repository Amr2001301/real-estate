import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PAYABLE_GROUPS, RECEIVABLE_GROUPS, type LedgerGroup, type LedgerState } from './ledger.service';
import { DepositType } from '@prisma/client';

export class FinancialDashboardQueryDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(DepositType) type?: DepositType;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

/** «ليا وعليا»: the period (calendar days, company time zone), project and search. */
export class LedgerQueryDto {
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}

export class LedgerRowsQueryDto extends LedgerQueryDto {
  @IsIn([...RECEIVABLE_GROUPS, ...PAYABLE_GROUPS]) group!: LedgerGroup;
  @IsOptional() @IsIn(['late', 'dueToday', 'upcoming', 'onItsWay', 'pendingApproval']) state?: LedgerState;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}
