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

export interface MeReservation {
  id: string;
  reservationNumber: string | null;
  status: MeReservationStatus;
  expiresAt: string;
  createdAt: string;
  bookingAmount: string;
  bookingPaymentStatus: MeReservationBookingPaymentStatus;
  bookingPaidAt: string | null;
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
  pdfUrl: string | null;
  signedAt: string | null;
  unit: ContractUnitRef | null;
  installmentPlan: ContractInstallmentPlan | null;
}

/**
 * A customer's own deposit — item shape of GET /v1/me/deposits. Amounts are
 * Decimal-as-string. Reservation is returned by the API but not rendered.
 */
export interface MeDeposit {
  id: string;
  type: string;
  amount: string;
  paidAt: string | null;
  receiptUrl: string | null;
  verified: boolean;
  contract: { id: string; contractNumber: string | null } | null;
  installment: { id: string; dueDate: string | null; amount: string; type: string } | null;
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
  readAt: string | null;
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
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  managerId: string | null;
}
