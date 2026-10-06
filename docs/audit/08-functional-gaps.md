# Functional Gaps — Audit (Product A)

> Generated 2026-09-13. Read-only investigation. No source files modified.
> Scope: Product A (developer company + internal broker partners) only.
> Every claim cites the file and line where the evidence was read.

---

## 1. Money Path Trace

The full revenue path from first contact to a paid installment, step by step.

### 1.1 Lead creation

`leads.service.ts:56` — `prisma.$transaction` creates:
- `Lead` row (with `clientId`, `sourceId`, `projectInterestId`)
- `LeadActivity` row (type `status_change`)

Post-transaction: `notifications.sendToRoles([ADMIN], 'lead_created', ...)`. No atomic tie — notification is best-effort.

### 1.2 Visit scheduled

`visits.service.ts` — two objects:
- `VisitRequest` (status `PENDING` → `APPROVED` → `SCHEDULED`)
- `VisitAppointment` (status `SCHEDULED` → `CONFIRMED` → `COMPLETED`)

No money moves here.

### 1.3 Reservation created

`reservations.module.ts:361` — single `prisma.$transaction`:
1. `unit.update` — `AVAILABLE → RESERVED`, sets `reservationExpiresAt`
2. `unitStatusHistory.create`
3. `reservation.create` (status `PENDING`)
4. `reservationActivity.create` (type `SUBMITTED`)
5. `leadActivity.create` (if `leadId` set)
6. `lead.update` — bumps lead stage to `RESERVED`

Post-transaction (not atomic): `notifications.sendToRoles([ADMIN, SALES_MANAGER], 'reservation_submitted_admin', ...)` and `notifications.sendToUser(clientId, 'reservation_payment_requested', ...)` if booking amount > 0.

### 1.4 Booking payment

**Admin-confirm path** — `reservations.module.ts:1226`: `prisma.$transaction` marks `bookingPaymentStatus → PAID`, sets `bookingPaidAt`, creates a `Deposit` row (type `BOOKING_AMOUNT`, `verified: true`, `reviewStatus: APPROVED`). No `paymentMethod` stored on this path.

**Customer-proof path** — `deposits.service.ts:561` (`submitBookingProofForCustomer`):
1. Creates `Deposit` row (`reviewStatus: PENDING_REVIEW`, `paymentMethod` stored)
2. Creates `Document` row (RECEIPT, ADMIN_ONLY)
3. Back-links `deposit.proofDocumentId`
4. `reservation.update` → `bookingPaymentStatus: PENDING`
5. Notifies `ADMIN+SALES_MANAGER`: `booking_payment_proof_submitted`

Admin approves (`deposits.service.ts:744`): `prisma.$transaction` sets `Deposit.reviewStatus → APPROVED`, `reservation.bookingPaymentStatus → PAID`.

**Unconfirm path** — `reservations.module.ts:1298`: `prisma.$transaction` resets `bookingPaymentStatus → UNPAID`, `deleteMany` on the `BOOKING_AMOUNT` deposit rows. If the deposit was the customer-proof path, the deposit is deleted, leaving `proofDocumentId` pointing to a document whose deposit no longer exists.

### 1.5 Reservation approval

`reservations.module.ts:setStatus()` (line ~1090): `prisma.$transaction`:
- `PENDING → APPROVED` (or `REJECTED`, or `CANCELLED`)
- `reservationActivity.create`
- `leadActivity.create` (if `leadId`)
- If `CANCELLED` or `REJECTED`: atomically frees unit `RESERVED → AVAILABLE` (only if no other active reservation on that unit)

Post-transaction: notifies `[clientId, salesId]` via `reservation_status_changed`.

### 1.6 Reservation → Contract conversion

`reservations.module.ts:1646` — 3-retry loop around `prisma.$transaction`:
1. `contract.create` (status implicitly unsigned, `signedAt: null`)
2. `user.update` — role `CLIENT → CUSTOMER`; sets `customerSince`; `passwordHash` forced to a random value if null (so the promotion is permanent)
3. `refreshToken.updateMany({ where: { userId }, data: { revoked: true } })` — all sessions invalidated (`d489400` 2026-08-18; **this line is missing from the test mock**, causing all 6 conversion tests to return 500 — `05-broken-suites.md`)
4. `unit.update` — `RESERVED → SOLD`, clears `reservationExpiresAt`
5. `unitStatusHistory.create`
6. `installmentPlan.create` + `installment.createMany` (materializes the payment schedule)
7. `reservation.update` — `status → CONVERTED`
8. `lead.update` — `stage → WON` (`reservations.module.ts:1886`)

Post-transaction (all best-effort, wrapped in try/catch):
- `notifications.sendToUser(customerId, 'contract_created_customer', ...)`
- `contracts.handleConvertedContract(id)` → tries to attach a pre-existing contract document; errors swallowed (`contracts.module.ts:189`)
- Broker notifications if `brokerId` set

### 1.7 Contract signing

`contracts.module.ts:605` — idempotent; re-signing an already-signed contract is a no-op:
1. `contract.update` — sets `signedAt`
2. Post-tx (all best-effort, each wrapped in try/catch):
   - `startUnitWarranties(unitId, signedAt)` — swallowed (`contracts.module.ts:651`)
   - `materializeFromContract(id)` — sales commission materialization, swallowed (`contracts.module.ts:716`)
   - Broker `broker_contract_signed` notification, swallowed (`contracts.module.ts:700`)
   - Customer `contract_signed_customer` notification

### 1.8 Installment paid

**Admin-record path** — `deposits.service.ts:152`: `prisma.$transaction`:
1. `installment.updateMany({ where: { id, status: { not: PAID } }, data: { status: PAID, paidAt } })` — row-level idempotency guard
2. If `count === 0` → throws `ConflictException` (already paid)
3. `deposit.create` — `type` derived from installment type; no `paymentMethod` field in `RecordDepositDto` (`deposits.dto.ts:18-24`)

Post-transaction: `notifications.sendToUser(customerId, 'deposit_recorded', ...)`.

**Customer-proof path** — `deposits.service.ts:448` (`submitProofForCustomer`):
1. `deposit.create` (status `PENDING_REVIEW`; `paymentMethod` stored via `CustomerSubmitProofDto.paymentMethod`)
2. `documents.create` (RECEIPT, ADMIN_ONLY)
3. `deposit.update` — sets `proofDocumentId`
4. Notifies `ADMIN+SALES_MANAGER`: `payment_proof_submitted`

Admin approves (`deposits.service.ts:744`): `prisma.$transaction` sets `Deposit → APPROVED`, `installment.update → PAID`.

---

## 2. Silent Failure Inventory

All items below fail without surfacing an error to the caller. The business action (DB write) succeeds; the side effect disappears.

