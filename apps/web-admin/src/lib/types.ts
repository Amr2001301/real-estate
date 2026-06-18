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
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'PENDING_RESCHEDULE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED';
export type VisitActivityType =
  | 'REQUEST_CREATED' | 'REQUEST_REVIEWED' | 'REQUEST_REJECTED' | 'REQUEST_CANCELLED'
  | 'VISIT_SCHEDULED' | 'VISIT_CONFIRMED' | 'VISIT_COMPLETED' | 'VISIT_CANCELLED'
  | 'VISIT_NO_SHOW' | 'VISIT_RESCHEDULED' | 'SALES_ASSIGNED' | 'NOTE_ADDED'
  // P2 — two-sided confirmation activity types
  | 'CUSTOMER_CONFIRMED' | 'CUSTOMER_RESCHEDULE_REQUESTED' | 'REMINDER_SENT' | 'SALES_REASSIGNED';
export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED';
export type ReservationBookingPaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'WAIVED';
export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type UserRole = 'ADMIN' | 'SALES' | 'SALES_MANAGER' | 'CLIENT' | 'CUSTOMER' | 'BROKER' | 'MAINTENANCE_SUPERVISOR';
export type MediaType = 'IMAGE' | 'VIDEO' | 'FLOORPLAN' | 'DOCUMENT';
export type BrokerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type BrokerUserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type BrokerCommissionModel = 'PERCENT_OF_SALE' | 'FIXED_PER_UNIT' | 'TIERED';
export type BrokerLeadStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'EXPIRED';

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
  // ── Broker attribution (present only for broker-origin leads) ──
  brokerId?: string | null;
  brokerApprovalStatus?: BrokerLeadStatus | null;
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
  } | null;
  brokerAgentId?: string | null;
  brokerAgent?: { id: string; fullName: string } | null;
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
  reservation?: {
    id: string;
    reservationNumber: string | null;
    commissionLockedPct?: string | number | null;
    commissionLockedAmount?: string | number | null;
    sales?: { id: string; fullName: string; email: string | null; phone: string | null } | null;
    lead?: { id: string; fullName: string; phone: string } | null;
  } | null;
  pdfUrl: string | null;
  signedAt: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  createdAt: string;
  brokerId?: string | null;
  brokerAgentId?: string | null;
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  brokerAgent?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  installmentPlan?: ContractInstallmentPlan | null;
  deposits?: Deposit[];
}

export interface PortalContract {
  id: string;
  contractNumber: string | null;
  customerId: string;
  unitId: string;
  reservationId: string | null;
  brokerId: string | null;
  brokerAgentId: string | null;
  pdfUrl: string | null;
  signedAt: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  unit?: {
    id: string;
    code: string;
    type: string;
    price: string | number;
    status: UnitStatus;
    area?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    building?: {
      id: string;
      name: string;
      phase: {
        id: string;
        projectId: string;
        project: {
          id: string;
          name: Translatable;
          city: string;
          status: ProjectStatus;
        };
      };
    };
  };
  reservation?: {
    id: string;
    reservationNumber: string | null;
    commissionLockedPct: string | number | null;
    commissionLockedAmount: string | number | null;
    sales: { id: string; fullName: string; email: string | null; phone: string | null } | null;
    lead: { id: string; fullName: string; phone: string } | null;
  } | null;
  installmentPlan?: ContractInstallmentPlan | null;
  deposits?: Deposit[];
}

