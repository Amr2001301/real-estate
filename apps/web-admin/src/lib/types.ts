export interface Translatable {
  ar: string;
  en: string;
}

/**
 * Server-computed aggregates over the whole filtered set, not the returned
 * page. Mirrors PaginationFacets in the API and in packages/shared-types —
 * keep the three in step. Present only on endpoints that compute them, so
 * always optional. See docs/audit/08-functional-gaps.md FG-23.
 */
export interface PaginationFacets {
  /** dimension → value → count. A missing key means zero: the server omits
   *  values that no row holds. Read with `?? 0`, never assume every member. */
  counts?: Record<string, Record<string, number>>;
  /** field → sum as a decimal string. Money is Decimal(14,2) server-side and
   *  stays a string so JSON floats cannot lose precision. */
  sums?: Record<string, string>;
  /** field → maximum as an ISO string, for "most recent X" tiles.
   *  Absent when the set is empty or every row holds null. */
  max?: Record<string, string>;
}

export interface Paged<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    facets?: PaginationFacets;
  };
}

export type ProjectStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PlanTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type DownPaymentType = 'FIXED' | 'PERCENTAGE';
export type InstallmentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';
export type StartDateRule = 'MANUAL' | 'AFTER_RESERVATION' | 'AFTER_CONTRACT';
export type PlanPaymentType =
  | 'RESERVATION'
  | 'DOWN_PAYMENT'
  | 'INSTALLMENT'
  | 'FINAL_PAYMENT'
  | 'BOUNCE_PENALTY'
  | 'LATE_FEE'
  | 'TRANSFER_FEE';
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

export type ProjectType = 'RESIDENTIAL' | 'COASTAL' | 'ADMINISTRATIVE' | 'COMMERCIAL' | 'MEDICAL' | 'MIXED_USE';

export interface Project {
  id: string;
  code?: string | null;
  name: Translatable;
  description: Translatable;
  city: string;
  /** The project's data (F10). */
  type?: ProjectType | null;
  district?: string | null;
  totalArea?: number | null;
  licenseNumber?: string | null;
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
  code?: string | null;
  name: Translatable;
  order: number;
  /** When its units are handed over (F10). */
  deliveryDate?: string | null;
  buildings?: Building[];
}