| # | Location | What silently fails | Evidence |
|---|---|---|---|
| SF-01 | `notifications.module.ts:248` | `sendToUser()` wraps `send()` in try/catch; any push/email error is swallowed with `logger.warn` | Line 248 |
| SF-02 | `notifications.module.ts:365` | Email dispatched as `void this.email.sendNotificationEmail(...)` — fire-and-forget, no await | Line 365 |
| SF-03 | `email.service.ts:105` | `sendNotificationEmail()` returns early (silent) when `createTransporter()` returns null (SMTP_HOST/USER/PASS absent) | Line 105 |
| SF-04 | `deposits.service.ts:109` | `tryLinkReceiptDocument()` catches all document-linking errors; deposit survives with `proofDocumentId = null` | Line 109 |
| SF-05 | `contracts.module.ts:189` | `tryLinkContractDocument()` — same pattern; contract document back-link silently fails | Line 189 |
| SF-06 | `contracts.module.ts:651` | `startUnitWarranties()` on contract sign — catch logs warn; warranty items are never created | Line 651 |
| SF-07 | `contracts.module.ts:716` | `materializeFromContract()` on contract sign — sales commission creation silently fails | Line 716 |
| SF-08 | `contracts.module.ts:700` | Broker `broker_contract_signed` notification on sign — catch logs warn | Line 700 |
| SF-09 | `visits.service.ts:1382` | `notifyVisitDayReminder()` entire method in try/catch; reminder silently drops | Line 1382 |
| SF-10 | `reservations.module.ts` (post-convert) | Broker/customer notifications and `handleConvertedContract()` after convert transaction — all best-effort | Lines after 1646 |

**Shared root cause**: `NotificationsService.send()` always writes the `Notification` DB row first, so the in-app notification is never lost. Only push and email are unreliable. The DB row is the audit trail; the push/email are delivery channels. The design is intentional but the absence of any dead-letter queue or retry mechanism means push and email can silently fail indefinitely.

---

## 3. Notification Delivery Matrix

"EMAIL also?" = appears in `EMAIL_ELIGIBLE_TEMPLATES` set (`notifications.module.ts:145`). Email is dispatched best-effort (`void`); no guarantee of delivery even when listed.

| Template code | Seed channel | EMAIL also? | Trigger | Recipient |
|---|---|---|---|---|
| `visit_approved` | PUSH | No | Visit request approved | Client |
| `deposit_recorded` | PUSH | Yes | Admin records deposit | Customer |
| `reservation_expired` | IN_APP | No | Cron: reservation expires | Client |
| `maintenance_request_created` | IN_APP | Yes | Maintenance req created | ADMIN |
| `maintenance_request_assigned` | IN_APP | Yes | Maintenance assigned | Supervisor |
| `maintenance_request_status_changed` | IN_APP | No | Status transition | Customer |
| `maintenance_request_resolved` | IN_APP | Yes | Resolved | Customer |
| `maintenance_request_closed` | IN_APP | Yes | Closed | Customer |
| `maintenance_request_complaint_submitted` | IN_APP | No | Complaint submitted | ADMIN |
| `maintenance_request_unresolved` | IN_APP | No | Unresolved | ADMIN |
| `maintenance_request_resolution_confirmed` | IN_APP | No | Resolution confirmed | ADMIN |
| `visit_request_created` | IN_APP | No | Visit request submitted | ADMIN |
| `info_request_created` | IN_APP | No | Info request created | ADMIN |
| `visit_scheduled` | PUSH | No | Appointment scheduled | Client |
| `visit_sales_assigned` | PUSH | No | Sales user assigned | Sales |
| `visit_customer_confirmed` | IN_APP | No | Customer confirms visit | ADMIN |
| `visit_customer_reschedule_requested` | IN_APP | No | Customer asks reschedule | ADMIN |
| `visit_rescheduled` | PUSH | No | Rescheduled | Client |
| `visit_completed` | IN_APP | No | Visit completed | ADMIN |
| `visit_cancelled` | PUSH | No | Cancelled | Client |
| `visit_no_show` | IN_APP | No | No-show | ADMIN |
| `visit_day_reminder` | PUSH | No | Day-of reminder (cron) | Client |
| `visit_feedback_requested` | PUSH | No | Post-visit feedback | Client |
| `visit_feedback_received` | IN_APP | No | Feedback submitted | ADMIN |
| `reservation_submitted_admin` | IN_APP | Yes | Reservation created | ADMIN |
| `reservation_status_changed` | PUSH | Yes | APPROVED / REJECTED / CANCELLED | Client + Sales |
| `reservation_booking_paid` | PUSH | Yes | Booking payment confirmed | Client |
| `reservation_payment_requested` | PUSH | Yes | Booking amount due | Client |
| `contract_created_customer` | PUSH | Yes | Contract created on convert | Customer |
| `contract_signed_customer` | PUSH | Yes | Contract signed | Customer |
| `contract_document_available` | PUSH | Yes | Contract PDF uploaded | Customer |
| `broker_contract_signed` | IN_APP | No | Contract signed (broker) | Broker user |
| `broker_contract_created` | IN_APP | No | Contract created (broker) | Broker user |
| `deposit_verified` | IN_APP | Yes | Deposit verified (legacy path) | Customer |
| `payment_proof_submitted` | IN_APP | No | Customer submits proof | ADMIN + SM |
| `payment_proof_resubmitted` | IN_APP | No | Customer resubmits proof | ADMIN + SM |
| `booking_payment_proof_submitted` | IN_APP | No | Booking proof submitted | ADMIN + SM |
| `payment_proof_approved` | PUSH | **No** | Proof approved by admin | Customer |
| `payment_proof_rejected` | PUSH | **No** | Proof rejected by admin | Customer |
| `installment_plan_created` | IN_APP | No | Plan materialized | Customer |
| `installment_due_soon` | PUSH | Yes | Daily due-soon cron | Customer |
| `broker_lead_approved` | IN_APP | No | Lead approved | Broker |
| `broker_lead_rejected` | IN_APP | No | Lead rejected | Broker |
| `broker_lead_marked_duplicate` | IN_APP | No | Lead marked duplicate | Broker |
| `broker_commission_earned` | IN_APP | No | Commission materialized | Broker |
| `broker_commission_approved` | IN_APP | No | Commission approved | Broker |
| `broker_commission_rejected` | IN_APP | No | Commission rejected | Broker |
| `broker_commission_cancelled` | IN_APP | No | Commission cancelled | Broker |
| `broker_commission_paid` | PUSH | No | Commission paid | Broker |
| `broker_payout_created` | IN_APP | No | Payout drafted | Broker |
| `broker_payout_approved` | IN_APP | No | Payout approved | Broker |
| `broker_payout_processing` | IN_APP | No | Payout processing | Broker |
| `broker_payout_paid` | PUSH | No | Payout paid | Broker |
| `broker_payout_cancelled` | IN_APP | No | Payout cancelled | Broker |
| `lead_created` | IN_APP | No | Lead created | ADMIN |
| `lead_assigned_sales` | PUSH | No | Lead assigned to sales | Sales |
| `lead_stage_changed` | IN_APP | No | Stage changes | ADMIN |
| `lead_note_added` | IN_APP | No | Note added | ADMIN |
| `broker_approved` | PUSH | Yes | Broker firm activated | Broker |
| `broker_suspended` | PUSH | Yes | Broker firm suspended | Broker |
| `broker_unit_access_requested` | IN_APP | No | Unit access request | ADMIN |
| `broker_unit_access_approved` | PUSH | No | Unit access approved | Broker |
| `broker_unit_access_rejected` | IN_APP | No | Unit access rejected | Broker |
| `maintenance_sla_warning` | PUSH | No | SLA warning (cron) | ADMIN |
| `maintenance_sla_breached` | PUSH | No | SLA breached (cron) | ADMIN |
| `user_account_approved` | PUSH | Yes | Account approved | User |
| `user_account_suspended` | IN_APP | Yes | Account suspended | User |
| `admin_broadcast` | IN_APP | No | Manual admin broadcast | Any |

