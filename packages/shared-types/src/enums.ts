export const UserRole = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  CLIENT: 'CLIENT',
  CUSTOMER: 'CUSTOMER',
  BROKER: 'BROKER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Locale = {
  AR: 'ar',
  EN: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const UnitStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
} as const;
export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const LeadStage = {
  NEW: 'NEW',
  INTERESTED: 'INTERESTED',
  VISIT: 'VISIT',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];

export const VisitStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];

export const ReservationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const InstallmentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type InstallmentStatus = (typeof InstallmentStatus)[keyof typeof InstallmentStatus];

export const MaintenanceStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];

export const BonusEntryStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
} as const;
export type BonusEntryStatus = (typeof BonusEntryStatus)[keyof typeof BonusEntryStatus];

export const NotificationChannel = {
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const MediaType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  FLOORPLAN: 'FLOORPLAN',
  DOCUMENT: 'DOCUMENT',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const BrokerStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type BrokerStatus = (typeof BrokerStatus)[keyof typeof BrokerStatus];

export const BrokerUserStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REMOVED: 'REMOVED',
} as const;
export type BrokerUserStatus = (typeof BrokerUserStatus)[keyof typeof BrokerUserStatus];

export const BrokerCommissionModel = {
  PERCENT_OF_SALE: 'PERCENT_OF_SALE',
  FIXED_PER_UNIT: 'FIXED_PER_UNIT',
  TIERED: 'TIERED',
} as const;
export type BrokerCommissionModel = (typeof BrokerCommissionModel)[keyof typeof BrokerCommissionModel];

export const BrokerLeadStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DUPLICATE: 'DUPLICATE',
  EXPIRED: 'EXPIRED',
} as const;
export type BrokerLeadStatus = (typeof BrokerLeadStatus)[keyof typeof BrokerLeadStatus];