export interface AdminBrokerContract extends PortalContract {
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  brokerAgent?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface DepositTotals {
  totalAmount: string;
  bookingAmount: string;
  downPayment: string;
  installment: string;
  finalPayment: string;
  count: number;
}

export interface PagedDeposits extends Paged<Deposit> {
  totals: DepositTotals;
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
  // P11 — payment-proof review.
  reviewStatus?: 'NO_PROOF' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; fullName: string } | null;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER' | null;
  proofDocument?: {
    id: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
  } | null;
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

/** P13 — Admin view of a customer info/general inquiry. Includes the submitter
 *  contact (authenticated user OR guest lead) so admins can reach out. Guest
 *  inquiries have userId=null and surface via the lead (or anonymously). */
export interface AdminInfoRequest {
  id: string;
  userId: string | null;
  leadId: string | null;
  projectId: string | null;
  project?: { id: string; name: Translatable } | null;
  unitId: string | null;
  unit?: { id: string; code: string; type: string } | null;
  message: string;
  status: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    role: string;
  } | null;
  lead?: { id: string; fullName: string; phone: string | null; email: string | null } | null;
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
  // Gap 7 — dedicated post-visit ratings (customer-submitted vs sales-submitted).
  customerRating: number | null;
  customerRatingText: string | null;
  customerRatingSubmittedAt: string | null;
  salesRating: number | null;
  salesRatingText: string | null;
  salesRatingSubmittedAt: string | null;
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
  // Booking-payment deposits (type BOOKING_AMOUNT) linked to this reservation.
  // The Deposit is the source of truth for payment proof/receipt documents.
  deposits?: Array<{
    id: string;
    amount: string | number;
    paidAt: string;
    verified: boolean;
    receiptUrl: string | null;
    createdAt: string;
  }>;
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

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MaintenanceReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MaintenanceCategory {
  id: string;
  code: string | null;
  name: Translatable;
  active: boolean;
  priority: MaintenancePriority;
  slaDurationMinutes: number | null;
  warrantyDurationMonths: number | null;
}

export type WarrantyStatus = 'IN_WARRANTY' | 'OUT_OF_WARRANTY' | 'UNKNOWN';

export interface UnitMaintenanceItem {
  id: string;
  unitId: string;
  categoryId: string | null;
  category: { id: string; code: string | null; name: Translatable; active: boolean } | null;
  name: Translatable;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  // Display-only verdict computed by the API from warrantyEnd.
  warrantyStatus: WarrantyStatus;
  supplierName: string | null;
  contractorName: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceReportSummary {
  totalRequests: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  overdueCount: number;
  inWarrantyCount: number;
  outOfWarrantyCount: number;
  unknownWarrantyCount: number;
  avgResolutionHours: number | null;
  resolvedWithinSlaCount: number;
  resolvedOverdueCount: number;
  slaAttainmentPercent: number | null;
  avgDelayHours: number | null;
  byCategory: Array<{
    categoryId: string;
    categoryName: Translatable | null;
    count: number;
    overdueCount: number;
    outOfWarrantyCount: number;
  }>;
  byAssignee: Array<{
    userId: string;
    name: string;
    count: number;
    overdueCount: number;
    inProgressCount: number;
  }>;
  expiringWarranties: Array<{
    id: string;
    unitCode: string;
    categoryName: Translatable | null;
    warrantyEnd: string | null;
  }>;
}

export interface MaintenanceRequestItem {
  id: string;
  itemId: string | null;
  categoryId: string;
  category?: { id: string; name: Translatable };
  categoryPrioritySnapshot: MaintenancePriority;
  handlingSlaMinutesSnapshot: number | null;
  warrantyStatusSnapshot: WarrantyStatus;
  warrantyEndSnapshot: string | null;
}

// Phase A — who has confirmed a maintenance request's resolution.
export type MaintenanceResolutionConfirmedBy = 'CUSTOMER' | 'SUPERVISOR' | 'BOTH';

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
  reviewStatus: MaintenanceReviewStatus;
  priority: MaintenancePriority | null;
  dueAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  maxHandlingSlaMinutesSnapshot: number | null;
  assignedAdminId: string | null;
  createdAt: string;
  items?: MaintenanceRequestItem[];
  // Phase A — resolution loop (all additive/optional, backward-compatible).
  resolvedAt?: string | null;
  closedAt?: string | null;
  complaintAt?: string | null;
  unresolvedAt?: string | null;
  customerConfirmedResolutionAt?: string | null;
  supervisorConfirmedResolutionAt?: string | null;
  resolvedBy?: MaintenanceResolutionConfirmedBy | null;
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
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
  managerId?: string | null;
  manager?: { id: string; fullName: string } | null;
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
  // Discount mode (mirrors downPayment). Optional for back-compat.
  discountType?: DownPaymentType;
  discountValue?: string | number;
  netPrice: string | number;
  reservationAmount: string | number;
  // Booking-amount mode (mirrors downPayment). Optional for back-compat with
  // responses predating the fixed/percentage split.
  reservationAmountType?: DownPaymentType;
  reservationAmountValue?: string | number;
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

// ── Brokers ───────────────────────────────────────────────────────────────────

export interface Broker {
  id: string;
  companyName: string;
  commercialName: string | null;
  code: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  taxId: string | null;
  commercialRegistration: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankIban: string | null;
  defaultCommissionPct: string | number;
  commissionModel: BrokerCommissionModel;
  status: BrokerStatus;
  contractStartAt: string | null;
  contractEndAt: string | null;
  contractPdfUrl: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { brokerUsers: number; projectAccess: number; unitAccess: number };
}

export interface BrokerUser {
  id: string;
  userId: string;
  brokerId: string;
  jobTitle: string | null;
  isPrimaryContact: boolean;
  canManageBrokerUsers: boolean;
  canViewCommissions: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
  status: BrokerUserStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    role: UserRole;
    fullName: string;
    email: string | null;
    phone: string | null;
    locale: 'ar' | 'en';
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface BrokerProjectAccess {
  id: string;
  brokerId: string;
  projectId: string;
  commissionPct: string | number | null;
  fixedAmountPerUnit: string | number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
  project: {
    id: string;
    name: Translatable;
    city: string;
    status: ProjectStatus;
    featured: boolean;
  };
}

export interface BrokerUnitAccess {
  id: string;
  brokerId: string;
  unitId: string;
  active: boolean;
  createdAt: string;
  unit: {
    id: string;
    code: string;
    type: string;
    price: string | number;
    status: UnitStatus;
    buildingId: string;
    building: {
      id: string;
      name: string;
      phaseId: string;
      phase: { id: string; projectId: string; name: Translatable };
    };
  };
}

export interface BrokerAccessBundle {
  projects: BrokerProjectAccess[];
  units: BrokerUnitAccess[];
}

// ── Broker portal payloads (/portal/*) ──────────────────────────────────────

export interface PortalMe {
  user: {
    id: string;
    role: UserRole;
    fullName: string;
    email: string | null;
    phone: string | null;
    locale: 'ar' | 'en';
    active: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  brokerUser: {
    id: string;
    jobTitle: string | null;
    isPrimaryContact: boolean;
    canManageBrokerUsers: boolean;
    canViewCommissions: boolean;
    status: BrokerUserStatus;
    invitedAt: string | null;
    joinedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  broker: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    logoUrl: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
    defaultCommissionPct: string | number;
    commissionModel: BrokerCommissionModel;
    contractStartAt: string | null;
    contractEndAt: string | null;
    contractPdfUrl: string | null;
    status: BrokerStatus;
    createdAt: string;
    updatedAt: string;
  };
  permissions: {
    isPrimaryContact: boolean;
    canManageBrokerUsers: boolean;
    canViewCommissions: boolean;
  };
}

export interface PortalProject {
  project: {
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
    media: Media[];
  };
  access: {
    id: string;
    commissionPct: string | number | null;
    fixedAmountPerUnit: string | number | null;
    startsAt: string | null;
    endsAt: string | null;
    active: boolean;
    createdAt: string;
  };
}

export interface PortalLead {
  id: string;
  clientId: string;
  fullName: string;
  phone: string;
  email: string | null;
  sourceId: string | null;
  source?: LeadSource | null;
  projectInterestId: string | null;
  projectInterest?: { id: string; name: Translatable; city: string } | null;
  unitInterestId: string | null;
  unitInterest?: { id: string; code: string; type: string } | null;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  stage: LeadStage;
  brokerId: string | null;
  brokerAgentId: string | null;
  brokerSubmittedAt: string | null;
  brokerApprovalStatus: BrokerLeadStatus | null;
  brokerApprovedAt: string | null;
  brokerRejectedAt: string | null;
  brokerRejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    role: UserRole;
  } | null;
  notes?: LeadNote[];
  appointments?: VisitAppointmentSummary[];
  // Returned on create when the phone collided with a prior lead.
  isDuplicate?: boolean;
  duplicateOfId?: string | null;
}

export interface PortalVisitRequest {
  id: string;
  leadId: string | null;
  projectId: string;
  unitId: string | null;
  preferredDate: string;
  scheduledAt: string | null;
  status: VisitStatus;
  requestStatus: VisitRequestStatus | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  brokerId: string | null;
  brokerAgentId: string | null;
  createdAt: string;
  project?: { id: string; name: Translatable; city: string } | null;
  unit?: { id: string; code: string; type: string } | null;
  lead?: { id: string; fullName: string; phone: string } | null;
  appointments?: VisitAppointmentSummary[];
}

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

export type BrokerCommissionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface PortalCommission {
  id: string;
  commissionNumber: string;
  brokerId: string;
  brokerAgentId: string | null;
  contractId: string;
  reservationId: string | null;
  unitId: string;
  projectId: string;
  basisAmount: string | number;
  commissionPct: string | number | null;
  grossAmount: string | number;
  taxPct: string | number;
  taxAmount: string | number;
  withholdingPct: string | number;
  withholdingAmount: string | number;
  netAmount: string | number;
  status: BrokerCommissionStatus;
  earnedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  brokerAgent?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  contract?: {
    id: string;
    contractNumber: string | null;
    totalAmount: string | number;
    downPayment: string | number;
    signedAt: string | null;
    customer?: { id: string; fullName: string; phone: string | null } | null;
  };
  reservation?: {
    id: string;
    reservationNumber: string | null;
    sales?: { id: string; fullName: string } | null;
    lead?: { id: string; fullName: string; phone: string } | null;
  } | null;
  unit?: {
    id: string;
    code: string;
    type: string;
    price: string | number;
    building?: {
      id: string;
      name: string;
      phase?: { id: string; name?: Translatable; projectId: string };
    };
  };
  project?: {
    id: string;
    name: Translatable;
    city: string;
    status: ProjectStatus;
  };
}

export interface AdminBrokerCommission extends PortalCommission {
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  approvedBy?: { id: string; fullName: string } | null;
  rejectedBy?: { id: string; fullName: string } | null;
}

export type BrokerPayoutStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PAID'
  | 'CANCELLED';

export type BrokerPayoutMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'OTHER';

export interface PortalPayout {
  id: string;
  payoutNumber: string;
  brokerId: string;
  period: string | null;
  totalGross: string | number;
  totalTax: string | number;
  totalWithholding: string | number;
  totalNet: string | number;
  status: BrokerPayoutStatus;
  paymentMethod: BrokerPayoutMethod | null;
  paymentReference: string | null;
  receiptUrl: string | null;
  invoiceUrl: string | null;
  scheduledAt: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  commissions?: Array<{
    id: string;
    commissionNumber: string;
    grossAmount: string | number;
    taxAmount: string | number;
    withholdingAmount: string | number;
    netAmount: string | number;
    earnedAt: string;
    contract: { id: string; contractNumber: string | null };
    unit: {
      id: string;
      code: string;
      building?: {
        phase?: { project?: { id: string; name: Translatable } };
      };
    };
    project?: { id: string; name: Translatable };
  }>;
}

export interface AdminBrokerPayout extends PortalPayout {
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  approvedBy?: { id: string; fullName: string } | null;
  processedBy?: { id: string; fullName: string } | null;
  cancelledBy?: { id: string; fullName: string } | null;
  commissions?: Array<{
    id: string;
    commissionNumber: string;
    status: BrokerCommissionStatus;
    basisAmount: string | number;
    commissionPct: string | number | null;
    grossAmount: string | number;
    taxAmount: string | number;
    withholdingAmount: string | number;
    netAmount: string | number;
    earnedAt: string;
    brokerAgent?: { id: string; fullName: string } | null;
    contract: {
      id: string;
      contractNumber: string | null;
      totalAmount: string | number;
      customer: { id: string; fullName: string } | null;
    };
    unit: {
      id: string;
      code: string;
      type: string;
      building?: {
        phase?: { project?: { id: string; name: Translatable } };
      };
    };
    project?: { id: string; name: Translatable };
  }>;
}

// ── Broker reports / performance ────────────────────────────────────────────

export interface BrokerReportsSummary {
  totalBrokers: number;
  activeBrokers: number;
  totalBrokerAgents: number;
  leadsSubmitted: number;
  leadsApproved: number;
  leadsRejected: number;
  leadsDuplicate: number;
  visitsRequested: number;
  reservationsCreated: number;
  reservationsApproved: number;
  reservationsCancelled: number;
  contractsCreated: number;
  contractsSigned: number;
  salesGross: string;
  commissionsPending: number;
  commissionsApproved: number;
  commissionsRejected: number;
  commissionsCancelled: number;
  commissionsGross: string;
  commissionsNet: string;
  commissionsPendingNet: string;
  payoutsDraft: number;
  payoutsApproved: number;
  payoutsProcessing: number;
  payoutsPaid: number;
  payoutsTotalNet: string;
  leadToReservationRate: number;
  reservationToContractRate: number;
  signedContractRate: number;
  contractToPaidPayoutRate: number;
}

export interface TopBrokerRow {
  brokerId: string;
  companyName: string;
  code: string;
  status: BrokerStatus;
  leads: number;
  approvedLeads: number;
  reservations: number;
  contracts: number;
  contractsSigned: number;
  salesGross: string;
  commissionGross: string;
  commissionNet: string;
  payoutNet: string;
  conversionRate: number;
}

export interface TopBrokersResponse {
  metric: 'leads' | 'reservations' | 'contracts' | 'salesGross' | 'commissionNet' | 'payoutNet';
  limit: number;
  data: TopBrokerRow[];
}

export interface BrokerReportProjectRow {
  projectId: string;
  projectName: Translatable | null;
  city: string | null;
  brokerCount: number;
  contracts: number;
  contractsSigned: number;
  salesGross: string;
  commissionGross: string;
  commissionNet: string;
  payoutNet: string;
}

export interface BrokerReportAgentRow {
  brokerAgentId: string;
  brokerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  leadsSubmitted: number;
  approvedLeads: number;
  reservations: number;
  contracts: number;
  contractsSigned: number;
  salesGross: string;
  commissionGross: string;
  commissionNet: string;
  payoutNet: string;
}

export interface BrokerMonthlyTrendPoint {
  label: string;
  reservations: number;
  contractsSigned: number;
  commissionsNet: string;
  payoutsNet: string;
}

export interface BrokerDetailReport {
  broker: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
    defaultCommissionPct: string | number;
    commissionModel: BrokerCommissionModel;
    contractStartAt: string | null;
    contractEndAt: string | null;
    _count: { brokerUsers: number; projectAccess: number; unitAccess: number };
  };
  summary: BrokerReportsSummary;
  monthlyTrend: BrokerMonthlyTrendPoint[];
  projectBreakdown: BrokerReportProjectRow[];
  agentBreakdown: BrokerReportAgentRow[];
  recent: {
    leads: Array<{
      id: string;
      fullName: string;
      phone: string;
      stage: LeadStage;
      brokerApprovalStatus: BrokerLeadStatus | null;
      createdAt: string;
      projectInterest: { id: string; name: Translatable } | null;
    }>;
    reservations: Array<{
      id: string;
      reservationNumber: string | null;
      status: ReservationStatus;
      createdAt: string;
      unit: { id: string; code: string };
    }>;
    contracts: Array<{
      id: string;
      contractNumber: string | null;
      signedAt: string | null;
      totalAmount: string | number;
      createdAt: string;
      unit: { id: string; code: string };
    }>;
    commissions: Array<{
      id: string;
      commissionNumber: string;
      status: BrokerCommissionStatus;
      grossAmount: string | number;
      netAmount: string | number;
      earnedAt: string;
    }>;
    payouts: Array<{
      id: string;
      payoutNumber: string;
      status: BrokerPayoutStatus;
      period: string | null;
      totalNet: string | number;
      createdAt: string;
      paidAt: string | null;
    }>;
  };
}

export interface PortalPerformanceResponse extends BrokerDetailReport {
  canSeeAllAgents: boolean;
}

export interface AdminEligibleCommission {
  id: string;
  commissionNumber: string;
  basisAmount: string | number;
  commissionPct: string | number | null;
  grossAmount: string | number;
  taxAmount: string | number;
  withholdingAmount: string | number;
  netAmount: string | number;
  earnedAt: string;
  brokerAgent?: { id: string; fullName: string } | null;
  contract: {
    id: string;
    contractNumber: string | null;
    totalAmount: string | number;
    customer: { id: string; fullName: string } | null;
  };
  unit: { id: string; code: string; type: string };
  project?: { id: string; name: Translatable; city: string };
}

export interface PortalActivityItem {
  id: string;
  type: PortalActivityType;
  rawType: string;
  entityType: 'Lead' | 'VisitRequest' | 'Reservation' | 'Contract' | 'Commission' | 'Payout';
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  // Null for Payout activity entries — those come from BrokerActivityLog
  // which is broker-scoped, not lead-scoped.
  lead: {
    id: string;
    fullName: string;
    phone: string;
    brokerApprovalStatus: BrokerLeadStatus | null;
    stage: LeadStage;
    projectInterest: { id: string; name: Translatable; city: string } | null;
    unitInterest: { id: string; code: string; type: string } | null;
  } | null;
}

export interface PortalReservation {
  id: string;
  reservationNumber: string | null;
  unitId: string;
  salesId: string;
  leadId: string | null;
  clientId: string | null;
  brokerId: string | null;
  brokerAgentId: string | null;
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
  bookingAmount: string | number;
  bookingPaymentStatus: ReservationBookingPaymentStatus;
  commissionLockedPct: string | number | null;
  commissionLockedAmount: string | number | null;
  selectedDurationMonths: number | null;
  selectedIncreasePercentage: string | number | null;
  snapshotDownPaymentAmount: string | number | null;
  snapshotRemainingAmount: string | number | null;
  snapshotFinancedAmount: string | number | null;
  snapshotMonthlyInstallment: string | number | null;
  snapshotTotalPayable: string | number | null;
  snapshotFinalPaymentAmount: string | number | null;
  installmentPlanTemplateId: string | null;
  selectedDurationOptionId: string | null;
  unit?: {
    id: string;
    code: string;
    type: string;
    price: string | number;
    status: UnitStatus;
    area?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    building?: {
      id: string;
      name: string;
      phase: {
        id: string;
        projectId: string;
        project: {
          id: string;
          name: Translatable;
          city: string;
          status: ProjectStatus;
        };
      };
    };
  };
  lead?: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    brokerApprovalStatus: BrokerLeadStatus | null;
    stage: LeadStage;
  } | null;
  client?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  sales?: { id: string; fullName: string; email: string | null; phone: string | null };
  installmentPlanTemplate?: {
    id: string;
    name: string;
    netPrice: string | number;
    reservationAmount: string | number;
    downPaymentAmount?: string | number;
  } | null;
  selectedDurationOption?: {
    id: string;
    durationMonths: number;
    increasePercentage: string | number;
  } | null;
  reservationNotes?: ReservationNote[];
  activities?: ReservationActivity[];
}

export interface AdminBrokerReservation extends PortalReservation {
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  brokerAgent?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface AdminBrokerLead extends PortalLead {
  broker?: {
    id: string;
    companyName: string;
    commercialName: string | null;
    code: string;
    status: BrokerStatus;
  } | null;
  brokerAgent?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  activities?: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface PortalUnit {
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
  media: Media[];
  accessSource: 'PROJECT_ACCESS' | 'UNIT_ACCESS';
  building: {
    id: string;
    name: string;
    phase: {
      id: string;
      name: Translatable;
      projectId: string;
      project: {
        id: string;
        name: Translatable;
        city: string;
        status: ProjectStatus;
      };
    };
  };
}

// ── Financial Reports ─────────────────────────────────────────────────────────

export interface FinancialSummary {
  totalContractValue: string;
  totalCollected: string;
  totalRemaining: string;
  totalOverdue: string;
  collectedThisMonth: string;
  dueThisMonth: string;
  contractCount: number;
  depositCount: number;
  overdueInstallmentCount: number;
  // F1 additions (optional for back-compat with older API responses).
  totalCollectedAll?: string;
  totalCollectedVerified?: string;
  totalCollectedUnverified?: string;
  totalOutstanding?: string;
  dueSoonAmount?: string;
  overdueAmountComputed?: string;
  overdueInstallmentCountComputed?: number;
}

export interface FinancialCollectionByType {
  type: DepositType;
  count: number;
  totalAll: string;
  totalVerified: string;
  totalUnverified: string;
}

export interface FinancialAgingBucket {
  label: string;
  count: number;
  amount: string;
}

export interface FinancialBooking {
  pendingReservationsCount: number;
  approvedReservationsCount: number;
  pendingReservationsBookingAmount: string;
  approvedReservationsBookingAmount: string;
  bookingCollectedVerified: string;
  bookingCollectedAll: string;
  bookingUncollectedEstimate: string;
}

export interface FinancialLiabilities {
  salesBonus: {
    pendingAmount: string;
    approvedAmount: string;
    paidAmount: string;
    unpaidAmount: string;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    unpaidCount: number;
  };
  brokerCommissions: {
    pendingAmount: string;
    approvedAmount: string;
    paidAmount: string;
    unpaidAmount: string;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    unpaidCount: number;
  };
  brokerPayouts: {
    draftAmount: string;
    approvedAmount: string;
    processingAmount: string;
    paidAmount: string;
    draftCount: number;
    approvedCount: number;
    processingCount: number;
    paidCount: number;
  };
  totalUnpaidLiabilities: string;
}

export interface FinancialHealthEntry {
  count: number;
  amount: string;
}

export interface FinancialDocumentsHealth {
  depositsMissingReceipt: FinancialHealthEntry;
  verifiedDepositsMissingReceiptDocument: FinancialHealthEntry;
  depositsWithLegacyReceiptUrlMissingDocument: FinancialHealthEntry;
  signedContractsMissingDocument: FinancialHealthEntry;
  contractsWithLegacyPdfUrlMissingDocument: FinancialHealthEntry;
}

export interface FinancialInstallmentRow {
  id: string;
  type: PlanPaymentType;
  dueDate: string;
  amount: string | number;
  status: InstallmentStatus;
  plan: {
    contract: {
      id: string;
      contractNumber: string | null;
      customer: { id: string; fullName: string };
      unit: { id: string; code: string };
    };
  };
}

export interface FinancialDepositRow {
  id: string;
  type: DepositType;
  amount: string | number;
  paidAt: string;
  verified: boolean;
  contract: {
    id: string;
    contractNumber: string | null;
    customer: { id: string; fullName: string } | null;
    unit: { id: string; code: string } | null;
  } | null;
  reservation: {
    id: string;
    reservationNumber: string | null;
    unit: { id: string; code: string } | null;
    client: { id: string; fullName: string } | null;
    lead: { id: string; fullName: string } | null;
  } | null;
}

export interface CashflowTrendPoint {
  month: string;
  label: string;
  collected: number;
  due: number;
}

export interface FinancialDashboard {
  summary: FinancialSummary;
  // F1 additions (optional for back-compat with older API responses).
  collectionByType?: FinancialCollectionByType[];
  aging?: FinancialAgingBucket[];
  booking?: FinancialBooking;
  liabilities?: FinancialLiabilities;
  documentsHealth?: FinancialDocumentsHealth;
  overdue: FinancialInstallmentRow[];
  upcomingThisWeek: FinancialInstallmentRow[];
  upcomingThisMonth: FinancialInstallmentRow[];
  recentDeposits: FinancialDepositRow[];
  cashflowTrend: CashflowTrendPoint[];
  cashflowForecast?: { next30: number; next3160: number; next6190: number };
}

export type DocumentOwnerType =
  | 'PROJECT'
  | 'UNIT'
  | 'LEAD'
  | 'RESERVATION'
  | 'CONTRACT'
  | 'DEPOSIT'
  | 'BROKER'
  | 'BROKER_COMMISSION'
  | 'BROKER_PAYOUT'
  | 'USER'
  | 'MAINTENANCE_REQUEST'
  | 'OTHER';

export type DocumentCategory =
  | 'IMAGE'
  | 'CONTRACT'
  | 'RECEIPT'
  | 'INVOICE'
  | 'BROKER_AGREEMENT'
  | 'COMMISSION_STATEMENT'
  | 'PAYOUT_RECEIPT'
  | 'ID_DOCUMENT'
  | 'LEGAL'
  | 'FINANCIAL'
  | 'OTHER';

export type DocumentVisibility = 'ADMIN_ONLY' | 'BROKER_VISIBLE' | 'CUSTOMER_VISIBLE';

export interface DocumentItem {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: DocumentVisibility;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    fullName: string;
    email: string | null;
    role: UserRole;
  } | null;
}

export interface SettingItem {
  key: string;
  value: unknown;
  updatedAt: string;
  group: string;
  sensitive: boolean;
}

export interface PermissionItem {
  id: string;
  code: string;
  description: string | null;
  userCount: number;
}

export interface UserPermissionsResponse {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    active: boolean;
  };
  assigned: Array<{ id: string; code: string; description: string | null }>;
  available: Array<{ id: string; code: string; description: string | null }>;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
  } | null;
}

export interface OperationsSummary {
  totals: { today: number; last7Days: number; last30Days: number };
  topActors: Array<{
    actor: { id: string; fullName: string; email: string | null; role: UserRole } | null;
    count: number;
  }>;
  topEntities: Array<{ entityType: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  entityCounts: Record<string, number>;
}

export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS';

export interface NotificationItem {
  id: string;
  templateCode: string;
  channel: NotificationChannel;
  payload: Record<string, unknown> | null;
  /** GET /v1/me/notifications resolves a `read` boolean (from the row's
   *  readAt). Unread = `read === false`. */
  read: boolean;
  /** Locale-resolved title/body from the notification template (when seeded). */
  title?: string;
  body?: string;
  createdAt: string;
}