**Notable gap**: `payment_proof_approved` and `payment_proof_rejected` are the most customer-critical payment-workflow events. Both are PUSH-only and absent from `EMAIL_ELIGIBLE_TEMPLATES`. If a customer's device has no FCM token (or Firebase is not configured), they receive no notification when their payment proof is approved or rejected. The older `deposit_verified` template (legacy verify path) IS email-eligible, creating an inconsistency between the two approval flows.

---

## 4. State Machine Dead Ends

### 4.1 UnitStatus (3 states)

```
AVAILABLE → RESERVED  (reservation create transaction, reservations.module.ts:361)
RESERVED  → AVAILABLE  (reservation cancel/reject/expire, if no other active reservations)
RESERVED  → SOLD       (convert transaction, reservations.module.ts:1646)
SOLD      → (nothing)  TERMINAL — no write path back
```

Once a unit is SOLD, it cannot be returned to AVAILABLE or RESERVED via the API.

### 4.2 ReservationStatus (6 states)

```
PENDING   → APPROVED, REJECTED, CANCELLED
APPROVED  → CANCELLED only
CANCELLED → (nothing)  TERMINAL
REJECTED  → (nothing)  TERMINAL
EXPIRED   → (nothing)  TERMINAL (set by cron, no API write path)
CONVERTED → (nothing)  TERMINAL — reservation that became a contract cannot be reversed
```

`reservations.module.ts:1079` lists the statuses from which transitions are blocked. A CONVERTED reservation cannot be cancelled.

### 4.3 AppointmentStatus (7 states)

```
SCHEDULED        → CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED*
CONFIRMED        → COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED*
PENDING_RESCHEDULE → SCHEDULED (after new appointment created)
RESCHEDULED*     → (nothing)  TRAP — old appointment is frozen, new one is created
COMPLETED        → (nothing)  TERMINAL
CANCELLED        → (nothing)  TERMINAL
NO_SHOW          → (nothing)  TERMINAL
```

`visits.service.ts:38-44` — `FINAL_STATUSES` array. RESCHEDULED is intentional (immutable history): when a reschedule happens, the original appointment is sealed with status RESCHEDULED and a new appointment object is created. This is correct design but the enum value is unintuitive to readers.

### 4.4 InstallmentStatus (3 states)

```
PENDING  → PAID    (admin record or proof approve, deposits.service.ts:188, 756)
PENDING  → OVERDUE (cron: installments.module.ts:190-196)
OVERDUE  → PAID    (same deposit paths — `{ not: PAID }` guard allows OVERDUE→PAID)
PAID     → (nothing)  TERMINAL via API
```

**Gap**: soft-deleting the associated `Deposit` row (`deposits.service.ts:124`) does NOT flip the `Installment` back from PAID to PENDING. Un-verifying a deposit via `verify(false)` (`deposits.service.ts:392`) also does NOT flip the installment. The only reversal path is a direct DB write.

### 4.5 DepositReviewStatus (4 states)

```
NO_PROOF       → PENDING_REVIEW  (via verify(true) or proof submission)
PENDING_REVIEW → APPROVED        (via approveProof — marks linked installment PAID)
PENDING_REVIEW → REJECTED        (via rejectProof — customer can resubmit)
REJECTED       → PENDING_REVIEW  (customer resubmit)
APPROVED       → PENDING_REVIEW  (via verify(false) — but linked installment stays PAID)
APPROVED       → NO_PROOF        (via verify(false) if no receiptUrl)
```

**Gap**: `verify(false)` on an APPROVED deposit resets `reviewStatus` and `verified` but does NOT touch the linked `Installment`. `approveProof()` set it to PAID; `verify(false)` does not undo that. Creates a data inconsistency where the deposit says "pending review" but the installment says "paid" (`deposits.service.ts:392-431`).

### 4.6 InfoRequestStatus (3 states) — dead writers

```
OPEN       → (nothing via API)
RESPONDED  → (nothing via API)
CLOSED     → (nothing via API)
```

`requests.module.ts` exposes only `createInfoRequest()` (POST). There is no PATCH/PUT endpoint to advance status. `RESPONDED` and `CLOSED` are written only by direct DB manipulation or future code that does not yet exist. `reports.service.ts:338` counts OPEN requests; requests accumulate indefinitely. Source: `requests.module.ts:175,282,304` — only create + list methods.

### 4.7 MaintenanceStatus (5 states)

```
OPEN       → ASSIGNED (assign endpoint)
ASSIGNED   → IN_PROGRESS, OPEN (unassign)
IN_PROGRESS → RESOLVED
RESOLVED   → CLOSED (customer confirms) or reopened via complaint (workflow fires unresolved notification)
CLOSED     → (nothing)  TERMINAL
```

No cancel/abort path. Source: `schema.prisma:1524-1530`.

---

## 5. Cancel / Reverse / Correct Operations