export interface Building {
  id: string;
  phaseId: string;
  code?: string | null;
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

export type UnitUsage = 'RESIDENTIAL' | 'COMMERCIAL' | 'ADMINISTRATIVE' | 'MEDICAL' | 'PARKING';
export type UnitFinishing = 'CORE_AND_SHELL' | 'SEMI_FINISHED' | 'FULLY_FINISHED' | 'FURNISHED';
export type UnitView =
  | 'GARDEN' | 'POOL' | 'LAGOON' | 'SEA' | 'NILE' | 'CLUB' | 'LANDSCAPE' | 'MAIN_STREET' | 'SIDE_STREET';
export type UnitOrientation =
  | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'NORTH_EAST' | 'NORTH_WEST' | 'SOUTH_EAST' | 'SOUTH_WEST';

/** One of the company's unit types (F10); Unit.type holds its code. */
export interface UnitTypeOption {
  id: string;
  code: string;
  name: Translatable;
  usage: UnitUsage;
  active: boolean;
  order: number;
}

/** One of a project's unit models (F10): the layout a unit is entered from. */
export interface UnitModelOption {
  id: string;
  projectId: string;
  code: string;
  name: Translatable;
  type: string;
  area: number;
  netArea: number | null;
  gardenArea: number | null;
  roofArea: number | null;
  terraceArea: number | null;
  landArea: number | null;
  bedrooms: number;
  bathrooms: number;
  finishing: UnitFinishing | null;
  active: boolean;
  _count?: { units: number };
}

export interface Unit {
  id: string;
  buildingId: string;
  code: string;
  type: string;
  /** The type's name from the company's list (null for a type it no longer has). */
  typeName?: Translatable | null;
  usage?: UnitUsage;
  /** Gross area (BUA). */
  area: number;
  netArea?: number | null;
  gardenArea?: number | null;
  roofArea?: number | null;
  terraceArea?: number | null;
  landArea?: number | null;
  finishing?: UnitFinishing | null;
  view?: UnitView | null;
  orientation?: UnitOrientation | null;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  price: string | number;
  /** Set when the unit is priced by the meter (price = this × area). */
  pricePerMeter?: string | number | null;
  /** The project's model it was entered from (F10). */
  modelId?: string | null;
  /** Its own handover date; effectiveDeliveryDate is this or its phase's. */
  deliveryDate?: string | null;
  effectiveDeliveryDate?: string | null;
  model?: { id: string; code: string; name: Translatable } | null;
  status: UnitStatus;
  reservationExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  media?: Media[];
  building?: Building & { phase?: Phase & { project?: Project } };
  history?: UnitStatusHistoryEntry[];
}

export interface InventoryMatrixBuilding {
  id: string; name: string;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
}
export interface InventoryMatrixPhase {
  id: string; name: string;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
  buildings: InventoryMatrixBuilding[];
}
export interface InventoryMatrixProject {
  id: string; name: string; city: string | null;
  available: number; reserved: number; sold: number; total: number; totalValue: number;
  phases: InventoryMatrixPhase[];
}
export interface InventoryMatrixResult {
  projects: InventoryMatrixProject[];
  summary: { available: number; reserved: number; sold: number; total: number; totalValue: number };
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
  unitInterest?: { id: string; code: string; type: string } | null;
  assignedSalesId: string | null;
  assignedSales?: { id: string; fullName: string } | null;
  stage: LeadStage;
  /** When the stage last changed (kept by a DB trigger). */
  stageChangedAt?: string;
  /** The latest note on the lead — the kanban card's "last contact"; null without one. */
  lastContactAt?: string | null;
  /** The next follow-up: when, what, and a word on it; null when none is set. */
  nextActionAt?: string | null;
  nextActionType?: LeadFollowUpType | null;
  nextActionNote?: string | null;
  /** Why it was lost (LOST only). */
  lostReason?: { id: string; name: Translatable } | null;
  lostNote?: string | null;
  lostAt?: string | null;
  /** The marketing campaign that brought the lead. */
  campaign?: { id: string; name: string; channel: CampaignChannel } | null;
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
  // ── Ad / UTM attribution (first-touch, all nullable) ──
  utmSource?:   string | null;
  utmMedium?:   string | null;
  utmCampaign?: string | null;
  utmContent?:  string | null;
  fbclid?:      string | null;
}

export type CampaignChannel =
  | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'GOOGLE' | 'SNAPCHAT' | 'WHATSAPP'
  | 'SMS' | 'EMAIL' | 'BILLBOARD' | 'EVENT' | 'OTHER';
export type CampaignStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface CampaignStats {
  leads: number;
  qualified: number;
  won: number;
  lost: number;
  spend: number;
  cpl: number | null;
  cpa: number | null;
}

/** What a campaign (or a channel, a project, all of them) cost and brought in a period. */
export interface CampaignFigures {
  spend: number;
  leads: number;
  qualified: number;
  won: number;
  lost: number;
  /** Signed, live contracts credited to it (first touch). */
  sales: number;
  /** Their net price. */
  revenue: number;
  cpl: number | null;
  cpa: number | null;
  /** (revenue − spend) / spend, in %. */
  roi: number | null;
  /** Sales per lead, in %. */
  conversion: number | null;
}

export interface CampaignReport {
  period: { from: string | null; to: string | null };
  totals: CampaignFigures & { campaigns: number; otherLeads: number; leadShare: number | null };
  campaigns: Array<
    CampaignFigures & {
      id: string;
      name: string;
      code: string;
      channel: CampaignChannel;
      status: CampaignStatus;
      budget: number | null;
      project: { id: string; name: Translatable } | null;
    }
  >;
  byChannel: Array<CampaignFigures & { channel: CampaignChannel; campaigns: number }>;
  byProject: Array<CampaignFigures & { projectId: string | null; name: Translatable | null; campaigns: number }>;
  trend: Array<{ month: string; spend: number; leads: number; sales: number; revenue: number }>;
}

export interface Campaign {
  id: string;
  name: string;
  code: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  projectId: string | null;
  project?: { id: string; name: Translatable } | null;
  sourceId: string | null;
  source?: { id: string; name: Translatable } | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  notes: string | null;
  createdAt: string;
  stats: CampaignStats;
}

export interface CampaignSpendEntry {
  id: string;
  amount: number;
  spentOn: string;
  note: string | null;
  createdAt: string;
}

export interface CampaignDetail extends Campaign {
  spend: CampaignSpendEntry[];
  /** The company's website, for the tracking links. */
  siteUrl: string;
}

export interface IntakeKey {
  id: string;
  name: string;
  /** The first characters of the key, to tell keys apart. */
  tokenPrefix: string;
  active: boolean;
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string;
  campaign: { id: string; name: string; channel: CampaignChannel } | null;
  project: { id: string; name: Translatable } | null;
}

export interface LeadRoutingSettings {
  autoAssign: 'ROUND_ROBIN' | 'NONE';
  firstCallMinutes: number;
  companySlug: string | null;
}

export interface LostReason {
  id: string;
  name: Translatable;
  active: boolean;
  sortOrder: number;
}

/** GET /leads/lost-report. A null id is "none" (no reason, unassigned, no source…). */
export interface LostReport {
  totals: { lost: number; won: number; lossRate: number | null; withReason: number; unrecorded: number };
  byReason: Array<{ reasonId: string | null; name: Translatable | null; active: boolean; count: number; share: number }>;
  bySales: Array<{
    salesId: string | null;
    fullName: string | null;
    count: number;
    share: number;
    topReason: { reasonId: string | null; name: Translatable | null; count: number };
  }>;
  bySource: Array<{ sourceId: string | null; name: Translatable | null; count: number; share: number }>;
  byProject: Array<{ projectId: string | null; name: Translatable | null; count: number; share: number }>;
  trend: Array<{ month: string; count: number }>;
  recent: Array<{
    id: string;
    fullName: string;
    lostAt: string;
    lostNote: string | null;
    lostReason: { id: string; name: Translatable } | null;
    assignedSales: { id: string; fullName: string } | null;
    projectInterest: { id: string; name: Translatable } | null;
  }>;
}

export interface LeadSource {
  id: string;
  name: Translatable;
  active: boolean;
}

export type LeadNoteKind = 'NOTE' | 'CALL' | 'MEETING' | 'WHATSAPP' | 'FOLLOW_UP';
export type LeadCallResult = 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'UNREACHABLE' | 'WRONG_NUMBER';
export type LeadFollowUpType = 'CALL' | 'MEETING' | 'WHATSAPP' | 'FOLLOW_UP';
export type FollowUpBucket = 'overdue' | 'today' | 'upcoming';

export interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  sales?: { id: string; fullName: string };
  kind?: LeadNoteKind;
  callResult?: LeadCallResult | null;
  /** The follow-up this activity scheduled. */
  nextActionAt?: string | null;
  nextActionType?: LeadFollowUpType | null;
  parentId?: string | null;
  replies?: LeadNote[];
}

