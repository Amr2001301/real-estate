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