| Entity | Cancel exists? | Undo/correct exists? | Gap |
|---|---|---|---|
| **Reservation** | Yes — `POST /reservations/:id/cancel` (ADMIN + `reservations:cancel`); frees unit atomically if no other active reservations. `reservations.module.ts:2262` | `unconfirmBookingPayment` reverts booking-paid status and deletes BOOKING_AMOUNT deposit. `reservations.module.ts:2304` | No un-reject. Cannot reopen a CANCELLED or EXPIRED reservation. |
| **Contract** | **No cancel endpoint.** `DELETE /contracts/:id` is soft-delete only (no status field, no unit release). `contracts.module.ts:931` | No unsign. No reversal. | **Critical**: when a signed contract falls through, staff can only soft-delete the contract. Unit stays SOLD. No mechanism releases the unit back to AVAILABLE. |
| **Installment (single)** | No cancel. | Soft-delete of linked `Deposit` does NOT flip installment back to PENDING (`deposits.service.ts:124`). | If admin records wrong payment, only path is a direct DB write. |
| **Deposit** | Soft-delete + restore. `deposits.service.ts:124-135` | `verify(false)` resets deposit status but NOT linked installment. `deposits.service.ts:392` | Data inconsistency: deposit shows un-verified while installment stays PAID. |
| **Visit (appointment)** | Yes — `AppointmentStatus.CANCELLED` via status update. | No un-cancel. | None blocking. |
| **Visit (request)** | Yes — `VisitRequestStatus.CANCELLED`. | No un-cancel. | None blocking. |
| **InfoRequest** | No cancel. | N/A — RESPONDED and CLOSED have no write path (`requests.module.ts`). | Requests accumulate forever. Staff cannot mark them handled. |
| **Lead** | No archive/cancel. WON/LOST stages exist but the stage can be reset via `updateStage()`. | Stage can be freely updated (`leads.service.ts:348`). | WON stage is not enforced; a CONVERTED lead can be manually moved back. |
| **Installment plan (template)** | `setStatus(INACTIVE)` exists. | `setStatus(ACTIVE)` exists. | None. |

---

## 6. Cross-Surface Consistency

### 6.1 Unit availability

Unit status (`AVAILABLE`/`RESERVED`/`SOLD`) is updated atomically in Prisma transactions. All surfaces (web-admin, web-public catalog, customer app, staff app) read from the same Postgres table. No caching layer is interposed for the unit status. Consistency is read-on-demand; there is no server-push to update a catalog listing when a unit flips from RESERVED back to AVAILABLE after a cancellation.

### 6.2 Role promotion on convert

`convert()` promotes `CLIENT → CUSTOMER` inside the transaction (`reservations.module.ts:1679`) and revokes all existing refresh tokens (`reservations.module.ts:1687`). The customer must re-login to receive a JWT with the new role. The customer app and web-public site will show 401 errors on the next API call, prompting a re-login. No push notification is sent for the role change itself; the customer learns about it only when their session expires or from the `contract_created_customer` notification.

### 6.3 Installment vs Deposit view inconsistency

When an admin soft-deletes a `Deposit` row without a corresponding installment status correction, the customer app's `GET /me/deposits` omits the deposit (soft-deleted rows excluded), while `GET /me/installments` still shows the installment as `PAID`. The two views become contradictory. The admin cannot observe this inconsistency through normal UI — deposits are in one list, installments in another.

### 6.4 Booking payment dual-path collision

Admin `confirmBookingPayment()` and customer `submitBookingProofForCustomer()` both write to `reservation.bookingPaymentStatus`. If both paths are used concurrently (admin confirms while a customer proof is PENDING_REVIEW):
- Admin confirm: creates an auto-verified BOOKING_AMOUNT deposit, sets status PAID
- If admin then `unconfirmBookingPayment()`: deletes the admin deposit, resets status to UNPAID — but the customer's PENDING_REVIEW deposit still exists
- Result: `bookingPaymentStatus` says UNPAID but a PENDING_REVIEW deposit exists, blocking the customer from resubmitting (`deposits.service.ts:599` checks for PENDING_REVIEW)

### 6.5 CapabilityService exists but enforces nothing

`Company.websiteEnabled`, `Company.customerAppEnabled`, `Company.staffAppEnabled` fields exist in the schema (MT rollout). `CapabilityService` and `@RequireCapability` decorator are implemented (`capability.guard.ts`). `@RequireCapability` is used on zero routes (confirmed by `grep` returning no matches). Tenant capability flags are purely administrative metadata at runtime; no route checks them.

---

## 7. Ranked Functional Gaps

Ranked by: customer-facing severity, whether failure is silent, and whether it blocks a business operation.

| Rank | Gap ID | Title | Severity | Silent? | Blocks? |
|---|---|---|---|---|---|
| 1 | FG-01 | Deposit model missing structured cheque/bank-transfer fields | High | No (data unstructured) | Yes — cheque bounce tracking |
| 2 | FG-02 | No contract cancellation or unit-release path | High | No | Yes — deal reversal post-contract |
| 3 | FG-03 | `reservation_conversion_workflow` test suite broken (zero coverage of money path) | High | Yes | Regressions on convert will be undetected |
| 4 | FG-04 | InfoRequest RESPONDED/CLOSED have no write path | Medium | No | Yes — support queue never drains |
| 5 | FG-05 | Installment PAID state is irreversible via API | Medium | No | Yes — wrong payment requires DB write |
| 6 | FG-06 | `verify(false)` on approved deposit does not flip installment back | Medium | Partly — admin sees mismatch | Yes — data integrity |
| 7 | FG-07 | `payment_proof_approved` / `payment_proof_rejected` not email-eligible | Medium | Yes — customer misses decision | No — push still sent |
| 8 | FG-08 | Admin `RecordDepositDto` has no `paymentMethod` field | Medium | No | No — data is missing, not lost |
| 9 | FG-09 | All push and email sends are best-effort (SF-01..SF-03) — no retry, no dead-letter | Medium | Yes | No — DB row always created |
| 10 | FG-10 | Sales commission / warranty materialization on contract sign are silently swallowed (SF-06, SF-07) | Medium | Yes | Yes — commissions may not exist |
| 11 | FG-11 | CapabilityGuard wired but `@RequireCapability` used on 0 routes | Low | No | No — capability flags are display-only |
| 12 | FG-12 | Unit status has no reverse path from SOLD | Low | No | Consequence of FG-02 |
| 13 | FG-13 | Booking-payment dual-path collision (admin confirm + customer proof) | Low | Partly | Rare race condition |
| 14 | FG-14 | Customer not notified of role promotion on convert | Low | Yes | No — customer re-logs in naturally |
| 15 | FG-15 | Phase and Building have no `updatedAt` column | Low | No | No — operational gap only |
| 20 | FG-20 | `User.phone` is stored in two incompatible formats (E.164 `+201…` and local `01…`) across different write paths | High | **Fixed 2026-09-27** — importer now writes E.164; dev DB backfilled; DI-E2E-4 proves OTP round-trip | Residual: pre-existing write paths listed in FG-21 |
| 21 | FG-21 | Three non-importer write paths store phone as-is from the DTO with no normalisation (`findOrCreateClient`, `createCompanyUser`, broker user creation) | Medium | Yes — same OTP split-account defect applies to customers created via leads or by admin | Not fixed in Phase 2 — scope to a dedicated phone-normalisation pass |
| 22 | FG-22 | argon2 called at library defaults everywhere — no config, no recorded rationale; 382 ms/login uncontended on CI, 11–19× degradation at 3 concurrent; production not measured | Medium | No — defaults are safe; risk is throughput, not security | No — login works; concurrent sign-in capacity is unknown |

---

### FG-01 detail: Deposit model vs bank-transfer / cheque workflow

The user's business collects payments via bank transfer and cheque (offline, with proof upload). The question: does the existing `Deposit` model capture what is needed?