/** A row of the follow-up lists (GET /leads/follow-ups). */
export interface FollowUpLead {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  nextActionAt: string;
  nextActionType: LeadFollowUpType | null;
  nextActionNote: string | null;
  client?: { id: string; fullName: string; phone: string } | null;
  assignedSales?: { id: string; fullName: string } | null;
  projectInterest?: { id: string; name: Translatable } | null;
  lastActivity: { kind: LeadNoteKind; callResult: LeadCallResult | null; body: string; createdAt: string } | null;
}

export interface FollowUpSummary {
  overdue: number;
  today: number;
  upcoming: number;
}

export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type DepositType = 'BOOKING_AMOUNT' | 'DOWN_PAYMENT' | 'INSTALLMENT' | 'FINAL_PAYMENT' | 'FEE';

export interface ContractInstallment {
  id: string;
  type: PlanPaymentType;
  dueDate: string;
  amount: string | number;
  status: InstallmentStatus;
  paidAt: string | null;
  /** FG-01 — open, but paid by a cheque that has not cleared yet. */
  awaitingCheque?: boolean;
  /** LATE_FEE rows: set when the company waived the fee. */
  waivedAt?: string | null;
  /** Contract detail: a proof or a cheque is waiting on this row. */
  awaitingPayment?: boolean;
  /** Contract detail: the payment that explains the row (see rowPayment in the API). */
  payment?: RowPayment | null;
}

