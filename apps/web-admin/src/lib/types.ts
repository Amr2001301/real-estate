export interface Translatable {
  ar: string;
  en: string;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PlanTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type DownPaymentType = 'FIXED' | 'PERCENTAGE';
export type InstallmentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';
export type StartDateRule = 'MANUAL' | 'AFTER_RESERVATION' | 'AFTER_CONTRACT';
export type PlanPaymentType = 'RESERVATION' | 'DOWN_PAYMENT' | 'INSTALLMENT' | 'FINAL_PAYMENT';
export type UnitStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type LeadStage = 'NEW' | 'INTERESTED' | 'VISIT' | 'NEGOTIATION' | 'WON' | 'LOST';
export type VisitStatus = 'PENDING' | 'APPROVED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type VisitRequestStatus = 'NEW' | 'UNDER_REVIEW' | 'CONVERTED' | 'REJECTED' | 'CANCELLED';
export type VisitRequestSource = 'WEBSITE' | 'MOBILE_APP' | 'SALES' | 'PHONE' | 'WHATSAPP' | 'OTHER';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED';
export type VisitActivityType =
  | 'REQUEST_CREATED' | 'REQUEST_REVIEWED' | 'REQUEST_REJECTED' | 'REQUEST_CANCELLED'
  | 'VISIT_SCHEDULED' | 'VISIT_CONFIRMED' | 'VISIT_COMPLETED' | 'VISIT_CANCELLED'
  | 'VISIT_NO_SHOW' | 'VISIT_RESCHEDULED' | 'SALES_ASSIGNED' | 'NOTE_ADDED';
export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED';
export type ReservationBookingPaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'WAIVED';
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
    hasAccount?: boolean;
  } | null;
  /** Denormalized cache of client contact info; prefer `client.*` in new code. */
  fullName: string;
  phone: string;
  email: string | null;
  sourceId: string | null;
  source?: LeadSource | null;
  projectInterestId: string | null;
  projectInterest?: { id: string; name: Translatable } | null;
  unitInterestId?: string | null;
  unitInterest?: { id: string; code: string } | null;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  stage: LeadStage;
  createdAt: string;
  upcomingVisit?: { id: string; visitNumber: string; scheduledAt: string; status: AppointmentStatus } | null;
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

export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type DepositType = 'BOOKING_AMOUNT' | 'DOWN_PAYMENT' | 'INSTALLMENT' | 'FINAL_PAYMENT';

export interface ContractInstallment {
  id: string;
  type: PlanPaymentType;
  dueDate: string;
  amount: string | number;
  status: InstallmentStatus;
  paidAt: string | null;
}

export interface ContractInstallmentPlan {
  id: string;
  totalMonths: number;
  monthlyAmount: string | number;
  startsAt: string;
  frequency: InstallmentFrequency;
  installments?: ContractInstallment[];
}

export interface Contract {
  id: string;
  contractNumber: string | null;
  customerId: string;
  customer?: { id: string; fullName: string; phone: string | null; email?: string | null };
  unitId: string;
  unit?: Unit;
  reservationId: string | null;
  reservation?: { id: string; reservationNumber: string | null } | null;
  pdfUrl: string | null;
  signedAt: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  createdAt: string;
  installmentPlan?: ContractInstallmentPlan | null;
  deposits?: Deposit[];
}

export interface Deposit {
  id: string;
  type: DepositType;
  contractId: string | null;
  contract?: {
    id: string;
    contractNumber?: string | null;
    customer?: { fullName: string };
    unit?: { id: string; code: string } | null;
  } | null;
  reservationId?: string | null;
  reservation?: {
    id: string;
    reservationNumber?: string | null;
    createdAt?: string;
    expiresAt?: string;
    unit?: { id: string; code: string } | null;
    client?: { id: string; fullName: string } | null;
    lead?: { id: string; fullName: string } | null;
  } | null;
  installmentId?: string | null;
  installment?: { id: string; dueDate: string; amount: string | number; type?: PlanPaymentType } | null;
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
  unit?: { id: string; code: string; type: string } | null;
  preferredDate: string;
  scheduledAt: string | null;
  status: VisitStatus;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // v2 fields
  requestNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  preferredTime: string | null;
  preferredContactMethod: string | null;
  source: VisitRequestSource | null;
  requestNotes: string | null;
  adminNotes: string | null;
  requestStatus: VisitRequestStatus | null;
  convertedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  appointments?: VisitAppointmentSummary[];
  user?: { id: string; fullName: string; phone: string | null; email: string | null } | null;
  lead?: { id: string; fullName: string; phone: string; email: string | null; stage: string } | null;
}

export interface VisitAppointmentSummary {
  id: string;
  visitNumber: string;
  scheduledAt: string;
  status: AppointmentStatus;
  assignedSales?: { id: string; fullName: string } | null;
}