**What exists** (`schema.prisma:1274-1315`):
- `paymentMethod PaymentMethod?` — enum: CASH, BANK_TRANSFER, CHEQUE, OTHER (`schema.prisma:1267`)
- `receiptUrl` — R2 URL to the uploaded proof image
- `amount`, `paidAt`, `note` (from DTO), `verified`, `reviewStatus`, `rejectionReason`

**What is missing**:

| Field | Why needed | Current workaround |
|---|---|---|
| `referenceNumber` / `bankTransactionId` | Bank transfer transaction ID — the primary traceability field for bank operations | Customer packs it into the free-text `note` field of `CustomerSubmitProofDto.note` (max 500 chars, unstructured) |
| `bankName` | Which bank processed the transfer — needed for reconciliation | Not stored |
| `chequeNumber` | Unique cheque identifier — mandatory for cheque tracking | Not stored |
| `chequeDueDate` | Date the cheque matures / can be presented | Not stored |
| `clearingDate` | Date the cheque was actually cleared at the bank | Not stored |
| `chequeStatus` enum | PENDING_CLEARANCE / CLEARED / BOUNCED — essential for post-dated cheque workflows | Not stored; a bounced cheque has no system representation |

**Admin path gap** (`deposits.dto.ts:18-24`): `RecordDepositDto` (used by `POST /deposits`, the admin recording flow) has no `paymentMethod` field. When admin manually records an installment payment, the payment method is always NULL on the resulting `Deposit` row.

**Consequence**: a post-dated cheque that bounces must be tracked entirely outside the system. Staff cannot flag a `Deposit` as BOUNCED — they can only soft-delete it and tell the customer manually. The customer's installment shows PAID (see FG-05) even after the cheque bounces. No audit trail of the bounce exists in the platform.

---

### FG-02 detail: No contract cancellation

`contracts.module.ts` exposes: `POST /contracts` (create), `PATCH /contracts/:id` (update editable fields), `POST /contracts/:id/sign`, `POST /contracts/:id/document`, `DELETE /contracts/:id` (soft-delete), `POST /contracts/:id/restore`.

There is no `ContractStatus` field in the `Contract` model (`schema.prisma`). There is no cancel, void, or terminate endpoint. `DELETE /contracts/:id` is a soft-delete (sets `deletedAt`) — it does not flip the unit back to AVAILABLE, does not promote the customer back to CLIENT, and does not reopen the reservation.

If a signed contract is cancelled by mutual agreement, the current system has no corrective path. The only recourse is direct database surgery.

---

### FG-03 detail: Broken conversion test suite

`reservation-conversion-workflow.spec.ts` — all 6 success-path tests return HTTP 500 since commit `d489400` (2026-08-18), which added `tx.refreshToken.updateMany()` to the convert transaction. The test mock does not include `refreshToken` as a mocked Prisma delegate, so the service throws. Source: `docs/audit/05-broken-suites.md`.

This means the most consequential transaction in the platform (unit SOLD, CLIENT→CUSTOMER, installment plan materialized, lead WON) has zero running unit-test coverage. Any regression in `convertReservation()` will reach production undetected.

---

### FG-04: Contract number is unreachable for directly-created contracts

**Severity:** Legal / compliance  
**Discovered:** 2026-09-26 during import schema investigation

`Contract.contractNumber` is a nullable column (`String? @unique`). It is only assigned in one place: `nextContractNumber()` called during `convertReservation()` (`reservations.module.ts:1671`). The direct-creation path — `POST /contracts` → `contracts.module.ts:368` — creates the contract with no `contractNumber` field in the `data` object, leaving it NULL.

`CreateContractDto` (`contracts.module.ts:104`) has no `contractNumber` field. `UpdateContractDto` (`contracts.module.ts:119`) also has no `contractNumber` field. There is no endpoint that can assign a number to a directly-created contract after the fact.

**Impact:** Contracts created by staff via `POST /contracts` (the admin data-entry path used for offline deals or pre-system contracts) are permanently numberless. A contract number is a legal document reference that appears on the PDF, on installment receipts, and in communications. A contract with `contractNumber = NULL` cannot be referenced by document number.

**Current behaviour in dev DB:** 2 contracts exist, both created via `POST /contracts`, both have `contractNumber = NULL`.

**Required fix (not in scope for this session):**
- Add `contractNumber?: string` to `UpdateContractDto` so staff can assign a number to a directly-created contract.
- Or: add `contractNumber` to `CreateContractDto` (optional) so it can be supplied at creation time.
- Either way, the uniqueness constraint (`contractNumber @unique`, currently global, planned to become `@@unique([companyId, contractNumber])`) must be respected.

**Import consequence:** the data importer will reject contract rows where `contractNumber` is NULL with a blocking validation error. This is correct — a contract with no number cannot be idempotently matched on re-import. Staff must assign numbers to any unNumbered contracts before attempting an import.

---

### FG-15: Phase and Building have no `updatedAt` column

**Severity:** Low  
**Discovered:** 2026-09-26 during data-import test design

Every other entity in the property tree (`Project`, `Unit`, `Contract`, `Lead`, etc.) carries an `updatedAt DateTime @updatedAt` column that records the wall-clock time of the last write. `Phase` (`schema.prisma:531`) and `Building` (`schema.prisma:549`) have only `createdAt`; there is no `updatedAt`.

**Consequence:** there is no record in the database of when a phase or building last changed. Admin and audit queries that ask "what changed recently?" cannot include phases or buildings. The data-export sheet includes a `createdAt` column for both but no last-modified date.

**Test implication:** because Phase and Building lack `updatedAt`, the import idempotency test (DI-E2E-1) cannot use timestamp comparison to prove a no-op UPDATE did not run on those rows. The test uses Postgres `xmin` (the system column holding the transaction ID of the last write, bumped by any UPDATE regardless of value changes) as the primary write-detection mechanism for all four tables.

**Required fix (not in scope for this session):**
- Add `updatedAt DateTime @updatedAt` to the `Phase` model.
- Add `updatedAt DateTime @updatedAt` to the `Building` model.
- Migration: backfill `updatedAt = createdAt` for all existing rows.
- No application-code change needed beyond the schema — Prisma handles `@updatedAt` automatically.

---

### FG-20: `User.phone` stored in two incompatible formats

**Severity:** High  
**Discovered:** 2026-09-27 during data-import Phase 2 review  
**Ticket:** MT-020 (deferred backfill migration)

#### What exists

`User.phone` is a `String? @unique` column. The platform has always treated the phone as an opaque string — there is no Postgres-level normalisation, no application-level `CHECK` constraint, and no enforced canonical format. As a result, two different write paths have always stored different formats:

