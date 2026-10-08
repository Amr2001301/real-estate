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

**Status column re-verified against the code on 2026-10-08** (read, not taken from docs; file:line evidence in the notes). FG-01..FG-15 were written 2026-09-13; several were fixed by the reversal work logged in `10-implementation-log.md` without this table being updated.

| Rank | Gap ID | Title | Severity | Silent? | Blocks? | Status (2026-10-08) |
|---|---|---|---|---|---|---|
| 1 | FG-01 | Deposit model missing structured cheque/bank-transfer fields | High | No (data unstructured) | Yes — cheque bounce tracking | **Done 2026-10-08.** `POST /deposits` takes `cheque` / `transfer` details and links the deposit to a `PaymentInstrument`. Rules (decided 2026-10-08): a cheque leaves the installment unpaid (deposit `PENDING_REVIEW`, out of the review queue, approve/verify refused) until it clears — clear pays the installment, bounce or cancel rejects the deposit; a bank transfer is collected at once (a `CLEARED` instrument); one open cheque per installment (409). `GET /payment-instruments` lists cheques by status, due date and customer. web-admin: payment method + cheque fields on the deposit form (an installment already waiting on a cheque is not offered), `/dashboard/cheques` to deposit, clear, bounce or cancel. e2e FG01-1..16; Playwright `cheques.spec.ts`. |
| 2 | FG-02 | No contract cancellation or unit-release path | High | No | Yes — deal reversal post-contract | **Fixed** — `contract-cancellation.service.ts` (cancel in one transaction: installments, clawback, unit release, role demotion, `ContractCancellation` row); `POST contracts/:id/cancel`, `/release-unit`. Residual: the `Refund` model has no write path. |
| 3 | FG-03 | `reservation_conversion_workflow` test suite broken (zero coverage of money path) | High | Yes | Regressions on convert will be undetected | **Fixed** — `reservation-conversion-workflow.spec.ts` mocks `refreshToken.updateMany`, nothing skipped; runs in the unit job. (`05-broken-suites.md` still describes the old breakage.) |
| 4 | FG-04 | InfoRequest RESPONDED/CLOSED have no write path | Medium | No | Yes — support queue never drains | **Open** — `requests.module.ts` has only POST/GET for info requests. Planned as Step I in `09-reversal-design.md`. *Note: the detail section headed "FG-04" below is a different gap (contract number unreachable) — also still open.* |
| 5 | FG-05 | Installment PAID state is irreversible via API | Medium | No | Yes — wrong payment requires DB write | **Partly** — `POST deposits/:id/reverse` writes a `PaymentCorrection` and reopens the installment, but only for APPROVED deposits (admin-recorded ones default to `NO_PROOF`), `softDelete` leaves the installment PAID, and nothing stops reversing the same deposit twice. |
| 6 | FG-06 | `verify(false)` on approved deposit does not flip installment back | Medium | Partly — admin sees mismatch | Yes — data integrity | **Fixed** — `deposits.service.ts` (correction + installment → PENDING in one transaction); `deposit-reversal.spec.ts`. |
| 7 | FG-07 | `payment_proof_approved` / `payment_proof_rejected` not email-eligible | Medium | Yes — customer misses decision | No — push still sent | **Fixed** — `emailEnabled` column on templates, both seeded `true`; the send path reads it. |
| 8 | FG-08 | Admin `RecordDepositDto` has no `paymentMethod` field | Medium | No | No — data is missing, not lost | **Fixed** — optional `paymentMethod` on the DTO, stored. Residual: the admin booking-confirm path stores none (Step K). |
| 9 | FG-09 | All push and email sends are best-effort (SF-01..SF-03) — no retry, no dead-letter | Medium | Yes | No — DB row always created | **Partly** — outcomes now recorded on the Notification row (`pushError`, `emailError`, `*SentAt`); still no retry or dead-letter. |
| 10 | FG-10 | Sales commission / warranty materialization on contract sign are silently swallowed (SF-06, SF-07) | Medium | Yes | Yes — commissions may not exist | **Open** — `contracts.module.ts` `sign()` still catches and logs all three. See FG-27 for a second defect in `sign()`. |
| 11 | FG-11 | CapabilityGuard wired but `@RequireCapability` used on 0 routes | Low | No | No — capability flags are display-only | **Fixed** — global guard; 29 `@RequireCapability` usages (17 controllers, 12 routes). |
| 12 | FG-12 | Unit status has no reverse path from SOLD | Low | No | Consequence of FG-02 | **Fixed** via FG-02 (cancellation with AUTO release, or `release-unit`). No direct admin override. |
| 13 | FG-13 | Booking-payment dual-path collision (admin confirm + customer proof) | Low | Partly | Rare race condition | **Fixed, residual** — confirm returns 409 while a proof is PENDING; but confirm's cleanup still deletes *all* booking deposits, so after a rejected proof a later confirm deletes that proof's deposit and orphans its document. |
| 14 | FG-14 | Customer not notified of role promotion on convert | Low | Yes | No — customer re-logs in naturally | **Open** — promotion + token revoke, no notification. |
| 15 | FG-15 | Phase and Building have no `updatedAt` column | Low | No | No — operational gap only | **Open.** |
| 20 | FG-20 | `User.phone` is stored in two incompatible formats (E.164 `+201…` and local `01…`) across different write paths | High | **Fixed 2026-09-27** — importer now writes E.164; dev DB backfilled; DI-E2E-4 proves OTP round-trip | Residual: pre-existing write paths listed in FG-21 | Fixed |
| 21 | FG-21 | Eleven non-auth write paths stored `User.phone` as typed (the original count of three was wrong) | Medium | Yes — same OTP split-account defect applies to customers created via leads or by admin | **Fixed 2026-10-07** — every path goes through `phoneForWrite()`; B-FG21 proves lead → OTP lands on one account | Fixed (PR #3) |
| 22 | FG-22 | argon2 called at library defaults everywhere — no config, no recorded rationale; 382 ms/login uncontended on CI, 11–19× degradation at 3 concurrent; production not measured | Medium | No — defaults are safe; risk is throughput, not security | No — login works; concurrent sign-in capacity is unknown | **Open — needs a decision** (parameters) and a production measurement |
| 23 | FG-23 | Admin list pages fetched whole tables to compute aggregates and fill dropdowns (see the FG-23 section) | High | Yes — wrong counts and missing options past 100–500 rows | No | **Fixed** — `meta.facets` on list endpoints; `/dashboard/users` and the three sales dashboards server-side (PR #2); `pageSize` capped at 500; create-form pickers search the API (PRs #11–#14); dropdowns and filters use `/projects|brokers|users/options` (PR #15). `/dashboard/maintenance` paged, 20 per page with filters kept (Playwright `maintenance-paging.spec.ts`). |
| 24 | FG-24 | Three user-create paths (broker-portal lead client, broker-portal team, admin broker users) wrote no `companyId` on the TENANT_CONTROLLED `User` model | High | Partly — users vanish from tenant-scoped lists | **Fixed 2026-10-07** — companyId set, foreign-user attach refused, unambiguous rows backfilled | Fixed (PR #4) |
| 25 | FG-25 | Scheduled jobs did their per-row work in bypass: every cron notification was stored with `companyId` NULL and never pushed or emailed, role fan-outs (maintenance SLA) sent nothing, reservation-expiry activity lost its company; the two appointment-reminder templates were never seeded | High | Yes — nothing failed visibly; reminders simply never arrived | **Fixed 2026-10-07** — each row is handled in its own company (`runInCompany`); templates seeded; CRON-CTX e2e | Fixed (PR #7) |
| 26 | FG-26 | `NotificationTemplate.code` is unique platform-wide but the model is `TENANT_OWNED` and seeded under the default company only — every notification for any other company fails at the template lookup; `cheque_bounced` and `contract_cancelled_customer` are not seeded at all | **Critical** for a second tenant | Yes — sends are best-effort and swallow the error | **Fixed 2026-10-07** — platform defaults + per-company overrides (option 1); missing templates seeded | Fixed (PR #8) |
| 27 | FG-27 | `contracts.module.ts` `sign()` sets `signedAt` but never `status: ACTIVE` — every contract signed since the D1 backfill stays `UNSIGNED` | Medium | Yes | No — the API only branches on `CANCELLED`, and the web and staff apps derive "signed" from `signedAt`; any report or export filtering on `status` is wrong | **Fixed 2026-10-08** — `sign()` sets `status: ACTIVE` (and refuses a CANCELLED contract); migration `20261008000001_fg27_signed_contracts_active` repairs signed rows still UNSIGNED; seeds set the status; e2e A4j |
| 28 | FG-28 | `GET /users` is ADMIN-only, so SALES / SALES_MANAGER got empty staff dropdowns, and the "registered client" search on new-reservation / new-visit returns nothing for them | Medium | Yes — `safe()` swallowed the 403 | Partly — reps cannot attach a registered client | **Fixed.** Staff dropdowns via `/users/options` (PR #15). Clients by the ownership rule decided 2026-10-08 (`common/utils/client-ownership.ts`): a rep acts on own clients, a manager on the team's, an admin on all; unowned clients are given out by an admin only. Enforced on reservation, visit and lead creation (which accepted any lead or client id of the company); `GET /users/clients` is the scoped search; a lead for a phone owned elsewhere or unowned is refused with who can move it (e2e A4i) |

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
**Status:** Fixed 2026-10-07

#### What was there — eleven paths, not three

The original entry named three paths, two of them in the wrong file. A sweep
of every `user.create` / `user.update` that sets `phone` found eleven outside
the auth service, all storing the phone exactly as typed:

| Path | File |
|---|---|
| Lead → find-or-create client | `leads/leads.service.ts` (`findOrCreateClient`) |
| Public info / visit request → client | `requests/requests.module.ts` (`findOrCreateClient`, ×2 callers) |
| Broker portal lead → client | `broker-portal/broker-portal-leads.service.ts` (`resolveClient`) |
| Broker portal visit → client | `broker-portal/broker-portal-visits.service.ts` (`findOrCreateBrokerLead`) |
| Broker portal team member create / update | `broker-portal/broker-portal-team.service.ts` |
| Admin broker user create / update | `broker-users/broker-users.service.ts` |
| Super-admin company user create | `super-admin/super-admin.service.ts` (`createCompanyUser`) |
| Admin user create | `users/users.service.ts` (`create`) |
| Admin user edit **and `PATCH /users/me`** | `users/users.service.ts` (`update`) |

`PATCH /users/me` is the one that matters most: it is how a customer adds a
phone to their own profile, so a customer who typed `01…` there could never
log in by OTP afterwards. The auth service's three paths already used
`canonicalPhone()`; the data importer was fixed under FG-20.

Several paths also looked up an existing user or lead **by the raw phone**
before creating one — so `01…` missed a client stored as `+201…`, created a
second one, or (with `User.phone @unique`) failed. Normalising only the write
would have left those lookups splitting records.

#### Fix

One helper, `common/utils/phone-for-write.ts`, applies the auth service's rule:
E.164 first, then the company's country, falling back to EG exactly as
`TenantResolverService` does. Every path above calls it once, at the top, and
uses that one value for its lookup, its duplicate check and its write.

The three decisions the original entry said were needed:

1. **Callers sending arbitrary strings** — an unparseable phone is now a
   **400**, not a row. Storing it verbatim is what caused the split, and a
   phone that cannot be parsed cannot be an identity key.
2. **What null means** — `undefined` leaves an update's phone untouched; `null`
   or blank clears it.
3. **Existing data** — an update that resends the phone **unchanged** is not
   validated. Edit forms resend every field, and phones stored before this fix
   may not parse (the seeds hold some, e.g. `+96650010001`, too short for SA);
   without this, every edit of such a user would 400.

No backfill is included. FG-20 backfilled the importer's rows in dev; any
production `01…` rows written by these paths before the fix still need the
FG-20 SQL run against production, with the duplicate check first.

**Gate:** `e2e-catalog-auth` **B-FG21** walks the original defect: a lead
created with `01…` stores its client as `+201…`; the same number in E.164
reuses that client; OTP login with the local form signs in **as that client**
and the account count stays one; garbage is a 400; and an unchanged legacy
phone survives an edit. With the leads change reverted, the first four fail —
the OTP test fails because login creates the second account. The helper has
its own unit spec.

---

### FG-24: Three user-create paths write no `companyId`

**Severity:** High (tenancy) · **Discovered:** 2026-10-07, during the FG-21 sweep · **Status:** fixed 2026-10-07

`User` is `TENANT_CONTROLLED`: the Prisma middleware does not inject
`companyId`, so every create must set it. Three do not:

| Path | Creates |
|---|---|
| `broker-portal/broker-portal-leads.service.ts` `resolveClient` | CLIENT from a broker-submitted lead |
| `broker-portal/broker-portal-team.service.ts` `create` | BROKER team member |
| `broker-users/broker-users.service.ts` `create` | BROKER user (admin side) |

The sibling path `broker-portal-visits.service.ts` sets
`companyId: getTenantContext()?.companyId`, which is what makes these look like
omissions rather than a design choice.

**What it broke, concretely** (read in `auth.service.ts`, not inferred):

- `loginStaff` looks the user up by `(email, companyId)`, so a null-company
  broker user got "Invalid credentials" with the right password on the tenant
  staff login.
- Token refresh checks company lifecycle only for users that have a company.
  A broker user with none kept refreshing after their company was
  **SUSPENDED**.
- Every tenant-scoped user query (directory, seat counts, reports) skipped them.

**Decision:** a broker's users belong to the developer company the broker
belongs to. Broker users take `Broker.companyId` (each user has one broker —
`BrokerUser.userId` is unique — so this is exact, not inferred from the caller);
clients created from a broker lead take the request's tenant, as the visits
path already did.

**Fix:**

- The three create paths set `companyId`.
- Attaching an *existing* user to a broker now refuses a user from another
  company (409). Email and phone are still globally unique (backlog #3), so the
  existing-user lookup can return a foreign account; before this, attaching it
  handed that account to this company. An existing user with no company is
  given the broker's.
- Migration `20261007000001_fg24_backfill_user_company` repairs rows already
  written, **only where unambiguous**: BROKER users from their broker; CLIENT /
  CUSTOMER users holding a broker-submitted lead, when all their leads sit in
  one company. A client whose leads span companies is left NULL for a human.
  Tested on synthetic rows in a rolled-back transaction: broker → set,
  single-company client → set, split client → still NULL.

**Gate:** `e2e-catalog-auth` **B-FG24** — the portal-lead client, the
portal team member and the admin-added broker user each carry the broker's
company; the team member signs in through `login-staff`; a foreign company's
user cannot be attached. With the service changes reverted, all four fail.

**Before deploying:** count what the migration will leave NULL, so the
ambiguous rows are known rather than discovered:

```sql
SELECT role, COUNT(*) FROM "User"
WHERE "companyId" IS NULL AND role IN ('BROKER','CLIENT','CUSTOMER')
GROUP BY role;
```

---

### FG-25: Scheduled jobs did their per-row work in bypass

**Severity:** High · **Status:** Fixed 2026-10-07

Every cron opens `runTenantContext({ bypass: true })` to sweep all companies,
and then did each row's work in that same bypass context. Found while checking
whether the option-(a) user helpers could be retired (doc 13 §0.1) — they
cannot: in bypass the middleware does not scope, and `getRequiredCompanyId()`
inside the helpers is what failed closed.

What the bypass did, proved on the e2e database before the fix:

| Job | Effect |
|---|---|
| Appointment reminders (day-before, hour-before) | Notification row stored with `companyId` NULL — not in the recipient's `/me/notifications`; push and email aborted at `resolveTenantUser` (`getRequiredCompanyId() called in bypass context`). Also: the two template codes were never seeded, so even that row was never written |
| Installment due-soon reminders | Same NULL-company row, no push or email |
| Maintenance SLA warning / breach | `sendToRoles` threw inside `scopedUserFindMany`; nobody notified. Swapping in a plain `findMany` would have notified **every company's** admins |
| Maintenance unresolved sweep | Customer and admin notifications as above |
| Reservation expiry | `ReservationActivity`, `LeadActivity`, `UnitStatusHistory` rows stored with `companyId` NULL — "Expired automatically" missing from the timeline |

**Fix:** each row is processed inside `runInCompany(row.companyId)`; rows with
no company are skipped with a warning (reservation expiry keeps its old path
for them so a due reservation still expires). The appointment-reminder
templates are seeded.

**Gate:** `e2e-mt-security` **CRON-CTX** runs the real jobs through
`TestApp.runCronJob`: the day-before reminder lands under the customer's
company and in their `/me/notifications`; an SLA breach in company A reaches
A's admin and not company B's; an expired reservation's EXPIRED activity
carries its company. All three fail with the cron files reverted.

---

### FG-26: Notification templates exist for the default company only

**Severity:** Critical as soon as a second company is live · **Status:** Fixed 2026-10-07 (option 1)

`NotificationTemplate.code` is `@unique` platform-wide, the model is
`TENANT_OWNED`, and `seed.ts` creates the templates and then backfills them
to the seed company. Every `send()` looks the template up with
`findUnique({ where: { code } })`; the middleware adds the caller's
`companyId`, so for any other company the lookup returns nothing and the send
throws `Template … not found` — swallowed, because sends are best-effort.
Proved on the e2e database: an SLA breach in a second company notified no one.
The admin template editor (`POST /notification-templates`, ADMIN) cannot fix it
either: an upsert from company B misses A's row and the create collides on the
global unique `code`.

Also not seeded anywhere: `cheque_bounced` (payment instruments) and
`contract_cancelled_customer` (contract cancellation) — those sends fail for
every company.

**Options (decision needed):**

1. *Platform defaults + per-company overrides.* `@@unique([companyId, code])`,
   platform rows with `companyId` NULL, lookup = the company's row else the
   platform row. Admins edit only their own override. Most correct; a migration
   and a lookup change.
2. *Platform-only templates.* Reclassify as `PLATFORM_GLOBAL`, `companyId`
   NULL, editing restricted to SUPER_ADMIN. Smallest change; tenants lose
   per-company wording.

**Decision (2026-10-07): option 1.** The product is white-label (ADR-17); each
developer may want its own wording.

| Change | Where |
|---|---|
| `code` is unique per `(companyId, code)`, `NULLS NOT DISTINCT` — exactly one platform row per code and one override per company. Existing rows become platform defaults | migration `20261007000003_notification_template_platform_defaults` |
| `NotificationTemplate` is `TENANT_CONTROLLED`: a tenant-scoped read could never see a `companyId` NULL row. `NotificationsService` is the only reader/writer | `model-tenancy.ts` |
| `templatesFor(codes)`: the company's override, else the platform default. With no company in context (bypass) only platform defaults — never another company's override | `send`, `/me/notifications`, broadcast |
| The editor (`POST /notification-templates`) writes the caller's override keyed on its own `companyId`; the 403 "belongs to another tenant" guard is gone because there is nothing shared to collide with. The list shows the company's effective templates | `upsertTemplate`, `listTemplates` |
| `admin_broadcast` is created as a platform row on boot. Before, that upsert ran with no tenant context on a tenant-scoped model and failed on every start | `onModuleInit` |
| Seed: templates are platform rows, removed from the `companyId` backfill; `cheque_bounced` and `contract_cancelled_customer` added | `seed.ts` |

**Gate:** e2e `e2e-mt-security` **FG-26** — an SLA breach in a company other
than the seed company reaches that company's admin; company B's override of
`maintenance_sla_breached` changes B's title only, A keeps the platform text,
and the platform row is untouched. Both fail on the previous code (B receives
nothing). Security **NOTIF-1/2** rewritten for the new model: A posting B's code
creates A's own override; B's row and B's editor view are unchanged.

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

**Severity:** Medium · **Blocks launch:** no · **Status (2026-10-08):** fixed for every page in the sweep — units, brokers, requests, users and the three sales dashboards — and the dropdown half is done: create-form pickers search the API (PRs #11–#14) and filters / assignee dropdowns use `GET /projects|brokers|users/options` (PR #15, point 3 below). **Remaining:** `/dashboard/maintenance` still fetches `?pageSize=100` and renders it with no paging, so request 101 is invisible.

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

**The three sales dashboards — fixed.** `_components/sales-home`,
`_components/sales-manager-home` and `my-compensation` no longer count rows.
Applying facets alone would have fixed three numbers and left two wrong with
nothing on screen to tell them apart, so the two that are not facets got
server-side support of their own:

- `GET /leads` — `stage` accepts a comma-separated list, and `createdBefore`
  takes an exact ISO instant. "Stale" is then a filtered total:
  `?stage=NEW,INTERESTED&createdBefore=<now − 3 days>&pageSize=1` →
  `meta.total`. The existing `dateTo` could not do this — it is day-granular
  and would have been off by up to a day.
- `GET /reservations` — `status` accepts a list; `expiresFrom` / `expiresTo`
  bound `expiresAt`; `sort=expiresAt` returns soonest-lapsing first (with `id`
  as tiebreak so paging is stable). "Expiring within 7 days" is a filtered
  total, and the active-reservations card is the first five rows of the
  sorted list rather than five rows sorted out of an arbitrary hundred.
- Unknown enum members and malformed instants are a 400. Silently dropping a
  misspelled value would widen the filter to everything; passing it through
  was a Prisma 500.

Everything else on the pages reads `meta.total` or `meta.facets`: open, won
and lost leads and the stage distribution (lead facets); active, pending and
converted reservations (reservation facets); upcoming visits (`meta.total` —
this was `.length` of a 50-row page). Recent leads are the API's own newest
five instead of five sorted out of a capped page.

**What a number means changed in one place, deliberately.** "Expiring within
7 days" used to exclude only CONVERTED, CANCELLED and EXPIRED, so a REJECTED
reservation whose expiry was still in the future counted as expiring. It is
now PENDING and APPROVED only — the same set as the Active Reservations tile
it is a sub-count of. A rejected reservation is not about to lapse.

**One bound left, on purpose.** The urgent (<48 h) reservation rows on the
sales home are the head of the 7-day list, fetched 50 at a time. The 7-day
count is `meta.total` and exact; the urgent rows would only be incomplete if
one rep had more than 50 reservations lapsing within two days. Today's visits
are the same shape: the first rows of a 50-row page sorted by time.

**Gate:** `e2e-catalog-auth` A4e creates its own leads and reservations,
narrows every query to them with `q`, and asserts exact totals for the stage
list, the stale filter and the 7-day window (the REJECTED and CANCELLED rows
must not count), the `sort=expiresAt` order, and the 400s. Reverting the API
change fails all five.

- `users` is a different and worse defect, recorded separately below.

### The `users` page did not paginate at all — fixed

`/dashboard/users` fetched `?pageSize=100` and then did its searching,
filtering **and row rendering** from that array
(`const rows = allUsers.filter(...)`). There was no server-side pagination on
the page. Above one hundred users it did not merely show wrong counts — it did
not show the users, with nothing on screen to say anything had been cut.

Fixed by moving the work to the server rather than adding a facet to a
truncated list:

- `GET /v1/users` gained an `active` filter. It is parsed explicitly rather
  than through a boolean pipe so that an absent param stays `undefined` and is
  not coerced to `false`, which would have silently hidden every inactive user.
- The list already supported `role`, `q` and `page`/`pageSize`; the page now
  passes all four instead of filtering in the browser.
- Facets gained a `role` dimension and a `max` dimension (`lastLoginAt`) to
  back the "admins + managers" and "last login" tiles. `max` is a third facet
  shape alongside `counts` and `sums` — a most-recent-timestamp is neither.
- The KPI call deliberately keeps the role filter but drops `q` and `status`.
  The tiles describe the directory, not the current search, which is what they
  did before. Making them correct is one change; changing what they count
  would be another.

**Gate:** `e2e-catalog-auth` A4c asserts `?active=true` returns only active
rows and that its `meta.total` equals the `active.true` facet of the
unfiltered call. If the server-side filter is removed the param is ignored,
the two totals become equal to the directory size, and the test fails.

### Adjacent finding — `pageSize` had no upper bound — fixed

**Correction first.** An earlier version of this section, and the commit
message that introduced it, said "22 of 26 list DTOs place no upper bound on
`pageSize`". That number was wrong. It came from grepping for `@Max` on the
same line as the field, which misses the many DTOs that put each decorator on
its own line. The real count was **18 of 25 already capped, 5 DTO fields
not** — plus two service method signatures, which class-validator never sees
anyway. The claim is corrected here rather than quietly dropped, because a
wrong number in an audit doc is worse than no number.

What was true, and is the actual hole: **sixteen controllers read `pageSize`
straight off `@Query` with no DTO at all**, so no decorator could ever reach
them. `@Public() GET /v1/public/units` was among the reachable surface. A
single unauthenticated request could ask for every row a tenant owns.
`PaginationQuerySchema` in `packages/shared-types` does declare `.max(100)`,
but nothing in the API imports it — it was documentation, not a control.

**Fix — clamp at the chokepoint, validate at the edge.**

`takeSkip()` and `paginate()` both clamp through one `clampPageSize()` rule, so
the bound holds for every list that uses them — 34 of 36 `paginate` call sites,
and anything added later, validated or not. Both clamp, not just the query:
clamping the query alone would make `meta` lie, reporting a `pageSize` of
10,000 while 500 rows came back and computing `totalPages` from the fiction.
The clamp also guards `NaN`, which `Number(undefined)` in a controller produces
and which would otherwise reach Prisma as `take: NaN`.

The two sites that build `take`/`skip` by hand were brought in:
`installments.module.ts` now uses `takeSkip`, and
`broker-portal-activity.service.ts` clamps its inputs. The latter needed care —
it over-fetches `page * pageSize` from two sources before merging, so clamping
the derived limit would have dropped rows that belong on the requested page,
turning a cost problem into a correctness one. Its inputs are clamped instead.

The five uncapped DTO fields gained `@Max(MAX_PAGE_SIZE)` so a caller gets a
clear 400 rather than a quietly truncated page. The clamp is the guarantee; the
decorator is the good error message.

**Ceiling is 500, not 100,** because 500 is the largest page any client asks
for today, so this breaks nothing. Tightening to 100 still depends on the
filter dropdowns getting a lightweight options endpoint; until then they
legitimately need large pages.

**Gate:** `e2e-catalog-auth` A4d asks for `pageSize=100000` three ways — an
unvalidated route (`/v1/users`, which must clamp and report 500 in `meta`), a
validated one (`/v1/units`, which must 400), and the unauthenticated public
catalogue. Remove the clamp and the first and third fail.

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