export interface VisitAppointment {
  id: string;
  visitNumber: string;
  visitRequestId: string | null;
  visitRequest?: { id: string; requestNumber: string | null; customerName: string | null; customerPhone: string | null; requestStatus: VisitRequestStatus | null } | null;
  leadId: string | null;
  lead?: { id: string; fullName: string; phone: string; stage: string } | null;
  clientId: string | null;
  client?: { id: string; fullName: string; phone: string | null; email: string | null } | null;
  projectId: string | null;
  project?: { id: string; name: Translatable } | null;
  unitId: string | null;
  unit?: { id: string; code: string; type: string } | null;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string; phone: string | null } | null;
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingPoint: string | null;
  status: AppointmentStatus;
  salesNotes: string | null;
  customerFeedback: string | null;
  resultNotes: string | null;
  cancellationReason: string | null;
  noShowReason: string | null;
  createdById: string | null;
  createdBy?: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  visitActivities?: VisitActivity[];
}

export interface VisitActivity {
  id: string;
  visitRequestId: string | null;
  visitId: string | null;
  leadId: string | null;
  clientId: string | null;
  actorId: string | null;
  actor?: { id: string; fullName: string; role: string } | null;
  actorRole: string | null;
  type: VisitActivityType;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  reservationNumber: string | null;
  unitId: string;
  unit?: Unit;
  salesId: string;
  sales?: { id: string; fullName: string };
  leadId: string | null;
  lead?: { id: string; fullName: string; phone: string; email?: string | null } | null;
  clientId: string | null;
  client?: { id: string; fullName: string; phone: string | null; email?: string | null } | null;
  status: ReservationStatus;
  notes: string | null;
  reason: string | null;
  expiresAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Booking amount (manual tracking, recorded by Admin)
  bookingAmount: string | number;
  bookingPaymentStatus: ReservationBookingPaymentStatus;
  bookingPaidAt: string | null;
  bookingNotes: string | null;
  installmentPlanTemplateId: string | null;
  installmentPlanTemplate?: {
    id: string;
    name: string;
    reservationAmount: string | number;
    status?: PlanTemplateStatus;
    projectId?: string;
    unitId?: string | null;
  } | null;
  // Selected duration option + financial snapshot (frozen at create time).
  selectedDurationOptionId: string | null;
  selectedDurationOption?: {
    id: string;
    durationMonths: number;
    increasePercentage: string | number;
  } | null;
  selectedDurationMonths: number | null;
  selectedIncreasePercentage: string | number | null;
  snapshotDownPaymentAmount: string | number | null;
  snapshotRemainingAmount: string | number | null;
  snapshotFinancedAmount: string | number | null;
  snapshotMonthlyInstallment: string | number | null;
  snapshotTotalPayable: string | number | null;
  snapshotFinalPaymentAmount: string | number | null;
  reservationNotes?: ReservationNote[];
  activities?: ReservationActivity[];
  contract?: { id: string; contractNumber: string | null } | null;
}

export interface ReservationNote {
  id: string;
  body: string;
  createdAt: string;
  author?: { id: string; fullName: string } | null;
}

export type ReservationActivityType =
  | 'CREATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NOTE_ADDED'
  | 'BOOKING_PAYMENT_CONFIRMED'
  | 'BOOKING_PAYMENT_UNCONFIRMED'
  | 'CONVERTED';

export interface ReservationActivity {
  id: string;
  reservationId: string;
  type: ReservationActivityType;
  actorId: string | null;
  actor?: { id: string; fullName: string } | null;
  note: string | null;
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

export interface PlanTemplateScheduleItem {
  id: string;
  planId: string;
  paymentNumber: number;
  paymentType: PlanPaymentType;
  dueDate: string | null;
  amount: string | number;
  remainingBalance: string | number;
}

export interface InstallmentPlanTemplate {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  project?: { id: string; name: Translatable };
  unitId: string | null;
  unit?: { id: string; code: string; type?: string; price?: string | number } | null;
  totalPrice: string | number;
  discountAmount: string | number;
  netPrice: string | number;
  reservationAmount: string | number;
  downPaymentType: DownPaymentType;
  downPaymentValue: string | number;
  downPaymentAmount: string | number;
  installmentsCount: number | null;
  frequency: InstallmentFrequency;
  startDateRule: StartDateRule;
  manualStartDate: string | null;
  finalPaymentAmount: string | number | null;
  visibility: string;
  status: PlanTemplateStatus;
  createdBy?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
  scheduleItems?: PlanTemplateScheduleItem[];
  durationOptions?: InstallmentPlanDurationOption[];
}

export interface DurationOptionCalculated {
  remainingAmount: number;
  financedAmount: number;
  monthlyInstallment: number;
  totalPayable: number;
}

export interface InstallmentPlanDurationOption {
  id: string;
  durationMonths: number;
  increasePercentage: string | number;
  order: number;
  calculated?: DurationOptionCalculated;
}