/** What a recorded payment amounts to — one answer on every admin screen. */
export type DepositState =
  | 'COLLECTED'
  | 'PENDING_REVIEW'
  | 'CHEQUE_PENDING'
  | 'REJECTED'
  | 'BOUNCED'
  | 'REVERSED'
  | 'DELETED';

export interface RowPayment {
  depositId: string;
  state: DepositState;
  method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER' | null;
  paidAt: string;
  reversedAt: string | null;
  reversalReason?: string | null;
  reversedBy?: string | null;
}

export interface ContractInstallmentPlan {
  id: string;
  totalMonths: number;
  monthlyAmount: string | number;
  startsAt: string;
  frequency: InstallmentFrequency;
  installments?: ContractInstallment[];
}

export interface ContractAmendment {
  id: string;
  type: 'TRANSFER' | 'UNIT_SWAP' | 'PRICE_CHANGE' | 'RESCHEDULE' | 'MARKUP_WAIVER';
  reason: string;
  createdAt: string;
  fromCustomerName: string | null;
  toCustomerName: string | null;
  fromUnitCode: string | null;
  toUnitCode: string | null;
  fromTotal: string | number | null;
  toTotal: string | number | null;
  feeAmount: string | number | null;
  performedByName: string | null;
}

export interface Contract {
  id: string;
  contractNumber: string | null;
  /** F10 — the handover date the contract promises; the one expected now; days late. */
  deliveryDate?: string | null;
  expectedDeliveryDate?: string | null;
  deliveryDelayDays?: number;
  status?: 'UNSIGNED' | 'ACTIVE' | 'CANCELLED';
  /** FG-10 — the latest run of the sign follow-ups (warranties, commissions) had a failure. */
  signFollowupFailed?: boolean;
  /** The instalment markup still in totalAmount (detail only). */
  markupLeft?: string;
  /** The contract has a late-fee clause (only those are charged late fees). */
  lateFeesApply?: boolean;
  /** Signed before the company used the system (entered afterwards). */
  preSystem?: boolean;
  customerId: string;
  customer?: { id: string; fullName: string; phone: string | null; email?: string | null } & CustomerRecord;
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
  /** The unit handover: warranties and the customer's maintenance start there. */
  handover?: {
    handedOverAt: string;
    checklist: Array<{ key: string; done: boolean }> | null;
    notes: string | null;
    performedById: string | null;
  } | null;
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
  brokerCommission?: {
    id: string;
    commissionNumber: string;
    commissionPct: string | number | null;
    grossAmount: string | number;
    netAmount: string | number;
    status: BrokerCommissionStatus;
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
  fees: string;
  count: number;
}

// FG-01 — a cheque or bank transfer a deposit was paid with (GET /payment-instruments).
export type PaymentInstrumentStatus =
  | 'PENDING_CLEARANCE'
  | 'DEPOSITED'
  | 'CLEARED'
  | 'BOUNCED'
  | 'REPLACED'
  | 'CANCELLED';

export interface PaymentInstrument {
  id: string;
  type: 'CHEQUE' | 'BANK_TRANSFER';
  status: PaymentInstrumentStatus;
  chequeNumber: string | null;
  drawerBankName: string | null;
  chequeDueDate: string | null;
  bankName: string | null;
  referenceNumber: string | null;
  clearingDate: string | null;
  bounceDate: string | null;
  bounceReason: string | null;
  createdAt: string;
  deposits: Array<{
    id: string;
    amount: string | number;
    reviewStatus: string;
    installment: { id: string; dueDate: string; status: string } | null;
    contract: {
      id: string;
      contractNumber: string | null;
      customer: { id: string; fullName: string } | null;
    } | null;
    /** A booking-amount cheque: the reservation it pays. */
    reservation?: {
      id: string;
      reservationNumber: string | null;
      client: { id: string; fullName: string } | null;
    } | null;
  }>;
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
    customer?: { id: string; fullName: string };
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
  /** Whether the money arrived — use this, not `verified` (see DepositState). */
  state?: DepositState;
  reversedAt?: string | null;
  reversalReason?: string | null;
  reversedBy?: string | null;
  paymentInstrument?: { status: string; type: 'BANK_TRANSFER' | 'CHEQUE'; chequeNumber: string | null } | null;
  proofDocument?: {
    id: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
  } | null;
  deletedAt?: string | null;
  /** Deposit detail only — it still pays its installment, so it can be reversed (FG-05). */
  reversible?: boolean;
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
  /** Set when a broker brought the deal (absent once detached). */
  brokerId?: string | null;
  id: string;
  reservationNumber: string | null;
  unitId: string;
  unit?: Unit;
  salesId: string;
  sales?: { id: string; fullName: string };
  leadId: string | null;
  lead?: { id: string; fullName: string; phone: string; email?: string | null } | null;
  clientId: string | null;
  client?: ({ id: string; fullName: string; phone: string | null; email?: string | null } & CustomerRecord) | null;
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
  snapshotFrequency?: InstallmentFrequency | null;
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
    /** Whether the money arrived (see DepositState). */
    state?: DepositState;
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

/** What the company records about a buyer for its contracts and forms (staff only). */
export interface CustomerRecord {
  nationalId?: string | null;
  address?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  occupation?: string | null;
  employer?: string | null;
  nationalIdIssueDate?: string | null;
  nationalIdIssuePlace?: string | null;
  homePhone?: string | null;
  /** The company's own fields, by key (see CustomerFieldDef). */
  customFields?: Record<string, string | number> | null;
}

export interface User extends CustomerRecord {
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
  /** Cash plan (F11): no instalments; the rest is due at signing. */
  isCash?: boolean;
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
  /** Admin hold on this broker's payouts. */
  payoutHold?: boolean;
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
  /** Price-change top-ups and clawbacks netted into this payout. */
  adjustments?: Array<{ id: string; kind: 'TOP_UP' | 'CLAWBACK'; amount: string | number; reason: string; createdAt: string }>;
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
  /** Top-ups / clawbacks of paid commissions whose price changed, netted here. */
  adjustments?: Array<{
    id: string;
    kind: 'TOP_UP' | 'CLAWBACK';
    amount: string | number;
    reason: string;
    createdAt: string;
    commission: { id: string; commissionNumber: string; contract: { id: string; contractNumber: string | null } };
  }>;
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
  /** Signed contracts whose broker commission is in a PAID payout (subset of contractsSigned). */
  contractsCommissionPaid?: number;
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
  snapshotFrequency?: InstallmentFrequency | null;
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
  /** Signed contracts at their net price (decided 2026-10-17). */
  totalContractValue: string;
  /** What has fallen due by today (booking + rows due), and what was collected against it. */
  dueToDate?: string;
  collectedAgainstDue?: string;
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
  /** Decided 2026-10-16: collected towards the price (the collection rate's
   *  numerator) and fees & penalties, shown apart. */
  collectedTowardsPrice?: string;
  feesCollected?: string;
  /** Refunds on cancelled contracts: paid in the period, still owed, collected net of refunds. */
  refundsPaid?: string;
  refundsOwed?: string;
  netCollected?: string;
  totalOutstanding?: string;
  dueSoonAmount?: string;
  overdueAmountComputed?: string;
  overdueInstallmentCountComputed?: number;
}

export interface FinancialCollectionByType {
  type: DepositType;
  count: number;
  totalAll: string;
  /** Counts as collected. */
  totalCollected: string;
  /** On its way: a proof to review or a cheque not cleared yet. */
  totalAwaiting: string;
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
  /** Clawbacks still owed back to the company (cancelled deals already paid out). */
  clawbacksOwed?: {
    brokerCommissionsAmount: string;
    brokerCommissionsCount: number;
    salesBonusAmount: string;
    salesBonusCount: number;
    totalAmount: string;
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
  state?: DepositState;
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

/** Signed contracts' value today: the parts add up to grossValue. */
export interface FinancialPortfolio {
  grossValue: string;
  netValue: string;
  markup: string;
  paid: string;
  awaiting: string;
  overdue: string;
  notYetDue: string;
  unscheduled: string;
  unsigned: {
    count: number;
    open: string;
    contracts?: Array<{
      id: string;
      contractNumber: string | null;
      createdAt: string;
      totalAmount: string;
      customer: { id: string; fullName: string } | null;
      unit: { id: string; code: string } | null;
      firstDue: { id: string; type: string; amount: string; dueDate: string } | null;
    }>;
  };
}

/** This month's rows (paid + awaiting + overdue + upcoming = due) and the money that came in. */
export interface FinancialMonth {
  due: string;
  paid: string;
  awaiting: string;
  overdue: string;
  upcoming: string;
  cashIn: string;
  /** Of `paid`: this month's rows paid before the month began. */
  paidEarly?: string;
  /** Of `cashIn`: money for rows of other months, bookings. */
  cashInOther?: string;
}

export interface FinancialDashboard {
  summary: FinancialSummary;
  portfolio?: FinancialPortfolio;
  month?: FinancialMonth;
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
  totals: { today: number; last7Days: number; last30Days: number; previous7Days?: number };
  /** Events per day, oldest first (company time zone). */
  daily?: Array<{ date: string; count: number }>;
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

/** GET /contracts/:id/cancellation-suggestion — the cancel form's pre-fill. */
export interface CancellationSuggestion {
  totalCollected: string;
  bookingCollected: string;
  suggestedRetained: string;
  suggestedRefund: string;
  policySnapshot: {
    unitRelease: 'AUTO' | 'REQUIRES_APPROVAL';
    demoteClient: boolean;
    commissionAction: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
    bonusAction: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
  };
}

/** GET /contracts/:id/cancellation — what was agreed and what was paid back. */
export interface ContractCancellationView {
  cancellationDate: string;
  reason: string;
  totalCollectedSnapshot: string;
  retainedAmount: string;
  refundAmount: string;
  financialNotes: string | null;
  unitReleasedAt: string | null;
  cancelledBy: { id: string; fullName: string } | null;
  refunds: Array<{
    id: string;
    amount: string;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
    referenceNumber: string | null;
    bankName: string | null;
    paidAt: string;
    notes: string | null;
    recordedBy: { id: string; fullName: string } | null;
  }>;
  refundedTotal: string;
  refundOutstanding: string;
  /** How the commission / bonus was settled; `open` = a MANUAL cancellation still waits for the decision. */
  decisions?: {
    commission: CancellationDecisionItem | null;
    bonus: CancellationDecisionItem | null;
  };
}

export interface CancellationDecisionItem {
  action: string;
  open: boolean;
  decision: 'CLAWBACK' | 'RETAIN' | null;
  decidedAt: string | null;
  amount: string;
  status: string;
  paid: boolean;
}

/** GET /contracts/refunds/outstanding — customers still owed part of a refund. */
export interface OutstandingRefunds {
  data: Array<{
    contractId: string;
    contractNumber: string | null;
    customer: { id: string; fullName: string } | null;
    unitCode: string | null;
    cancellationDate: string;
    refundAmount: string;
    refunded: string;
    outstanding: string;
  }>;
  totalOutstanding: string;
}


/** GET /contracts/:id/statement — statement of account (كشف حساب). */
export interface StatementLine {
  date: string;
  kind: 'CONTRACT' | 'FEE' | 'PAYMENT' | 'REVERSAL' | 'WAIVER';
  rowType: string | null;
  rowDueDate?: string | null;
  depositId: string | null;
  method: string | null;
  unrecorded?: boolean;
  debit: string;
  credit: string;
  balance: string;
  reason?: string | null;
  by?: string | null;
}

export interface ContractStatement {
  asOf: string;
  lines: StatementLine[];
  totals: {
    contractValue: string;
    fees: string;
    paid: string;
    balance: string;
    overdue: string;
    dueToday: string;
    upcoming: string;
    awaiting: string;
    openFees: string;
    unscheduled: string;
  };
  awaiting: Array<{ depositId: string; date: string; amount: string; state: DepositState; rowType: string | null }>;
}