| Write path | Format stored | Example |
|---|---|---|
| `auth.service.ts:registerCustomerV2` | E.164 via `canonicalPhone()` | `+201062800394` |
| `auth.service.ts:verifyOtpV2` | E.164 via `canonicalPhone()` | `+201062800394` |
| `data-import.service.ts` | Import-canonical (local form) | `01062800394` |
| `leads.service.ts:findOrCreateClient` | Raw trimmed from DTO (no normalisation) | whatever the caller sends |
| `super-admin.service.ts:createCompanyUser` | Raw from DTO (no normalisation) | whatever the admin types |
| `broker-users.service.ts` | Raw from DTO (no normalisation) | whatever the broker types |
| All seeds | E.164 hard-coded | `+966500000001`, `+201062800394` |

`canonicalPhone()` was introduced in MT-019 and is used exclusively in the auth service. The comment in `identity-normalize.ts` already states: "These functions do NOT mutate existing stored values. All stored phone values remain in their current form until a separate backfill migration is run (MT-020, deferred)."

#### Counts in `realestate_local` (as of 2026-09-27)

```
fmt       | count
----------+------
local-0   |    40    (01XXXXXXXXXX — importer-created CLIENTs, one Egyptian company)
E.164     |     6    (+966... — auth/seed-created CLIENTs, one Saudi company)
null      |    12    (staff, SUPER_ADMIN, broker users with no phone)
```

No cross-format duplicates exist today in the dev DB (zero rows where `+201XXXXXXXXXX` and `01XXXXXXXXXX` co-exist for the same mobile number). This is because the Egyptian company's 40 rows were all written by the data importer, and the Saudi company's 6 rows were all written by seeds — there is no overlap. In production, where real users can register via the mobile app AND be imported from Excel, the split is live.

#### The auth defect

The split causes a live auth defect for Egyptian customers:

1. An admin imports a customer with phone `01062800394` → stored as `01062800394`.
2. The same person downloads the mobile app and tries to register or log in via OTP.
3. `requestOtpV2` calls `canonicalPhone('01062800394', 'EG')` → `+201062800394`.
4. `verifyOtpV2` does `user.findFirst({ where: { phone: '+201062800394', companyId } })` → **not found**.
5. A **new user is created** with phone `+201062800394`.

Now one mobile number has two accounts: `01062800394` (the importer row, with any leads/contracts) and `+201062800394` (the OTP row, empty). `User.phone @unique` does not protect against this because the two strings are distinct.

The same defect applies in reverse: a user who registered via OTP (phone stored as E.164) and is then included in an Excel import will appear as a `create` operation in the importer rather than an `update`, and the importer will fail with a unique-constraint error at write time.

#### The read-path gap

`verifyOtpV2` looks up the user by the E.164-normalised phone (`canonicalPhone`). If the stored phone is `01...`, the lookup misses. The only currently safe path is if both the OTP request and the stored user are E.164 (i.e., the user originally registered via OTP). There is no normalisation on the read side.

`forgotPasswordV2` and `loginCustomerV2` both look up by email, not phone — they are unaffected.

#### The importer's current workaround

`data-import.service.ts` now contains `storedToImportPhone(stored)` and the `globalPhoneHits` DB query includes both `01...` and `+201...` forms. This is the correct **immediate fix** for the importer: it absorbs the inconsistency so that import operations correctly detect existing users regardless of how their phone was stored.

It is the **wrong permanent state**: every future feature that matches on phone (OTP login, duplicate detection, lead matching, synthetic-peer claims) must independently remember to handle both formats. `storedToImportPhone` will accumulate callers and eventually be missed somewhere.

#### Required fix (not yet scoped)

Two orthogonal decisions:

**Option A — Write-side normalisation (MT-020 backfill):**
- One-time migration: `UPDATE "User" SET phone = '+20' || substring(phone FROM 2) WHERE phone LIKE '01%'` for Egyptian companies, similar rules for other countries.
- After the migration, all auth-service read paths naturally find users because everything is E.164.
- The importer must then write E.164 (use `canonicalPhone` in `applyPlan`, not `c.phone` directly). `storedToImportPhone` can be removed.
- Risk: any downstream system that hard-codes `01...` format breaks. All seeds must be audited.

**Option B — Read-side normalisation without backfill:**
- All read paths that look up by phone call `canonicalPhone` first, and if that fails, also try the local-form equivalent.
- Equivalent to what `storedToImportPhone` + expanded IN clause does for the importer.
- Safer short-term but permanently increases cognitive load for every phone-based lookup.

The decision between A and B requires knowing the production phone format distribution. Run the query below on production before proceeding:

```sql
SELECT
  CASE
    WHEN phone LIKE '+%'  THEN 'E.164'
    WHEN phone LIKE '0%'  THEN 'local-0'
    WHEN phone IS NULL    THEN 'null'
    ELSE 'other'
  END AS fmt,
  COUNT(*)
FROM "User"
GROUP BY 1
ORDER BY 2 DESC;
```

And the cross-format duplicate check (should return 0 rows; if non-zero, those are split accounts):

```sql
SELECT u1.phone AS local_form, u2.phone AS e164_form, u1.id AS local_id, u2.id AS e164_id
FROM "User" u1
JOIN "User" u2
  ON u1.phone LIKE '01%'
 AND u2.phone = '+20' || substring(u1.phone FROM 2)
WHERE u1."companyId" = u2."companyId";
```

#### Fix applied (2026-09-27, data-import Phase 2)

**Root cause clarified:** The 40 `local-0` rows counted above were introduced entirely by the data importer shipped in this phase. Before the importer existed, no code path in this codebase wrote `01...` format — all app-created users were E.164. The gap was introduced, not pre-existing.

**Write-side fix:** `applyPlan` in `data-import.service.ts` now calls `canonicalPhone(c.phone, 'EG') ?? c.phone` when creating a new `User` row. The importer will never again store `01...` at rest. The 40 existing dev rows were backfilled with a one-time SQL update (`UPDATE "User" SET phone = '+20' || substring(phone FROM 2) WHERE phone LIKE '01%' AND phone ~ '^01[0-9]{9}$'`).

**`storedToImportPhone` moved** to `phone-normaliser.ts` (exported) so both the import service and the export service can use it as a bridge for the transitional period:
- **Import service** — still uses it on the read/match side so that any pre-existing `01...` rows in older prod DBs do not trigger false create-vs-update mismatches.
- **Export service** (`buildCustomers`, `buildLeads`) — converts stored phones to `01...` for display in the Excel file, removing the `+` prefix formula-injection risk in phone columns.

**OTP round-trip verified (DI-E2E-4):** A new e2e test proves end-to-end:
1. Import a customer with local phone `01099887766`.
2. Assert stored phone is E.164 `+201099887766`.
3. Seed an OtpCode (bypass SMS), call `verifyOtpV2` with the local phone.
4. Assert JWT sub equals the imported user ID and user count did not increase.

**Remaining pre-existing write paths not fixed in this phase:** See FG-21.

---

### FG-21: Pre-existing un-normalised phone write paths

