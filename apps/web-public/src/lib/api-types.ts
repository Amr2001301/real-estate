/**
 * Shapes returned by the hardened W1 public endpoints. Hand-mirrored from the
 * API serializers (apps/api/.../public-*.serializer.ts) — the public surface is
 * intentionally lean, so these stay small.
 */

export interface Translatable {
  ar?: string;
  en?: string;
}

export interface PublicMedia {
  url: string;
  type: string;
  order: number;
}

export interface PublicProjectListItem {
  id: string;
  name: Translatable;
  description: Translatable;
  city: string;
  lat: number;
  lng: number;
  services: Translatable[];
  featured: boolean;
  status: string;
  coverImage: string | null;
  availableUnitsCount: number;
  updatedAt: string;
}

export interface PublicProjectDetail {
  id: string;
  name: Translatable;
  description: Translatable;
  city: string;
  lat: number;
  lng: number;
  services: Translatable[];
  featured: boolean;
  status: string;
  media: PublicMedia[];
  availableUnitsCount: number;
  updatedAt: string;
}

export interface PublicProjectSummary {
  id: string;
  name: Translatable;
  city: string;
}

export interface PublicUnit {
  id: string;
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  price: string;
  status: string;
  coverImage: string | null;
  media: PublicMedia[];
  project: PublicProjectSummary | null;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/**
 * A saved favorite — shape of GET /v1/me/favorites items. The API includes the
 * raw project/unit row (with its first media), so `name` is Translatable and
 * `price` is a Decimal-as-string. Exactly one of project/unit is non-null.
 */
export interface FavoriteProjectRef {
  id: string;
  name: Translatable;
  city: string | null;
  media: { url: string }[];
}

export interface FavoriteUnitRef {
  id: string;
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  price: string;
  status: string;
  media: { url: string }[];
}

export interface FavoriteItem {
  id: string;
  projectId: string | null;
  unitId: string | null;
  createdAt: string;
  project: FavoriteProjectRef | null;
  unit: FavoriteUnitRef | null;
}

/**
 * A user's own visit request — item shape of GET /v1/me/visit-requests
 * (paginated). Includes the raw project/unit rows and the assigned sales
 * summary; only the fields the portal renders are typed here.
 */
export interface VisitProjectRef {
  id: string;
  name: Translatable;
  city: string | null;
}

export interface VisitUnitRef {
  id: string;
  code: string;
  type: string;
}

export interface AssignedSalesRef {
  id: string;
  fullName: string;
}

/**
 * The latest visit appointment for a request (added by P2). Surfaces the
 * two-sided confirmation lifecycle to the customer: `status` is the appointment
 * state (SCHEDULED awaits the customer's confirm/reschedule action; CONFIRMED
 * is locked in; PENDING_RESCHEDULE means the customer asked to move it).
 */
export interface MeAppointmentSummary {
  id: string;
  status:
    | 'SCHEDULED'
    | 'CONFIRMED'
    | 'PENDING_RESCHEDULE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'RESCHEDULED';
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingPoint: string | null;
  customerFeedback: string | null;
  // Gap 7 — the customer's own post-visit rating (1–5) + optional comment.
  // `customerRatingSubmittedAt` doubles as the "already rated" flag. Sales
  // feedback is intentionally NOT exposed to the customer.
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
}

export interface MeVisitRequest {
  id: string;
  requestStatus: string;
  status: string;
  preferredDate: string | null;
  preferredTime: string | null;
  scheduledAt: string | null;
  notes: string | null;
  projectId: string | null;
  unitId: string | null;
  project: VisitProjectRef | null;
  unit: VisitUnitRef | null;
  assignedSales: AssignedSalesRef | null;
  appointments: MeAppointmentSummary[];
  createdAt: string;
}

/**
 * A user's own info request / inquiry — item shape of GET /v1/me/info-requests
 * (paginated). Reuses the project/unit ref shapes; only rendered fields typed.
 */
export interface MeInfoRequest {
  id: string;
  projectId: string | null;
  unitId: string | null;
  message: string;
  createdAt: string;
  project: VisitProjectRef | null;
  unit: VisitUnitRef | null;
}

/**
 * A user's own reservation — item shape of GET /v1/me/reservations (paginated).
 * Available to CLIENT and CUSTOMER. The backend scopes by both ownership
 * paths (direct `clientId` and lead-based `lead.clientId`). Amounts are
 * Decimal-as-string. Broker attribution, internal notes, and financial
 * snapshots beyond `bookingAmount` are intentionally not exposed.
 */
export type MeReservationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'CONVERTED';

export type MeReservationBookingPaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'WAIVED';

export interface ReservationUnitRef {
  id: string;
  code: string;
  type: string;
  building: { phase: { project: { id: string; name: Translatable } | null } | null } | null;
}

/** Gap 3 — latest BOOKING_AMOUNT proof for a reservation, so the customer UI
 *  can distinguish submit / pending-review / rejected states. */
export interface MeReservationBookingDeposit {
  id: string;
  reviewStatus: MeDepositReviewStatus;
  rejectionReason: string | null;
}

export interface MeReservation {
  id: string;
  reservationNumber: string | null;
  status: MeReservationStatus;
  expiresAt: string;
  createdAt: string;
  bookingAmount: string;
  bookingPaymentStatus: MeReservationBookingPaymentStatus;
  bookingPaidAt: string | null;
  /** Latest booking-amount proof (null when none submitted yet). */
  bookingDeposit?: MeReservationBookingDeposit | null;
  unit: ReservationUnitRef | null;
  sales: AssignedSalesRef | null;
}

/**
 * A customer's own contract — item shape of GET /v1/contracts/me/contracts
 * (paginated). Amounts are Decimal-as-string; project name is Translatable.
 * Broker/reservation fields exist on the API but are intentionally NOT typed
 * or rendered in the customer portal.
 */
export interface ContractProjectRef {
  id: string;
  name: Translatable;
}

export interface ContractUnitRef {
  id: string;
  code: string;
  type: string;
  building: { phase: { project: ContractProjectRef | null } | null } | null;
}

export interface ContractInstallmentPlan {
  id: string;
  totalMonths: number;
  monthlyAmount: string;
  startsAt: string | null;
  frequency: string;
}

export interface MeContract {
  id: string;
  contractNumber: string | null;
  totalAmount: string;
  downPayment: string;
  /** Always null on the customer surface — the file is reachable only via the
   *  signed-download endpoint (GET /me/documents/:id/download). */
  pdfUrl: string | null;
  /** P12 — true when a CUSTOMER_VISIBLE contract document exists, so the UI
   *  can show the download button vs. the "not available yet" state without a
   *  round-trip. Never carries the URL itself. */
  hasDocument?: boolean;
  signedAt: string | null;
  unit: ContractUnitRef | null;
  installmentPlan: ContractInstallmentPlan | null;
}

/**
 * A customer's own deposit — item shape of GET /v1/me/deposits. Amounts are
 * Decimal-as-string. Reservation is returned by the API but not rendered.
 */
export type MeDepositReviewStatus = 'NO_PROOF' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type MePaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

export interface MeDeposit {
  id: string;
  type: string;
  amount: string;
  paidAt: string | null;
  receiptUrl: string | null;
  verified: boolean;
  contract: { id: string; contractNumber: string | null } | null;
  installment: { id: string; dueDate: string | null; amount: string; type: string } | null;
  // P11
  reviewStatus?: MeDepositReviewStatus;
  rejectionReason?: string | null;
  paymentMethod?: MePaymentMethod | null;
  reviewedAt?: string | null;
  proofDocument?: {
    id: string;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
  } | null;
}

/**
 * Gap 5 — installment-schedule summary attached to GET /v1/me/installments.
 * All money fields are Decimal-as-string. These totals describe the INSTALLMENT
 * SCHEDULE only — the booking amount lives on the reservation and is NOT
 * included here (so it is never double-counted). `remaining` = pending +
 * overdue (everything not yet PAID).
 */
export interface MeInstallmentsSummary {
  totalPaid: string;
  remaining: string;
  overdue: string;
  counts: { total: number; paid: number; pending: number; overdue: number };
  nextDue: { amount: string; dueDate: string } | null;
  contracts: { id: string; contractNumber: string | null }[];
}

/** GET /v1/me/installments — paginated list + additive summary. */
export interface MeInstallmentsResponse {
  data: MeInstallment[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary?: MeInstallmentsSummary;
}

// P11 — customer-facing installment row (GET /v1/me/installments).
// No file URLs; the customer reaches proof via signed-download.
export interface MeInstallment {
  id: string;
  dueDate: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  paidAt: string | null;
  type: string;
  plan: {
    contract: {
      id: string;
      contractNumber: string | null;
      unit: {
        id: string;
        code: string;
        type: string;
        building: { phase: { project: { id: string; name: Translatable } | null } | null } | null;
      } | null;
    } | null;
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

/** GET /v1/me/deposits — paginated-like with an extra `totals` block. */
export interface MeDepositsResponse {
  data: MeDeposit[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  totals: DepositTotals;
}

/**
 * A customer's own maintenance request. List item shape of
 * GET /v1/me/maintenance-requests; the detail endpoint adds `documents`.
 * `priority` is nullable (snapshot may be absent); category `name` is Translatable.
 */
export interface MaintenanceCategoryRef {
  id: string;
  name: Translatable;
}

export interface MaintenanceUnitRef {
  id: string;
  code: string;
  type: string;
}

/** Phase A — who confirmed a maintenance request's resolution. */
export type MaintenanceResolvedBy = 'CUSTOMER' | 'SUPERVISOR' | 'BOTH';

export interface MeMaintenanceRequest {
  id: string;
  status: string;
  priority: string | null;
  reviewStatus: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  unit: MaintenanceUnitRef | null;
  category: MaintenanceCategoryRef | null;
  // Phase A — resolution loop (additive/optional; backward-compatible). The
  // customer detail/list endpoints return these (Prisma `include` → all scalars).
  dueAt?: string | null;
  complaintAt?: string | null;
  unresolvedAt?: string | null;
  customerConfirmedResolutionAt?: string | null;
  supervisorConfirmedResolutionAt?: string | null;
  resolvedBy?: MaintenanceResolvedBy | null;
  customerRating?: number | null;
  customerRatingText?: string | null;
  customerRatingSubmittedAt?: string | null;
}

export interface MaintenanceDocument {
  id: string;
  title: string;
  // Phase 7D removed the permanent `fileUrl` from customer-facing responses.
  // The customer reaches the file ONLY through the signed-download endpoint
  // (see `DocumentDownloadById`), keyed by `id`.
  fileName: string | null;
  mimeType: string | null;
  createdAt: string;
}

export interface MeMaintenanceRequestDetail extends MeMaintenanceRequest {
  documents: MaintenanceDocument[];
}

/**
 * A user's own notification — item shape of GET /v1/me/notifications (plain
 * array, limit 100). Records carry only templateCode + payload (no title/body),
 * so the UI maps templateCode → Arabic label with a generic fallback.
 */
export interface MeNotification {
  id: string;
  templateCode: string;
  payload: Record<string, unknown> | null;
  channel: string;
  /** GET /v1/me/notifications returns a resolved `read` boolean (derived from
   *  the row's readAt). Unread = `read === false`. */
  read: boolean;
  createdAt: string;
}

/** Authenticated user's own profile — shape of GET /v1/users/me. */
export interface MeProfile {
  id: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  locale: string;
  active: boolean;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  managerId: string | null;
}
