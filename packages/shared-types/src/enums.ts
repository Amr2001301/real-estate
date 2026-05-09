export const UserRole = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  CLIENT: 'CLIENT',
  CUSTOMER: 'CUSTOMER',
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