**Severity:** Medium  
**Discovered:** 2026-09-27, as a side-effect of FG-20 investigation  
**Status:** Not fixed — scope to a dedicated phone-normalisation pass

#### What exists

Three code paths outside the importer write `User.phone` directly from the incoming DTO without calling `canonicalPhone()`:

| Path | File | Behaviour |
|---|---|---|
| `findOrCreateClient` | `apps/api/src/modules/leads/leads.service.ts` | Creates a CLIENT user from the lead DTO `phone` field; no normalisation. Caller may send `01...` or `+201...`. |
| `createCompanyUser` | `apps/api/src/modules/super-admin/super-admin.service.ts` | Creates any role user from admin DTO. Phone stored verbatim. |
| Broker user creation | `apps/api/src/modules/brokers/broker-users.service.ts` | Creates BROKER_STAFF users from broker DTO. Phone stored verbatim. |

#### Why it matters

The same OTP split-account defect described in FG-20 applies to these paths. A customer created via `findOrCreateClient` (e.g., when a sales agent adds a lead with a local phone) and who then tries to log in via OTP will get a second empty account.

#### Not fixed in Phase 2

These are pre-existing gaps — they existed before the data importer was built. The importer write-side fix (FG-20) was the immediate fix because the importer was the cause of the 40 `local-0` rows. Normalising the remaining paths requires:

1. Ensuring every caller already sends strings that `canonicalPhone` can parse (all three paths use `IsString` validators with no phone format constraint — callers may send any string).
2. Deciding what to do when `canonicalPhone` returns null (i.e., the caller sent a non-normalizable phone). Currently those rows would just be stored verbatim; after the fix, they would need to be rejected with a 400.
3. Auditing seeds and test data that may hard-code local-format phones into these paths.

Scope this as part of the MT-020 normalisation pass or a separate "phone hygiene" ticket.

---

### FG-22: argon2 at library defaults — no explicit configuration, no recorded rationale

**Severity:** Medium (performance / throughput)  
**Security note:** The defaults are conservatively strong — this is not a security defect.  
**Discovered:** 2026-10-05 during CI Playwright instrumentation analysis (run 143)

#### What exists

`apps/api/src/modules/auth/auth.service.ts` calls `argon2.verify()` and `argon2.hash()` with no options at lines 65, 243, 246, 251, 326, 554, 605, 636, 725, and 735. `argon2` is imported at line 13. No argon2 configuration exists anywhere in `apps/api/src`.

The installed version is `argon2@0.41.1`. Its defaults, confirmed from `node_modules/argon2/argon2.cjs`:

| Parameter | Default | Notes |
|---|---|---|
| `memoryCost` | 65536 (64 MiB) | Per-invocation, not pooled |
| `timeCost` | 3 | Iterations |
| `parallelism` | 4 | Spawns 4 pthreads via libuv `Napi::AsyncWorker` |
| `type` | argon2id | Correct choice |
| `hashLength` | 32 | bytes |

These are the OWASP-recommended minimum parameters for argon2id as of 2023. They are not wrong. The problem is that no decision was ever made: the parameters were inherited by omission, not chosen.

#### Measured cost (CI runner only — production not measured)

| Condition | `durationMs` | Source |
|---|---|---|
| Non-contended — 1 login, CI 2-vCPU runner, wave 1 | 382 ms | CI run 143, API log 06:41:52 |
| Contended — waves 2–7, concurrent RSC renders | 4,299–7,382 ms | CI run 143, API log 06:42:00–06:43:21 |
| Production | not measured | argon2.verify has never been timed on production hardware |

**What was directly observed (run 143):** every API handler completed in 5–74 ms across all endpoints and all waves; `fetch()` calls in the Next.js SSR layer reported ~14,000 ms wall time for the same requests. The 14-second gap is not inside any handler. By elimination, the time must be spent waiting before the handler starts — most likely in the OS TCP queue or the event loop accept backlog. The queue was not directly instrumented; this is an inference from the handler/caller gap, not an observation.

**The finding is in the scaling, not the absolute number.** 382 ms uncontended implies a theoretical ceiling of roughly 2.6 logins per second per core before any contention. The observed degradation at three concurrent logins was 11–19× (4,299–7,382 ms vs 382 ms). Simple CPU division would predict ~3×. The super-linear gap is the actual finding: a memory-hard function at 64 MiB with `parallelism=4` does not degrade linearly, and the extent of the degradation is not predictable from the uncontended figure alone.

**Open question:** 382 ms × 3 concurrent logins = 1,146 ms of pure argon2 serial time. The measured wave-2 login handler was 5,239 ms. The remaining ~4,100 ms is unaccounted for — either contention effects are doing all of it, or something else in the login handler is slow under load. This was not resolved. Do not treat argon2 as the complete explanation until the login handler is profiled under controlled concurrent load.

**Production ceiling:** unknown. The CI 2-vCPU runner is not representative of production hardware. The ceiling must be measured there before any parameter change is justified by throughput arguments.

#### What is needed

1. Add an explicit argon2 options constant to `auth.service.ts` (or a `security.config.ts` helper), replacing every bare `argon2.verify(...)` call. Include a comment citing the OWASP guideline version and the trade-offs considered.
2. Decide whether to adjust `parallelism` (reduces CPU contention per call, weakens parallel-attack resistance), `timeCost`/`memoryCost` (reduces wall time, weakens brute-force resistance), or keep the defaults unchanged — and record whichever choice is made.
3. Consider whether `parallelism` should be capped at 1 or 2 on single-core or dual-core deployments. `parallelism=4` on a 2-vCPU host means argon2 is over-provisioned relative to the machine — each call already exceeds the available CPU.

**Do not lower parameters to fix a CI timeout.** The correct motivation is a deliberate security/throughput trade-off, written down, reviewed, and applied uniformly. The current implicit defaults are the wrong long-term state not because they are insecure but because the next person to read the code has no way to know whether the parameters were chosen deliberately or inherited by accident.

---

## FG-23 — Admin list pages fetch whole tables to compute a handful of aggregates

**Severity:** Medium · **Blocks launch:** no · **Status:** partially fixed — units, brokers and requests done; three sales dashboards and `users` remain

### What exists

Two admin pages fetch far more rows than they render, on every request:

| Page | Fetched per render | Rendered | Why the extra rows are fetched |
|---|---|---|---|
| `/dashboard/units` | `?pageSize=500` units + `?pageSize=200` projects | 20 rows | Four KPI aggregates (total, AVAILABLE, RESERVED, SOLD counts) and a total-price sum, computed client-side with `.filter().length` and `.reduce()`; projects feed a filter dropdown |
| `/dashboard/maintenance` | 100 maintenance requests + all categories + `?pageSize=100` admin users | one table | Assignee and category dropdowns |

`apps/web-admin/src/app/dashboard/units/page.tsx:77-83` and
`apps/web-admin/src/app/dashboard/maintenance/page.tsx:131-135`.

