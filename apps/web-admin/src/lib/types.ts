export interface Translatable {
  ar: string;
  en: string;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type UnitStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type LeadStage = 'NEW' | 'INTERESTED' | 'VISIT' | 'NEGOTIATION' | 'WON' | 'LOST';
export type VisitStatus = 'PENDING' | 'APPROVED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type UserRole = 'ADMIN' | 'SALES' | 'CLIENT' | 'CUSTOMER';
export type MediaType = 'IMAGE' | 'VIDEO' | 'FLOORPLAN' | 'DOCUMENT';

export interface Media {
  id: string;
  url: string;
  type: MediaType;
  order: number;
}

export interface Project {
  id: string;
  name: Translatable;
  description: Translatable;
  city: string;
  lat: number;
  lng: number;
  status: ProjectStatus;
  featured: boolean;
  services: Translatable[];
  createdAt: string;
  updatedAt: string;
  media?: Media[];
  phases?: Phase[];
}

export interface Phase {
  id: string;
  projectId: string;
  name: Translatable;
  order: number;
  buildings?: Building[];
}

export interface Building {
  id: string;
  phaseId: string;
  name: string;
  totalFloors: number;
  order: number;
  units?: Unit[];
  _count?: { units: number };
}

export interface UnitStatusHistoryEntry {
  id: string;
  unitId: string;
  oldStatus: UnitStatus;
  newStatus: UnitStatus;
  changedById: string | null;
  changedBy?: { id: string; fullName: string } | null;
  reason: string | null;
  changedAt: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  price: string | number;
  status: UnitStatus;
  reservationExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  media?: Media[];
  building?: Building & { phase?: Phase & { project?: Project } };
  history?: UnitStatusHistoryEntry[];
}

export interface Lead {
  id: string;
  /** Linked Client (User). Required at the schema level after the
   *  `link_leads_to_clients` migration; older rows always have it post-backfill. */
  clientId: string;
  client?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    role: UserRole;
    locale?: 'ar' | 'en';
    active?: boolean;
    createdAt?: string;
  } | null;
  /** Denormalized cache of client contact info; prefer `client.*` in new code. */
  fullName: string;
  phone: string;
  email: string | null;
  sourceId: string | null;
  source?: LeadSource | null;
  projectInterestId: string | null;
  projectInterest?: { id: string; name: Translatable } | null;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  stage: LeadStage;
  createdAt: string;
  notes?: LeadNote[];
}

export interface LeadSource {
  id: string;
  name: Translatable;
  active: boolean;
}

export interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  sales?: { id: string; fullName: string };
}

export interface Contract {
  id: string;
  customerId: string;
  customer?: { id: string; fullName: string; phone: string | null };
  unitId: string;
  unit?: Unit;
  pdfUrl: string | null;
  signedAt: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  createdAt: string;
  installmentPlan?: unknown;
}

export interface Deposit {
  id: string;
  contractId: string;
  contract?: { id: string; customer?: { fullName: string } };
  amount: string | number;
  paidAt: string;
  receiptUrl: string | null;
  recordedById: string;
  verified: boolean;
  createdAt: string;
}

export interface VisitRequest {
  id: string;
  userId: string | null;
  leadId: string | null;
  projectId: string;
  project?: { id: string; name: Translatable };
  unitId: string | null;
  unit?: Unit;
  preferredDate: string;
  scheduledAt: string | null;
  status: VisitStatus;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  notes: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  unitId: string;
  unit?: Unit;
  salesId: string;
  sales?: { id: string; fullName: string };
  leadId: string | null;
  lead?: { id: string; fullName: string; phone: string };
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  customerId: string;
  customer?: { id: string; fullName: string };
  unitId: string;
  unit?: Unit;
  categoryId: string;
  category?: { id: string; name: Translatable };
  description: string;
  status: MaintenanceStatus;
  assignedAdminId: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  fullName: string;
  locale: 'ar' | 'en';
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt: string | null;
}
