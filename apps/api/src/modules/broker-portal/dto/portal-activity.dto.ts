import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export type PortalActivityType =
  | 'LEAD_SUBMITTED'
  | 'VISIT_REQUESTED'
  | 'LEAD_APPROVED'
  | 'LEAD_REJECTED'
  | 'LEAD_MARKED_DUPLICATE'
  | 'RESERVATION_CREATED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SIGNED'
  | 'COMMISSION_EARNED'
  | 'COMMISSION_APPROVED'
  | 'COMMISSION_REJECTED'
  | 'COMMISSION_CANCELLED'
  | 'PAYOUT_CREATED'
  | 'PAYOUT_APPROVED'
  | 'PAYOUT_PROCESSING'
  | 'PAYOUT_PAID'
  | 'PAYOUT_CANCELLED';

const PORTAL_ACTIVITY_TYPES = [
  'LEAD_SUBMITTED',
  'VISIT_REQUESTED',
  'LEAD_APPROVED',
  'LEAD_REJECTED',
  'LEAD_MARKED_DUPLICATE',
  'RESERVATION_CREATED',
  'CONTRACT_CREATED',
  'CONTRACT_SIGNED',
  'COMMISSION_EARNED',
  'COMMISSION_APPROVED',
  'COMMISSION_REJECTED',
  'COMMISSION_CANCELLED',
  'PAYOUT_CREATED',
  'PAYOUT_APPROVED',
  'PAYOUT_PROCESSING',
  'PAYOUT_PAID',
  'PAYOUT_CANCELLED',
] as const;

type EntityType = 'Lead' | 'VisitRequest' | 'Reservation' | 'Contract' | 'Commission' | 'Payout';
const ENTITY_TYPES = ['Lead', 'VisitRequest', 'Reservation', 'Contract', 'Commission', 'Payout'] as const;

export class PortalActivityQueryDto {
  @IsOptional()
  @IsEnum(PORTAL_ACTIVITY_TYPES)
  type?: PortalActivityType;

  @IsOptional()
  @IsEnum(ENTITY_TYPES)
  entityType?: EntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