Both are already a single parallel wave — the sequential-preamble bug that
affected `/account`, `/dashboard/contracts` and `/dashboard/units` was fixed in
`d5b8468`, `8711615` and `ee22b2c`. What remains is payload size, not ordering.

### How it was found

`/dashboard/units` was the only route failing in three separate Playwright
suites (dashboard-smoke, sales-smoke, sales-manager-smoke) after the ordering
fixes landed, and `/dashboard/maintenance` was the fourth failure. Collapsing
the fetch waves on `/dashboard/units` did not move it, which is what
distinguishes this from the ordering bugs: the cost is in the rows, not the
round trips.

### Impact

On the 2-vCPU CI runner these two routes do not render inside Playwright's
default 30s per-test budget. Production hardware is faster and no user-facing
timeout has been reported, but the shape is the same everywhere: seven hundred
rows crossing the network to produce four integers and a sum. Cost grows
linearly with tenant size, and the `pageSize` ceilings (500, 200, 100) mean the
aggregates also silently go **wrong** for any company that exceeds them — a
tenant with 600 units will show KPI counts computed from only the first 500.
That correctness bug is the more serious half of this finding.

### Scope — wider than the two routes CI surfaced

The CI timeouts pointed at two pages. Sweeping every admin page that computes
an aggregate from a fetched array found seven, and the worst caps are the
smallest ones:

| Page | Cap | Numbers that go wrong above it |
|---|---|---|
| `_components/sales-home` | **100** | won / lost leads, converted deals |
| `_components/sales-manager-home` | **100** | reservation stats |
| `my-compensation` | **100** | leads, reservations |
| `users` | **100** | user counts |
| `brokers` | 200 | active / pending / suspended |
| `units` | 500 | available / reserved / sold, total value |
| `requests` | 500 | open / responded / closed |

A cap of 100 on a sales rep's own lead counts is not an edge case — it is the
normal state a couple of months into use. `contracts` is a near miss: it
computes its KPI counts from the current page and carries a comment admitting
they are approximate, which is the same defect wearing a disclaimer.

### Fix shape — `meta.facets` on existing list responses

Chosen over per-resource `/stats` endpoints: no new routes, no new permission
surface, no second round trip, and the field is optional so the
OpenAPI-generated mobile client is unaffected.

```
GET /v1/units?page=1&pageSize=20
{ "data": [ ...20 rows... ],
  "meta": { "total": 1340, "page": 1, "pageSize": 20,
            "facets": { "counts": { "status": { "AVAILABLE": 812, … } },
                        "sums":   { "price": "4821000000.00" } } } }
```

Counts are numbers; sums are decimal strings, matching how `DepositsService`
already serialises money so that `Decimal(14,2)` does not lose precision
through a JSON float. `PaginationFacets` is declared in three places that must
stay in step: `apps/api/src/common/utils/pagination.ts`,
`packages/shared-types/src/pagination.ts`, `apps/web-admin/src/lib/types.ts`.

**Done:** `/units` returns facets; `/dashboard/units` reads them and no longer
fetches 500 rows. The KPI strip stays deliberately unfiltered — it describes
the whole portfolio and always has. Making it follow the table's filters would
change what the numbers mean, which is a separate decision from making them
correct.

**Gate:** `e2e-catalog-auth` A4b asserts the facet counts sum to `meta.total`
while `pageSize=1`. That fails if facets are absent and also if a later change
computes them from the returned page instead of from the `where` clause, which
is the property that actually matters.

**Done so far:** `/units`, `/brokers`, `/info-requests`, `/leads`,
`/reservations` and `/users` all return facets. The clients rewired are
`/dashboard/units`, `/dashboard/brokers` and `/dashboard/requests`.

Facets are tenant-scoped for free: `groupBy` and `aggregate` are both in
`READ_OPS` in `prisma.service.ts` and pass through `applyReadPolicy`, so a
facet cannot count another company's rows. This was verified, not assumed.

**Remaining, and not all the same shape:**

- `_components/sales-home`, `_components/sales-manager-home` and
  `my-compensation` use the fetched rows for more than counting. `wonLeads`,
  `lostLeads` and `convertedDeals` are plain counts that facets fix, but
  `staleLeadsCount` and `expiringWithin7` are computed per row from
  `leadAgeDays()` and reservation expiry dates. Those need server-side
  support of their own — a facet cannot express "NEW or INTERESTED and
  untouched for three days". Applying facets to these pages makes three
  numbers correct and leaves two wrong, with nothing on screen to tell them
  apart, so they are being done deliberately rather than mechanically.

- `users` is a different and worse defect, recorded separately below.

### The `users` page does not paginate at all

`/dashboard/users` fetches `?pageSize=100` and then does its searching,
filtering **and row rendering** from that array
(`const rows = allUsers.filter(...)`). There is no server-side pagination on
the page. Above one hundred users the page does not merely show wrong counts —
it does not show the users. A facet would correct the KPI while leaving the
list silently truncated, which is the worse half.

Fixing it means moving search, filter and pagination to the server, which is a
page rewrite rather than a facets swap. Tracked here so the smaller fix is not
mistaken for the whole one.

### Adjacent finding — `pageSize` is unbounded on 22 of 26 list endpoints

While sweeping for this, only four list DTOs were found to cap `pageSize`
(`audit`, `deposits`, `documents`, `installments`). The other twenty-two accept
any integer, including `@Public() GET /v1/public/units`. `PaginationQuerySchema`
in `packages/shared-types` does declare `.max(100)`, but nothing in the API
imports it — it is documentation, not a control.

This is why the oversized client fetches were possible at all, and it is its
own availability risk: a single request can ask for every row a tenant owns.
Capping it is blocked on this work, not independent of it — the dropdowns that
legitimately request 200–500 rows today need a lightweight options endpoint
first, or they will silently truncate. Sequence: facets → options endpoints →
cap `pageSize` everywhere.

### Current mitigation

`/dashboard/units` was marked `slow: true` in the e2e `RouteCheck` lists while
it still fetched 500 rows. That mark has been removed now the fetch is gone —
CI is the proof that the fix worked, which is what the mark was for.
`/dashboard/maintenance` still carries `test.slow()`; it has no ordering bug,
only volume, and is covered by the remaining work above.

### What is needed

1. A stats endpoint per resource (`GET /units/stats`, `GET /maintenance-requests/stats`)
   returning the counts and sums the KPI strip needs, computed in SQL.
2. Replace the oversized snapshot fetches with that endpoint plus the paged
   list the table actually renders.
3. Feed filter dropdowns from a dedicated lightweight endpoint (id + name only)
   rather than full entity pages.
4. Once the snapshot fetches are gone, remove the `slow: true` marks and
   confirm the routes pass at the default 30s budget. The marks are the
   regression test for this work.

Point 1 also fixes the silent correctness bug: aggregates computed in SQL are
not capped by a client-side page size.
