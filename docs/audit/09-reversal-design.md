# Reversal & Correction Design

> **Type:** Design document — read-only. No source files, schema, or tests modified.
> **Date:** 2026-09-17 (rev 6: D4 three decisions — §8.2 step L corrected; PARTIALLY_COLLECTED; waive reason column; see Appendix C-24/C-25/C-26)
> *(rev 5: 2026-09-17 — payout dimension — APPROVED payout side-effects; see Appendix C-23)*
> *(rev 4: 2026-09-16 — BrokerCommissionStatus PAID clarification, §6.3 AuditLog payload fix)*
> *(rev 3: 2026-09-13 — traceability, paidAt, three scenarios, reporting correctness)*
> **Input documents:** `08-functional-gaps.md` (sections 4, 5, 7, FG-01/FG-02 details),
> `01-system-map.md` (section 2)
> **Governing constraint:** Policy is configurable, not hardcoded. No refund percentage,
> penalty rule, or commission-clawback logic belongs in code. The operator enters amounts;
> the system records the decision with a mandatory reason and a full audit trail.

---

## Hard rules (non-negotiable, apply to every section below)

**Rule 1 — Actual amounts are truth; policy is suggestion only.**
The system reads Settings to produce a pre-filled suggestion at the moment of action.
The operator may accept or change every suggested value. The recorded transaction stores
whatever the operator entered. A change to a Setting never retroactively alters a past
transaction. No service may re-derive a historical amount from current policy.
The implication: every corrective record stores its own complete financial snapshot.

**Rule 2 — Corrective records are never deleted.**
A bounced cheque is never soft-deleted. A clawed-back commission is never cancelled
or deleted. If a commission was already PAID before the contract was cancelled, the
clawback is recorded as an outstanding receivable against the broker — not as a
mutation of the existing PAID record.

---

## 0. Scope

The platform today models the happy path only. Every "down" path — bounced cheque,
deal collapse after signing, wrong payment entry — currently requires direct database
surgery. This document designs the minimal corrective layer. It does not design a
general ledger; it closes exactly the gaps identified in `08-functional-gaps.md`.

The four things that need designing:

1. A **PaymentInstrument model** so cheques and bank transfers carry structured data
   and their own lifecycle.
2. A **PaymentCorrection record** so settled payments can be reversed without mutation.
3. A **ContractStatus field + ContractCancellation record** so deals can be unwound
   without touching the unit table directly.
4. A minimal **guard** to prevent the booking-payment dual-path collision.

---

## 1. What the Business Cannot Represent Today

### 1.1 Post-dated cheque awaiting clearance

**What happened:** Customer submits a cheque dated 30 days in the future. The
cheque is received and logged. The bank has not yet processed it.

**What must the money records show:** A Deposit exists for the installment, linked
to an instrument in state `PENDING_CLEARANCE`. The installment should NOT be marked
PAID yet — payment is contingent on the cheque clearing.

**What must the unit show:** No change; this is a payment-track concern only.

**What must the customer see:** "Cheque received, pending clearance — due
[chequeDueDate]." Not "PAID" and not "OVERDUE."

**Today's gap:** The system has no `PENDING_CLEARANCE` state. Staff either (a) mark
the deposit APPROVED and flip the installment to PAID prematurely, or (b) don't
record the deposit at all and let the installment show OVERDUE.

---

### 1.2 Cheque bounced

**What happened:** The deposited cheque was returned unpaid by the bank.

**What must the money records show:** The original Deposit and cheque-receipt
document remain intact as evidence that the cheque was received. A correction
record is added documenting the bounce. The installment reopens per the
`cheque.bounced.installmentAction` setting (section 4.4). A bounce penalty charge
(EGP amount from `cheque.bounced.penaltyAmount`, editable by operator) may be
added as a new obligation.

**What must the unit show:** No change unless the contract is subsequently
cancelled.

**What must the customer see:** Outstanding installment, with a note that the
previous cheque was rejected. No previous "PAID" confirmation should remain visible.
Any bounce penalty appears as a separate BOUNCE_PENALTY installment row.

**Today's gap:** The only recourse is soft-deleting the Deposit and manually
re-setting the installment in the database. No bounce event is recorded, and the
receipt document (proof the cheque was received) is orphaned.

---

### 1.3 Bank transfer that never arrived

**What happened:** Customer uploaded a transfer receipt. Admin approved the proof.
The bank's reconciliation shows no matching transfer arrived (wrong reference,
wrong amount, or fraudulent screenshot).

**What must the money records show:** Same as 1.2 — original Deposit preserved,
correction record added explaining the reversal, installment reopened.

**What must the customer see:** Installment outstanding; prior approval reversed.
Customer receives a notification explaining the reversal.

**Today's gap:** Identical to 1.2. The only path is `verify(false)` which resets
the Deposit's `reviewStatus` but leaves `Installment.status = PAID` (FG-06).

---

### 1.4 Payment recorded against the wrong installment

**What happened:** Admin recorded a deposit against installment #3 but the
customer paid installment #5.

**What must the money records show:** A reassignment correction on the original
Deposit moving it to installment #5. Installment #3 reopens; installment #5 is
credited. The original Deposit row is never deleted — the reassignment is the
audit trail.

**What must the customer see:** Installment #5 paid, installment #3 outstanding.

**Today's gap:** No reassignment path exists. Staff delete the deposit and re-record
it, losing the trail between the original record and the correction.

---

### 1.5 Customer overpays

**What happened:** Customer transfers EGP 55,000 against an installment of
EGP 50,000.

**Today's gap:** The Deposit stores a single `amount`. There is no credit note or
surplus-allocation concept.

**Note:** Overpayments are genuinely rare in a post-dated cheque market (cheques
are written for exact amounts). This case is **deferred**. The PaymentCorrection
model can accommodate a `SURPLUS_ALLOCATION` type in a later iteration.

---

### 1.6–1.9 Contract cancellation events

Covered by sections 4.1–4.5 below (contract cancelled by agreement or default,
unit resold after cancellation, customer refunded).

---

## 2. Correction Model

### 2.1 MUTATE vs LEDGER — comparison

| Criterion | (a) MUTATE | (b) LEDGER (reversing entries) |
|---|---|---|
| **Auditability** | Poor. After a flip, the previous state is gone unless AuditLog captures it. | Strong. The settled record is never touched. The reversal entry *is* the audit trail. |
| **Fits existing soft-delete** | Extends it — soft-delete IS a mutation; flipping status is the same pattern. | Complementary — soft-delete stays as-is; reversals are a separate, lighter mechanism. |
| **Reporting correctness** | Single query on `Installment.status` is always correct. No new complexity. | After a reversal the handler writes the new status directly (PENDING or OVERDUE). `Installment.status` remains the query target. No extra join for normal read paths. |
| **Effort** | Lower. | Slightly higher — new `PaymentCorrection` table; bounce handler must write both a correction row and update `Installment.status` atomically. |
| **Survives a customer dispute 6 months later** | Fragile — if a staff member's "fix" was itself wrong, the chain is lost. | Durable — every correction is a first-class row; full sequence is printable for arbitration. |

### 2.2 Recommendation: Append-only correction records (LEDGER)

**Recommend (b).** The deciding factor is the dispute scenario. "The AuditLog JSON"
is not a document a court accepts; a dated record ("On 2026-11-03, admin Amr reversed
Deposit #X because the cheque bounced, recorded installment #Y as unpaid") is.

**This is NOT a double-entry accounting system.** There is no `credit`/`debit` pair,
no chart of accounts, no general ledger. The design is: _a settled row is immutable;
the corrective action is a new row that references it._ After writing the correction
row, the service also updates `Installment.status` in the same `$transaction`. This
is not a violation of "never mutate settled records" because the correction row is
what proves the record is no longer settled — the status update is the consequence.

### 2.3 What it costs

- One new table: `PaymentCorrection`.
- One nullable FK on `Installment`: `lastCorrectionId` — set after any correction
  touches the installment (see section 3.5 for which readers must use it).
- The bounce handler writes the correction row + new installment status +
  `lastCorrectionId` in a single `$transaction`.
- The customer portal and admin detail views must surface correction context
  (actor, date, reason) for installments where `lastCorrectionId IS NOT NULL`.
- The admin deposit review UI must expose "reverse" and "reassign" actions.

---

## 3. Cheque & Bank-Transfer Data Model

### 3.1 Design decision: extra columns on Deposit vs. separate PaymentInstrument

**Decision: separate `PaymentInstrument` model.**

The one-to-many relationship breaks the "extra columns on Deposit" option: one
post-dated cheque may cover several installments, creating several Deposit rows.
If cheque fields live on Deposit, the cheque number and status are duplicated
across those rows. When the cheque bounces, all rows must be updated atomically —
a manual transaction constraint that the schema cannot enforce.

Additionally, a cheque has its own lifecycle (`PENDING_CLEARANCE → DEPOSITED →
CLEARED / BOUNCED → REPLACED`) that is independent of the Deposit's review
lifecycle (`PENDING_REVIEW → APPROVED / REJECTED`). Merging them into one model
creates state-machine conflicts: a deposit can be APPROVED by admin but the cheque
can later bounce after the bank returns it weeks later.

The extra table is small and the FK from Deposit to PaymentInstrument is optional,
so existing Deposit records require no migration.

### 3.2 Proposed Prisma schema

```prisma
// ─── Payment instrument (cheque or bank transfer) ──────────────────────────

enum PaymentInstrumentType {
  BANK_TRANSFER
  CHEQUE
}

enum PaymentInstrumentStatus {
  /// Cheque received physically; not yet submitted to bank.
  PENDING_CLEARANCE
  /// Submitted to bank; awaiting confirmation.
  DEPOSITED
  /// Bank confirmed funds received / cheque cleared.
  CLEARED
  /// Bank returned cheque unpaid. NEVER soft-deleted — Hard Rule 2.
  BOUNCED
  /// This instrument was replaced by another (see replacedById chain).
  REPLACED
  /// Never presented; voided before use.
  CANCELLED
  // BANK_TRANSFER instruments use only PENDING_CLEARANCE → CLEARED / CANCELLED.
}

model PaymentInstrument {
  id    String                @id @default(uuid()) @db.Uuid
  type  PaymentInstrumentType

  // ── Bank-transfer fields (type = BANK_TRANSFER) ──────────────────────
  bankName         String?  @db.VarChar(200)
  referenceNumber  String?  @db.VarChar(100)

  // ── Cheque-specific fields (type = CHEQUE) ────────────────────────────
  chequeNumber   String?    @db.VarChar(100)
  drawerBankName String?    @db.VarChar(200)
  chequeDueDate  DateTime?
  clearingDate   DateTime?
  bounceReason   String?    @db.VarChar(500)
  bounceDate     DateTime?

  // ── Replacement chain ─────────────────────────────────────────────────
  replacedById  String?             @db.Uuid
  replacedBy    PaymentInstrument?  @relation("InstrumentReplacement", fields: [replacedById], references: [id])
  replacements  PaymentInstrument[] @relation("InstrumentReplacement")

  status        PaymentInstrumentStatus @default(PENDING_CLEARANCE)

  recordedById  String   @db.Uuid
  recordedBy    User     @relation("InstrumentRecordedBy", fields: [recordedById], references: [id])
  createdAt     DateTime @default(now())

  companyId  String?  @db.Uuid
  company    Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  deposits  Deposit[]

  @@index([companyId])
  @@index([status])
  @@index([replacedById])
}

// ─── Additions to existing Deposit model ────────────────────────────────────
// paymentInstrumentId  String?  @db.Uuid
// paymentInstrument    PaymentInstrument? @relation(...)
// @@index([paymentInstrumentId])
//
// Deposit.paymentMethod preserved as denormalized fast-read field.
// When PaymentInstrument is linked, paymentMethod MUST be kept in sync.

// ─── Additions to existing Installment model ────────────────────────────────
// lastCorrectionId  String?  @db.Uuid
// lastCorrection    PaymentCorrection? @relation("InstallmentLastCorrection",
//                     fields: [lastCorrectionId], references: [id])
//
// Set whenever a PaymentCorrection is written that touches this installment.
// Nullable — null means no correction has ever occurred.
// Used by: portal installment list, admin installment detail, XLSX export.
// NOT used by: overdue cron, reminder cron, financial report totals (those
// query status directly).
// Rationale: see section 3.5.
// @@index([lastCorrectionId])

// ─── Payment correction (reversing entry) ────────────────────────────────────

enum PaymentCorrectionType {
  /// Deposit nullified (bounce, fraud, data-entry error, wrong amount).
  /// Linked installment returns to PENDING or OVERDUE per installmentAction setting.
  REVERSAL
  /// Deposit moved from one installment to another (wrong installment).
  /// Source installment reopens; target installment becomes PAID.
  REASSIGNMENT
}

model PaymentCorrection {
  id    String                @id @default(uuid()) @db.Uuid
  type  PaymentCorrectionType

  depositId  String   @db.Uuid
  deposit    Deposit  @relation(fields: [depositId], references: [id])

  /// For REVERSAL: the installment being un-paid.
  /// For REASSIGNMENT: the source (wrong) installment being un-credited.
  sourceInstallmentId  String?      @db.Uuid
  sourceInstallment    Installment? @relation("CorrectionSource", fields: [sourceInstallmentId], references: [id])

  /// For REASSIGNMENT only: the target (correct) installment being credited.
  targetInstallmentId  String?      @db.Uuid
  targetInstallment    Installment? @relation("CorrectionTarget", fields: [targetInstallmentId], references: [id])

  /// MANDATORY — freetext reason shown in audit view and dispute export.
  reason  String  @db.VarChar(2000)

  performedById  String   @db.Uuid
  performedBy    User     @relation("CorrectionPerformedBy", fields: [performedById], references: [id])
  createdAt      DateTime @default(now())

  companyId  String?  @db.Uuid
  company    Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([depositId])
  @@index([sourceInstallmentId])
  @@index([targetInstallmentId])
  @@index([companyId])
}

// ─── Addition to PlanPaymentType enum ───────────────────────────────────────
// Add:
//   BOUNCE_PENALTY   // ad-hoc charge added when a cheque bounces
// A BOUNCE_PENALTY installment is appended to the customer's existing
// InstallmentPlan; dueDate and amount are operator-entered at bounce time.

// ─── Addition to InstallmentStatus enum ─────────────────────────────────────
// Add:
//   CANCELLED  // installment obligation cancelled (e.g. contract cancellation)
```

### 3.3 Cheque state machine

```
PENDING_CLEARANCE  →  DEPOSITED     (admin: "submitted to bank")
PENDING_CLEARANCE  →  CANCELLED     (admin: "cheque voided before use")
DEPOSITED          →  CLEARED       → installment PAID (Sub-case B clearance)
DEPOSITED          →  BOUNCED       → see 3.4 Sub-case A or B
BOUNCED            →  REPLACED      (admin: "replaced by new instrument")
CLEARED            →  (terminal)
CANCELLED          →  (terminal)
REPLACED           →  (terminal)
```

Bank-transfer instruments:
```
PENDING_CLEARANCE  →  CLEARED       (admin: "reconciliation confirmed")
PENDING_CLEARANCE  →  CANCELLED     (admin: "transfer not received / reversed")
CLEARED            →  (terminal)
CANCELLED          →  (terminal)
```

### 3.4 What each cheque transition does to linked installments

The BOUNCED transition branches on whether linked deposits were already APPROVED
(installments already marked PAID) or still PENDING_REVIEW (installments never
marked PAID). These are two distinct scenarios with different corrective needs.

---

**`PENDING_CLEARANCE → DEPOSITED`**

No change to installments. They remain PENDING or OVERDUE.

---

**`DEPOSITED → CLEARED`**

In a single `$transaction`:
1. `PaymentInstrument.status = CLEARED`, `clearingDate = now()`
2. For each linked Deposit: `reviewStatus = APPROVED`, `verified = true`
3. For each linked Installment: `status = PAID`, `paidAt = clearingDate`

---

**`DEPOSITED → BOUNCED — Sub-case A: bounce before clearance**
*(Deposits are still `PENDING_REVIEW`; installments were never PAID)*

This is the common post-dated cheque scenario. The cheque was received and
submitted but the bank returned it before funds cleared.

In a single `$transaction`:
1. `PaymentInstrument.status = BOUNCED`, `bounceDate`, `bounceReason`
2. For each linked Deposit where `reviewStatus = PENDING_REVIEW`:
   `reviewStatus = REJECTED`,
   `rejectionReason = "Instrument bounced — cheque [chequeNumber] returned [bounceDate]"`
3. Installments: **no status change** — they were never PAID. They remain
   PENDING or OVERDUE (the overdue cron has been running normally throughout).
4. **No `PaymentCorrection` rows** — nothing was settled to reverse.
5. If `penaltyAmount > 0`: create `BOUNCE_PENALTY` Installment on the plan.

Operator UX: bounce modal shows affected deposits and installments; penalty field.

Post-transaction: `cheque_bounced` notification to customer.

---

**`DEPOSITED → BOUNCED — Sub-case B: post-clearance reversal**
*(Deposits were APPROVED; installments are PAID)*

This happens when the bank initially confirms clearance but later reverses
(e.g., fraudulent cheque discovered weeks after clearing is confirmed — rare).

In a single `$transaction`:
1. `PaymentInstrument.status = BOUNCED`, `bounceDate`, `bounceReason`
2. For each linked Deposit where `reviewStatus = APPROVED`:
   - `Deposit.reviewStatus` stays `APPROVED` — the admin's review decision is
     preserved as permanent evidence (Hard Rule 2). The instrument's BOUNCED
     status tells the story.
   - Write `PaymentCorrection` (REVERSAL): `depositId`, `sourceInstallmentId`,
     `reason` (from operator's bounce modal), `performedById = adminId`
3. For each affected Installment:
   - Apply `installmentAction` setting:
     `REOPEN_AS_OVERDUE` → OVERDUE if `dueDate < now()`, else PENDING
     `REOPEN_AS_PENDING` → always PENDING
   - `Installment.paidAt` is **NOT cleared** (see section 3.6)
   - `Installment.lastCorrectionId = PaymentCorrection.id`
4. If `penaltyAmount > 0`: create `BOUNCE_PENALTY` Installment on the plan.

Post-transaction: `cheque_bounced` notification to customer.

---

**`BOUNCED → REPLACED`**

1. Create new `PaymentInstrument` with `status = PENDING_CLEARANCE`.
2. `original.status = REPLACED`, `original.replacedById = newInstrument.id`.
3. Admin creates new Deposits for the affected installments linked to the new
   instrument. Old Deposits remain as permanent evidence.

---

**One cheque covering multiple installments**

Each covered installment has its own Deposit row pointing to the same
`PaymentInstrument`. On bounce: the `$transaction` iterates all linked deposits
and applies the correct sub-case to each. If one of the installments was already
paid by other means, its deposit is not linked to this instrument — no correction
is written for it.

---

### 3.5 Row-level traceability: `lastCorrectionId`

**The problem.** Rev 2 removed `computeInstallmentStatus()`. Without it,
`Installment.status = PENDING` after a Sub-case B reversal is indistinguishable
from a `PENDING` that was never paid. Any reader that does not join
`PaymentCorrection` sees an ordinary outstanding installment — no signal that
this installment was once settled and was subsequently reversed.

**The fix.** Add a nullable `lastCorrectionId` FK to `Installment` (schema
already shown in section 3.2). Set it inside the same `$transaction` that writes
the `PaymentCorrection` row. The field is:
- `null` for all installments that were never corrected (the common case)
- non-null for installments touched by any REVERSAL or REASSIGNMENT

This adds **zero join overhead** to every read path that does not need correction
context: the field is a column on the Installment row itself.

**Read paths and whether they require correction context:**

| Reader | Where | What it shows | Must check `lastCorrectionId`? |
|---|---|---|---|
| Customer portal installment list | web-public `/account/installments`, Flutter `/account/installments` | PAID / PENDING / OVERDUE per-row | **Yes** — must show "previously paid — reversed [date]" badge when non-null |
| Customer portal deposit detail | web-public, Flutter `/account/deposits/:id` | Deposit status, linked installment | **Yes** — must show PaymentCorrection reason when linked installment has non-null `lastCorrectionId` |
| Admin installment plan view | web-admin `/dashboard/installments/:id` | Full plan with all rows | **Yes** — must surface correction history when non-null |
| Admin deposit detail | web-admin `/dashboard/deposits/:id` | Deposit row + linked correction | **Yes** — join to PaymentCorrection for full reason/actor |
| XLSX export (installment plan) | reports download | Installment rows | **Yes** — add a "Corrected" column (Y/N) driven by `lastCorrectionId` |
| `GET /me/home-summary` (me-home) | Flutter customer app | Outstanding installments count | **No** — already uses `status IN (PENDING, OVERDUE)` which is correct after correction |
| `installments-mark-overdue` cron | server | Promotes PENDING → OVERDUE | **No** — operates on `status = PENDING` and `dueDate < now()`; this is the correct forward-only flow |
| `installment-reminder` cron | server | Sends due-soon reminders | **No** — a corrected installment is a real outstanding obligation; reminders are correct |
| Financial report totals | reports service | EGP totals | **No** — totals work on `status` directly (see section 5.3) |
| Staff app installment view | Flutter mobile_staff | Customer payment overview | **Yes** — same as admin; show correction badge |

**Correction context query** (used by the "Yes" readers above):

```
// light query, only for detail views or when lastCorrectionId IS NOT NULL
SELECT pc.reason, pc.createdAt, u.fullName as performedBy
FROM PaymentCorrection pc
JOIN User u ON pc.performedById = u.id
WHERE pc.id = installment.lastCorrectionId
```

This is a point-lookup (PK), not a scan.

---

### 3.6 What happens to `paidAt` on reversal

**The question.** When a cheque bounces (Sub-case B) and the installment is
reopened from PAID to PENDING/OVERDUE, should `Installment.paidAt` be cleared?

**Decision: `Installment.paidAt` is NOT cleared.**

Clearing it would erase the fact that the installment was once marked paid —
a violation of Hard Rule 2. The `paidAt` value (e.g., the cheque's clearing date)
is historical evidence. It is reinterpreted in context:

- `status = PAID` + `paidAt = X` → paid on date X (normal)
- `status = PENDING` + `paidAt = X` + `lastCorrectionId = Y` → was paid on date X
  but subsequently reversed; see correction Y for why

Any UI that shows `paidAt` must also check `lastCorrectionId` to render it correctly
("Was paid on [date] — see correction" rather than "Paid on [date]").

**`Deposit.paidAt` is also NOT changed.** The deposit records when the instrument
was presented/submitted. The bounce is a post-presentation bank event. The deposit
row is permanent evidence that the customer presented a payment on that date.

**`Deposit.reviewStatus` on Sub-case B bounce.** The deposit remains `APPROVED` —
the admin did approve the proof; the subsequent bank reversal is a separate event.
The `PaymentInstrument.status = BOUNCED` is the signal. The `PaymentCorrection` row
is the reversal record. No mutation of the deposit's `reviewStatus` is needed.

**REASSIGNMENT:** When a deposit is reassigned to the correct installment
(`deposits:reassign`), `Deposit.installmentId` is updated (the only field changed —
this corrects a data-entry error, not a financial value). The source installment's
`paidAt` must be assessed case-by-case:
- If the source installment has another APPROVED deposit that correctly paid it: its
  `status` stays PAID, `paidAt` unchanged, `lastCorrectionId` set to the reassignment
  correction (informational — "a deposit was reassigned away but this installment
  remains correctly paid").
- If the source installment has no other APPROVED deposit: `status` reverts to PENDING,
  `paidAt` is **cleared** (set to null). Rationale: `paidAt` was only set because of
  the incorrectly attributed deposit. Removing that deposit removes the basis for
  `paidAt`. This is a data-entry correction, not a settled-record mutation — the
  `PaymentCorrection` is the evidence.

---

## 4. Contract Cancellation

### 4.1 ContractStatus states

```prisma
enum ContractStatus {
  UNSIGNED   // created, not yet signed. signedAt = null.
  ACTIVE     // signed. Normal operational state.
  CANCELLED  // cancelled — deal unwound.
}
```

Add to the `Contract` model:

```prisma
status       ContractStatus  @default(UNSIGNED)
cancelledAt  DateTime?
```

`signedAt` is preserved on cancellation — it is evidence of a signing event.

Valid transitions:
```
UNSIGNED  →  ACTIVE      POST /contracts/:id/sign    (existing)
UNSIGNED  →  CANCELLED   POST /contracts/:id/cancel  (new)
ACTIVE    →  CANCELLED   POST /contracts/:id/cancel  (new)
CANCELLED →  (terminal)
```

No RESTORE path. Reinstatement requires a new contract.

### 4.2 ContractCancellation record

Every cancellation creates one `ContractCancellation` row. Amounts are entered
by the operator; `policySnapshot` captures the setting values at cancellation time
so auditors can compare "policy at the time" with "what was actually decided"
(Rule 1).

```prisma
model ContractCancellation {
  id          String   @id @default(uuid()) @db.Uuid
  contractId  String   @unique @db.Uuid
  contract    Contract @relation(fields: [contractId], references: [id])

  cancelledById  String   @db.Uuid
  cancelledBy    User     @relation("CancellationPerformedBy", fields: [cancelledById], references: [id])

  reason  String  @db.VarChar(2000)   // MANDATORY

  cancellationDate  DateTime

  // ── Financial settlement (operator-entered; policy produces suggestion only) ─
  totalCollectedSnapshot  Decimal  @db.Decimal(14, 2)
  retainedAmount          Decimal  @db.Decimal(14, 2)
  refundAmount            Decimal  @db.Decimal(14, 2)
  financialNotes          String?  @db.VarChar(2000)

  // ── Per-transaction overrides ─────────────────────────────────────────────
  unitReleaseOverride       String?   @db.VarChar(50)
  demoteCustomerOverride    Boolean?
  commissionActionOverride  String?   @db.VarChar(20)
  bonusActionOverride       String?   @db.VarChar(20)

  // ── Policy snapshot (immutable; never recomputed from current settings) ────
  policySnapshot  Json

  // ── Unit release ─────────────────────────────────────────────────────────
  unitReleasedAt  DateTime?

  // ── Customer role ─────────────────────────────────────────────────────────
  customerDemotedAt  DateTime?

  createdAt  DateTime  @default(now())

  companyId  String?  @db.Uuid
  company    Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  refunds  Refund[]

  @@index([contractId])
  @@index([companyId])
}

model Refund {
  id                     String               @id @default(uuid()) @db.Uuid
  contractCancellationId String               @db.Uuid
  cancellation           ContractCancellation @relation(fields: [contractCancellationId], references: [id])

  amount          Decimal       @db.Decimal(14, 2)
  paymentMethod   PaymentMethod
  referenceNumber String?       @db.VarChar(100)
  bankName        String?       @db.VarChar(200)
  paidAt          DateTime
  notes           String?       @db.VarChar(2000)

  recordedById  String   @db.Uuid
  recordedBy    User     @relation("RefundRecordedBy", fields: [recordedById], references: [id])
  createdAt     DateTime @default(now())

  companyId  String?  @db.Uuid
  company    Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([contractCancellationId])
  @@index([companyId])
}
```

### 4.3 Effects on each related entity at cancellation

The `$transaction` handles atomic parts. Post-transaction steps (notifications,
etc.) run after commit.

#### Unit

Governed by `cancellation.unit.returnToAvailable` setting (default `REQUIRES_APPROVAL`),
per-transaction overridable.

**AUTO:** `unit.update({ status: AVAILABLE })` + `unitStatusHistory.create()` inside
the `$transaction`. `unitReleasedAt = now()`.

**REQUIRES_APPROVAL:** Unit stays SOLD. `unitReleasedAt = null`. A separate
`POST /contracts/:id/release-unit` endpoint (permission `contracts:release-unit`,
ADMIN-only, `@PermissionsStrict`) completes the release. Because this endpoint is
required for the REQUIRES_APPROVAL path and the default is REQUIRES_APPROVAL, this
endpoint **must ship atomically with the cancel endpoint** (step D in section 8).

#### Reservation

Linked Reservation status NOT changed. It remains `CONVERTED` — historical context,
not an active state machine.

#### InstallmentPlan and Installments

In the `$transaction`:
- `InstallmentPlan.cancelledAt = now()`
- Bulk `updateMany`: all Installments where `status IN (PENDING, OVERDUE)` → `CANCELLED`
- PAID installments stay PAID — financial history

Not configurable: there is no business reason to leave outstanding obligations
after a cancellation. The financial terms are captured in `retainedAmount` /
`refundAmount` on the ContractCancellation record.

#### Deposits

Untouched. `ContractCancellation.totalCollectedSnapshot` = sum of all APPROVED
Deposits on this contract at cancellation time, computed by the service and stored
immutably.

#### BrokerCommission

Governed by `cancellation.brokerCommission.action` setting (default `CLAWBACK`),
per-transaction overridable.

`BrokerCommissionStatus` has no `PAID` value. Commission payment is tracked via
the `payoutId → BrokerPayout.status` relation, not on the commission record itself.
A commission is "effectively disbursed" when `payoutId` is set and `payout.status`
is `PROCESSING` or `PAID`. `isCommissionEffectivelyPaid()` in the service encodes
this check.

| Commission state | CLAWBACK action | RETAIN | MANUAL |
|---|---|---|---|
| PENDING — no payout, or payout in DRAFT | `status = CANCELLED`; if in DRAFT payout: remove from payout + recompute totals (see below) | No change | No change |
| APPROVED — no payout, or payout in DRAFT | Same as PENDING | No change | No change |
| APPROVED + payout in APPROVED state | `status = CANCELLED`; `payoutId = null`; payout reverted to DRAFT (re-approval required) + totals recomputed from remaining; if 0 remaining → payout CANCELLED | No change | No change |
| APPROVED + payout in PROCESSING or PAID (effectively disbursed) | `clawbackStatus = OUTSTANDING` — see section 4.5; `status` unchanged (Hard Rule 2) | No change | No change |
| REJECTED / CANCELLED | No action (already stopped) | No action | No action |

**Payout side-effects (atomically inside `$transaction`):**

When a non-disbursed commission (payout DRAFT or APPROVED) is cancelled, the
payout must be reconciled in the same transaction to prevent disbursing a removed
commission:

1. Set `commission.payoutId = null`.
2. Aggregate remaining commissions' `grossAmount`, `taxAmount`, `withholdingAmount`,
   `netAmount` from the payout.
3. If 0 remaining: set `payout.status = CANCELLED`.
4. If ≥ 1 remaining: recompute payout totals from those aggregates; if payout was
   `APPROVED`, revert to `DRAFT` — the original approval was for a higher amount
   and must be re-issued. Payout `approvedAt` / `approvedById` are preserved as
   audit history.

If the payout was already `CANCELLED`, the commission's payoutId is set to null
but no further payout update is needed.

The commission's `status` field is never changed when a clawback overlay is applied
(Hard Rule 2).

#### BonusEntry

`BonusEntryStatus` **does** have a `PAID` value, so the clawback trigger is a direct
`status === PAID` check — no payout-relation lookup. Setting: `cancellation.salesBonus.action`
(default `CLAWBACK`). Same PAID→clawback-overlay pattern (section 4.5).

#### Customer role (CUSTOMER → CLIENT demotion)

Governed by `cancellation.customer.demoteToClient` setting (default `false`).

When applied: `user.update({ role: CLIENT })` + `refreshToken.updateMany({ revoked: true })`
in the `$transaction`. `customerDemotedAt = now()`.

Default `false`: customer retains CUSTOMER role. `customerDemotedAt` stays null.

`contract_cancelled_customer` notification always sent regardless of demotion outcome.

---

### 4.4 Per-Tenant Settings

All settings live in the `Setting` table with `companyId` scoping. Read/writable
via existing `GET/PUT /settings/:key` (ADMIN only). Never read at reporting time
for historical records — only at the moment of a new action (Rule 1).

At the moment of each action the service reads relevant settings, computes
suggestions, and returns them alongside the action's required fields. The operator's
submitted values are what is stored.

---

#### `cancellation.bookingAmount.refundPct`

| | |
|---|---|
| **Default** | `0` |
| **Type** | JSON integer |
| **Validation** | 0 ≤ n ≤ 100 |
| **Service** | `ContractCancellationService.getCancellationSuggestion()` |

What percentage of the collected booking amount is suggested as a refund. Default
0 = retain the full booking amount.

**Suggestion formula:**
```
bookingCollected  = sum(APPROVED Deposits where type = BOOKING_AMOUNT on this contract)
otherCollected    = totalCollected − bookingCollected
suggestedBookingRefund = bookingCollected × (refundPct / 100)
suggestedPenalty       = otherCollected   × (penaltyPct / 100)
suggestedRetained      = (bookingCollected − suggestedBookingRefund) + suggestedPenalty
suggestedRefund        = totalCollected − suggestedRetained
```

**Operator UX (cancellation modal):**

```
Total collected             EGP 325,000  (read-only)
  Booking amount            EGP  25,000  (read-only)
  Installments paid         EGP 300,000  (read-only)

─── Suggested settlement ─────────────────────────────
Booking refund 0%  →  EGP 0 refunded from booking
Contract penalty 10% → EGP 30,000 retained from installments
  Suggested retained    EGP  55,000
  Suggested refund      EGP 270,000

Retained amount (actual):  [  55,000 ] EGP  ← editable
Refund amount (actual):    [ 270,000 ] EGP  ← auto-updates; = total − retained
Financial notes (opt):     [                ]
```

Operator may change retained/refund freely. The suggestion is discarded.

---

#### `cancellation.contract.penaltyPct`

| | |
|---|---|
| **Default** | `10` |
| **Type** | JSON integer |
| **Validation** | 0 ≤ n ≤ 100 |
| **Service** | `ContractCancellationService.getCancellationSuggestion()` |

Percentage of non-booking collected payments to suggest as a retained penalty.
Produces `suggestedPenalty` in the formula above. Operator UX: same panel.

---

#### `cancellation.unit.returnToAvailable`

| | |
|---|---|
| **Default** | `"REQUIRES_APPROVAL"` |
| **Type** | JSON string |
| **Validation** | `"AUTO"` or `"REQUIRES_APPROVAL"` |
| **Service** | `ContractCancellationService.cancel()` |

Whether the unit is released atomically in the cancel transaction (`AUTO`) or
requires a second `POST /contracts/:id/release-unit` step.

**Operator UX:** Dropdown in cancellation modal pre-set from tenant setting;
operator can override for this transaction.

---

#### `cancellation.customer.demoteToClient`

| | |
|---|---|
| **Default** | `false` |
| **Type** | JSON boolean |
| **Validation** | `true` or `false` |
| **Service** | `ContractCancellationService.cancel()` |

**Operator UX:** Checkbox in cancellation modal, pre-checked from tenant setting.
If checked: warning "The customer will be logged out immediately."

---

#### `cancellation.brokerCommission.action`

| | |
|---|---|
| **Default** | `"CLAWBACK"` |
| **Type** | JSON string |
| **Validation** | `"CLAWBACK"`, `"RETAIN"`, or `"MANUAL"` |
| **Service** | `ContractCancellationService.cancel()` |

**Operator UX:** Dropdown in cancellation modal. If CLAWBACK and the commission
is already PAID, warning banner: "Commission #X (EGP Y) was already paid out. A
clawback receivable will be recorded." Mandatory clawback reason field appears.

---

#### `cancellation.salesBonus.action`

| | |
|---|---|
| **Default** | `"CLAWBACK"` |
| **Type** | JSON string |
| **Validation** | `"CLAWBACK"`, `"RETAIN"`, or `"MANUAL"` |
| **Service** | `ContractCancellationService.cancel()` |

Identical pattern to `brokerCommission.action`, applied to the sales `BonusEntry`.

---

#### `cheque.bounced.installmentAction`

| | |
|---|---|
| **Default** | `"REOPEN_AS_OVERDUE"` |
| **Type** | JSON string |
| **Validation** | `"REOPEN_AS_OVERDUE"` or `"REOPEN_AS_PENDING"` |
| **Service** | `ChequeLifecycleService.recordBounce()` |

Only applies to Sub-case B (installments were PAID before the bounce). `REOPEN_AS_OVERDUE`
= OVERDUE if `dueDate < now()`, else PENDING. `REOPEN_AS_PENDING` = always PENDING.

Sub-case A installments are already PENDING/OVERDUE; this setting has no effect on them.

**Operator UX:** Dropdown in bounce modal.

---

#### `cheque.bounced.penaltyAmount`

| | |
|---|---|
| **Default** | `0` |
| **Type** | JSON number (decimal) |
| **Validation** | Non-negative, max 2 decimal places |
| **Service** | `ChequeLifecycleService.recordBounce()` |

Default EGP penalty to suggest when a cheque bounces. Operator may change it.
If entered amount > 0, a `BOUNCE_PENALTY` Installment is appended to the customer's
plan. If 0, no installment is created.

**Operator UX:**

```
Bounce reason (mandatory):   [                              ]
Bounce date:                 [2026-11-05]
Penalty charge:  [ 0 ] EGP   (company default: EGP 0)
Penalty due date (if > 0):   [          ]
Installment action:  [REOPEN_AS_OVERDUE ▾]
```

---

### 4.5 Commission and Bonus Clawback for PAID Records

When cancellation action = CLAWBACK and the commission/bonus is effectively
disbursed (commission: `isCommissionEffectivelyPaid()` true; bonus: `status = PAID`),
the status is not changed (Hard Rule 2). A clawback overlay is added instead.

```prisma
enum ClawbackStatus {
  OUTSTANDING  // money owed; not yet recovered
  COLLECTED    // broker/sales returned the money
  WAIVED       // operator chose not to pursue
}

// ─── Additions to BrokerCommission model ────────────────────────────────────
// clawbackStatus       ClawbackStatus?
// clawbackReason       String?            @db.VarChar(2000)
// clawbackAt           DateTime?
// clawbackById         String?            @db.Uuid
// clawbackBy           User?              @relation("CommissionClawbackBy", ...)
// clawbackCollectedAt  DateTime?
// clawbackCollectedById String?           @db.Uuid
// clawbackWaivedAt     DateTime?
// clawbackWaivedById   String?            @db.Uuid
// @@index([clawbackStatus])

// ─── Same additions to BonusEntry model ─────────────────────────────────────
```

**Clawback state machine:**
```
(null)       →  OUTSTANDING   contract cancelled; CLAWBACK action; commission effectively disbursed
                              (BrokerCommission: payoutId set, payout.status PROCESSING or PAID;
                               BonusEntry: status = PAID)
OUTSTANDING  →  COLLECTED     admin records broker/sales returned the funds
OUTSTANDING  →  WAIVED        admin records decision not to pursue
COLLECTED    →  (terminal)
WAIVED       →  (terminal)
```

**Admin workflow:** After cancellation, a "Clawbacks" panel appears on the commission
detail page with `status = OUTSTANDING`. Admin resolves via:
- `POST /broker-commissions/:id/clawback/collect` — records amount, reference,
  payment method, date. Permission `broker-commissions:clawback:resolve`, ADMIN-only.
- `POST /broker-commissions/:id/clawback/waive` — records mandatory reason. Same
  permission.

**Reporting note:** Outstanding clawbacks are money owed to the developer. The
financial report must surface them as a receivable line (section 5.3).

---

### 4.6 Scenario Walkthroughs

These three scenarios test the design end-to-end. They list every row written or
changed, in order; what the customer, admin, and financial report see afterwards;
and where the design has gaps.

---

#### S1. Post-dated cheque covering installments 3, 4, 5 bounces — customer then pays #3 by bank transfer and issues a replacement cheque for #4 and #5

**Starting state:** Contract ACTIVE, 60 installments (EGP 50,000 each).
Inst1, Inst2: PAID. Inst3 dueDate=2026-12-01, Inst4=2027-01-01, Inst5=2027-02-01.

**Step 1 — Admin records post-dated cheque CH-001 (presented 2026-11-15, due 2027-01-05) covering installments 3, 4, 5**

*Outside transaction:*
- CREATE `PaymentInstrument` PI1: `{type:CHEQUE, chequeNumber:"CH-001", drawerBankName:"Banque Misr", chequeDueDate:"2027-01-05", status:PENDING_CLEARANCE}`
- CREATE `Deposit` D3: `{installmentId:Inst3.id, paymentInstrumentId:PI1.id, amount:50000, paidAt:"2026-11-15", reviewStatus:PENDING_REVIEW, paymentMethod:CHEQUE}`
- CREATE `Deposit` D4: same for Inst4
- CREATE `Deposit` D5: same for Inst5

Inst3, Inst4, Inst5 remain **PENDING** (clearance required; no PAID yet).

Customer portal: installments 3–5 show PENDING. Portal can show "cheque pending
clearance" label by joining Deposit → PaymentInstrument (no status change on installment).

**Step 2 — Admin marks cheque DEPOSITED (2026-12-01)**

- UPDATE PI1: `{status:DEPOSITED}`

**Step 3 — Bank returns cheque bounced (2027-01-08) — Sub-case A**

*In `$transaction`:*
1. UPDATE PI1: `{status:BOUNCED, bounceDate:"2027-01-08", bounceReason:"Insufficient funds"}`
2. UPDATE D3: `{reviewStatus:REJECTED, rejectionReason:"Cheque CH-001 returned 2027-01-08"}`
3. UPDATE D4: same
4. UPDATE D5: same
5. No `PaymentCorrection` rows (installments were never PAID)
6. No installment status changes (Inst3 was already OVERDUE from cron since 2026-12-01; Inst4, Inst5 remain PENDING)
7. Penalty: operator enters EGP 0 (default) → no BOUNCE_PENALTY installment

*Post-transaction:* `cheque_bounced` notification to customer.

*AuditLog:* `{action:"payment-instrument.bounced", entityId:PI1.id, payload:{deposits:["D3","D4","D5"], subCase:"A"}}`

Customer portal: Inst3 OVERDUE, Inst4/5 PENDING. Deposit history for each shows
D3/D4/D5 as REJECTED with reason. No confusion — installments never showed as PAID.

Admin sees: PI1 BOUNCED, D3/D4/D5 REJECTED (cleared from review queue).
Financial report: unchanged (no APPROVED deposits for these installments).

**Step 4 — Customer pays Inst3 by bank transfer (2027-01-12)**

*Outside transaction:*
- CREATE PI2: `{type:BANK_TRANSFER, bankName:"CIB", referenceNumber:"TRF-98765", status:PENDING_CLEARANCE}`
- CREATE D3b: `{installmentId:Inst3.id, paymentInstrumentId:PI2.id, amount:50000, paidAt:"2027-01-12", reviewStatus:PENDING_REVIEW, paymentMethod:BANK_TRANSFER}`

*Admin confirms reconciliation — in `$transaction`:*
- UPDATE PI2: `{status:CLEARED, clearingDate:"2027-01-12"}`
- UPDATE D3b: `{reviewStatus:APPROVED, verified:true}`
- UPDATE Inst3: `{status:PAID, paidAt:"2027-01-12"}`

Customer portal: Inst3 PAID. Deposit history for Inst3: D3 (REJECTED, bounced) + D3b (APPROVED, transfer).

**Step 5 — Replacement cheque CH-002 for installments 4, 5 (2027-01-15)**

- CREATE PI3: `{type:CHEQUE, chequeNumber:"CH-002", chequeDueDate:"2027-03-01", status:PENDING_CLEARANCE}`
- UPDATE PI1: `{status:REPLACED, replacedById:PI3.id}` (BOUNCED → REPLACED per state machine)
- CREATE D4b: `{installmentId:Inst4.id, paymentInstrumentId:PI3.id, ...PENDING_REVIEW}`
- CREATE D5b: `{installmentId:Inst5.id, paymentInstrumentId:PI3.id, ...PENDING_REVIEW}`

**Step 6 — Replacement cheque CH-002 clears (2027-03-02)**

*In `$transaction`:*
- UPDATE PI3: `{status:CLEARED, clearingDate:"2027-03-02"}`
- UPDATE D4b, D5b: `{reviewStatus:APPROVED, verified:true}`
- UPDATE Inst4, Inst5: `{status:PAID, paidAt:"2027-03-02"}`

**Final state:**
- Inst3: PAID via TRF-98765 | Inst4, Inst5: PAID via CH-002
- D3, D4, D5: REJECTED (permanent evidence of bounced CH-001)
- PI1: REPLACED (chain: PI1.replacedById = PI3.id)

Customer portal: Inst3–5 PAID. Bounce trail visible in deposit history per installment.
Admin: full instrument chain queryable. Financial report: 3 APPROVED deposits (D3b, D4b, D5b) counted.

**Design gap found and fixed:** The bounce handler in section 3.4 previously described
only a PaymentCorrection path (Sub-case B). S1 exposes Sub-case A (deposits
PENDING_REVIEW; no reversal needed; deposits set to REJECTED). Section 3.4 now
covers both explicitly.

---

#### S2. Contract cancelled after 6 of 60 installments paid; penalty retained; broker commission already PAID; unit release requires approval

**Starting state:** Contract C1 ACTIVE, signed. InstallmentPlan: 60 × EGP 50,000.
Inst1–6: PAID (Deposits D1–D6, each APPROVED). Inst7–60: PENDING.
Booking deposit DB: APPROVED, EGP 25,000.
BrokerCommission BC1: `status=APPROVED`, `payoutId` → payout with `status=PAID`, `netAmount=75,000`.
BonusEntry BE1: `status=PAID`, `amount=20,000`.
Unit U1: SOLD.
Settings: `unit.returnToAvailable=REQUIRES_APPROVAL`, all others at defaults.

**Step 1 — Admin opens cancellation modal**

Service computes:
```
totalCollected        = 25,000 (booking) + 6×50,000 = 325,000
bookingCollected      = 25,000
otherCollected        = 300,000
suggestedBookingRefund = 25,000 × 0% = 0
suggestedPenalty       = 300,000 × 10% = 30,000
suggestedRetained      = 25,000 + 30,000 = 55,000
suggestedRefund        = 325,000 − 55,000 = 270,000
```

Commission BC1 is effectively disbursed (APPROVED, attached to a PAID payout) → modal shows warning banner. Clawback reason field appears.

**Step 2 — Operator submits with overrides**

Operator enters: `retainedAmount=50,000`, `refundAmount=275,000`,
`reason="Mutual agreement — minor penalty deviation"`, clawback reason for BC1:
"Contract cancelled; commission recovery per agreement."

**Step 3 — `$transaction`**

Rows written/changed:
1. UPDATE Contract C1: `{status:CANCELLED, cancelledAt:now()}`
2. UPDATE InstallmentPlan IP1: `{cancelledAt:now()}`
3. BULK UPDATE Inst7–60 (54 rows): `{status:CANCELLED}`
4. CREATE ContractCancellation CC1: `{contractId, cancelledById, reason, cancellationDate, totalCollectedSnapshot:325000, retainedAmount:50000, refundAmount:275000, unitReleasedAt:null, customerDemotedAt:null, policySnapshot:{penaltyPct:10, bookingRefundPct:0, unitRelease:"REQUIRES_APPROVAL", demoteClient:false, commissionAction:"CLAWBACK", bonusAction:"CLAWBACK"}, commissionActionOverride:null, bonusActionOverride:null}`
5. UPDATE BrokerCommission BC1: `{clawbackStatus:OUTSTANDING, clawbackReason:"...", clawbackAt:now(), clawbackById:adminId}` (BC1.status stays APPROVED — Hard Rule 2; money was already disbursed via the PAID payout)
6. UPDATE BonusEntry BE1: `{clawbackStatus:OUTSTANDING, clawbackReason:"Contract cancelled", clawbackAt:now(), clawbackById:adminId}` (BE1.status stays PAID)
7. Unit U1: **not changed** (REQUIRES_APPROVAL path)

Rows NOT changed: Inst1–6 (remain PAID), D1–D6 (remain APPROVED), Customer role (default false).

*AuditLog row written.*

*Post-transaction:* `contract_cancelled_customer` notification to customer.

**Step 4 — Admin releases unit (separate action, after management approval)**

`POST /contracts/C1.id/release-unit`:

*In `$transaction`:*
- UPDATE Unit U1: `{status:AVAILABLE}`
- CREATE UnitStatusHistory: `{oldStatus:SOLD, newStatus:AVAILABLE, reason:"contract cancelled"}`
- UPDATE ContractCancellation CC1: `{unitReleasedAt:now()}`

**Customer portal after step 3:**
- Contract: CANCELLED
- Installments 1–6: PAID (visible payment history)
- Installments 7–60: CANCELLED (no longer outstanding obligations)
- No refund yet (recorded separately when funds move)

**Admin sees:**
- Contract CANCELLED | Unit still SOLD (until step 4)
- BC1: status=APPROVED (unchanged), clawbackStatus=OUTSTANDING (EGP 75,000 receivable)
- BE1: status=PAID, clawbackStatus=OUTSTANDING (EGP 20,000 receivable)

**Financial report:**
- `totalCollected`: unchanged (D1–D6 + DB still APPROVED)
- `totalOutstanding`: 0 for this contract (Inst7–60 are CANCELLED, excluded)
- `outstandingClawbacks`: 75,000 + 20,000 = 95,000 (new line — see section 5.3)
- `refundsOwed`: 275,000 (CC1.refundAmount) — until Refund rows record the actual transfer

**This scenario works with the current design.**

---

#### S3. Admin recorded a payment against the wrong installment; discovers it one month later, after two further installments were paid

**Starting state:**
- Inst1–4: PAID (each with one APPROVED deposit)
- Inst5: OVERDUE (dueDate passed; customer paid but admin attributed payment to Inst3)
- Inst3: PAID + has a second APPROVED Deposit Dw (`amount=50,000, installmentId=Inst3.id`)
  — this is the misattributed payment for Inst5
- Inst6: PAID (correctly, APPROVED Deposit D6)
- Inst7: PAID (correctly, APPROVED Deposit D7)

Admin notices Inst5 is OVERDUE. Investigation reveals Dw was recorded against Inst3
(which was already paid by its original deposit DA3). Dw should have been recorded
against Inst5.

**Step 1 — Admin uses `deposits:reassign`**

Request: `{depositId:Dw, sourceInstallmentId:Inst3, targetInstallmentId:Inst5, reason:"Month 5 payment (ref TRF-45678) incorrectly attributed to installment 3; bank statement confirms installment 5 payment date"}`

*In `$transaction`:*
1. CREATE PaymentCorrection PC1: `{type:REASSIGNMENT, depositId:Dw, sourceInstallmentId:Inst3.id, targetInstallmentId:Inst5.id, reason:"...", performedById:adminId}`
2. UPDATE Dw: `{installmentId:Inst5.id}` (data-entry correction; amount/reviewStatus/paidAt unchanged)
3. Evaluate Inst3:
   - Inst3 has DA3 (original correct deposit, APPROVED) — still PAID ✓
   - UPDATE Inst3: `{lastCorrectionId:PC1.id}` (informational: a deposit was reassigned away; status unchanged)
   - Inst3.paidAt: **not cleared** (DA3 still correctly pays Inst3)
4. Evaluate Inst5:
   - Was OVERDUE; Dw is now its deposit
   - UPDATE Inst5: `{status:PAID, paidAt:Dw.paidAt, lastCorrectionId:PC1.id}`

*AuditLog:* `{action:"deposit.reassigned", entityType:"Deposit", entityId:Dw.id, before:{installmentId:Inst3.id}, after:{installmentId:Inst5.id}, payload:{correctionId:PC1.id}}`

**Customer portal after:**
- Inst3: PAID (unchanged; correction badge shown — "a deposit was reassigned from this installment")
- Inst5: PAID (was OVERDUE; correction badge: "payment reassigned from installment 3")
- Inst6, Inst7: PAID (unchanged)

**Admin sees:** PC1 in correction log; Dw deposit now linked to Inst5.

**Financial report:**
- totalPaid: unchanged (same APPROVED deposits, same amounts)
- totalOverdue: Inst5 was OVERDUE → now PAID; overdue total decreases by EGP 50,000
- No money moved; attribution corrected

**Constraint on REASSIGNMENT:** A REASSIGNMENT is only valid for deposits where
`reviewStatus = APPROVED`. A PENDING_REVIEW deposit cannot be reassigned —
it should be soft-deleted and re-entered. Add this guard to the `deposits:reassign`
endpoint.

**This scenario works with the current design** — the REASSIGNMENT correctly handles
the case where the source installment remains PAID (via another deposit). The key
nuance is that Inst3.status is not changed because it still has its original deposit.

---

## 5. Closing the Existing Inconsistencies

### 5.1 FG-05 and FG-06 — one fix

FG-05 (installment PAID is irreversible via API) and FG-06 (`verify(false)` leaves
the installment PAID) are both closed by the `PaymentCorrection` model.

**Process for any reversal (Sub-case B bounce or manual `deposits:reverse` call):**

In a single `$transaction`:
1. Write `PaymentCorrection` (REVERSAL) — immutable evidence row
2. Update `Installment.status` to PENDING or OVERDUE (Sub-case B: per
   `installmentAction` setting; manual admin reversal: always PENDING)
3. `Installment.paidAt` NOT cleared (section 3.6)
4. `Installment.lastCorrectionId = PaymentCorrection.id`

**FG-06 specifically:** `verify(false)` on an APPROVED deposit is augmented to call
this reversal path, producing a `PaymentCorrection` row and updating
`Installment.status` to PENDING. The existing `reviewStatus` / `verified` reset is
preserved. The inconsistency (deposit "pending review" but installment "paid") is closed.

**OQ-1 — resolved.** `cheque.bounced.installmentAction` decides whether the
reopened installment is PENDING or OVERDUE at bounce time. The overdue cron only
promotes PENDING → OVERDUE for installments that are past their due date —
the correct forward-only flow, unchanged.

### 5.2 Booking-payment dual-path collision (FG section 6.4)

**Minimal fix:** Guard `confirmBookingPayment()`:

```typescript
if (reservation.bookingPaymentStatus === ReservationBookingPaymentStatus.PENDING) {
  throw new ConflictException(
    'A customer payment proof is under review. Resolve it before confirming manually.'
  );
}
```

`unconfirmBookingPayment()` must NOT delete deposits where `proofDocumentId` is set
(customer-submitted proof). Add this guard to prevent the orphaned-document scenario.

### 5.3 Reporting correctness

The existing `reports.service.ts` builds financial totals from `Installment.status`
and `Deposit` queries. The following queries become wrong or incomplete once
corrections, bounced instruments, and cancelled contracts exist.

---

**Query 1 — Total outstanding / overdue (BREAKS)**

Current pattern (likely):
```sql
SUM(amount) WHERE status NOT IN ('PAID')
-- or:
SUM(amount) WHERE status = 'PENDING'
SUM(amount) WHERE status = 'OVERDUE'
```

With new `InstallmentStatus.CANCELLED`, the `NOT IN ('PAID')` variant incorrectly
includes CANCELLED installments. The `IN ('PENDING', 'OVERDUE')` variant is correct
as written — CANCELLED rows are simply never matched.

**Fix:** Change any `status NOT IN ('PAID')` in outstanding/overdue totals to
`status IN ('PENDING', 'OVERDUE')`.

---

**Query 2 — Total collected (safe as-is if deposit-based)**

If `totalCollected` is `SUM(Deposit.amount WHERE reviewStatus = 'APPROVED' AND deletedAt IS NULL)`:
- REJECTED deposits (bounced, pre-clearance) are excluded ✓
- REASSIGNED deposits still have `reviewStatus = APPROVED` and their amounts are counted once ✓
- No query change needed.

If `totalCollected` is `SUM(Installment.amount WHERE status = 'PAID')`:
- Also correct: Sub-case B reversals move the installment back to PENDING/OVERDUE; it no longer contributes ✓
- No query change needed.

---

**Query 3 — Refunds owed (NEW — doesn't exist yet)**

```sql
-- Refunds promised but not yet transferred:
SELECT SUM(cc.refundAmount) - COALESCE(SUM(r.amount), 0) AS refundsStillOwed
FROM ContractCancellation cc
JOIN Contract c ON c.id = cc.contractId
LEFT JOIN Refund r ON r.contractCancellationId = cc.id
WHERE c.status = 'CANCELLED'
```

---

**Query 4 — Outstanding clawbacks (NEW — doesn't exist yet)**

```sql
SELECT SUM(netAmount) FROM BrokerCommission WHERE clawbackStatus = 'OUTSTANDING'
UNION ALL
SELECT SUM(amount) FROM BonusEntry WHERE clawbackStatus = 'OUTSTANDING'
```

Surface as a single "Receivables from clawbacks" line on the financial report.

---

**Query 5 — XLSX installment plan export (BREAKS)**

Current: exports all installments for a plan. After cancellation, plans have
CANCELLED rows that must not appear as active obligations.

**Fix:** Filter `WHERE status IN ('PENDING', 'OVERDUE', 'PAID')` (exclude CANCELLED).
Or include CANCELLED rows with a "Cancelled" label so auditors see the full plan.

---

**Query 6 — Deposit review queue (safe as-is)**

The review queue filters `reviewStatus = PENDING_REVIEW`. Sub-case A bounce
sets those deposits to `REJECTED` (cleared from queue). No query change needed.

---

**Query 7 — Deposit creation guard (BREAKS — found during D1 implementation)**

`deposits.service.ts:212` — the atomic `updateMany` that marks an installment
PAID before creating the deposit row used `status: { not: PAID }`. With
`InstallmentStatus.CANCELLED` this guard no longer excludes CANCELLED installments,
allowing a deposit to be recorded against a cancelled installment and wrongly
transitioning it back to PAID.

This is a **financial correctness bug**, not a filter tidy-up: a CANCELLED
installment that becomes PAID is counted as collected revenue even though the
underlying contract has been cancelled.

**Fix:** `deposits.service.ts:212` — change `status: { not: InstallmentStatus.PAID }`
to `status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] }`.
Applied in Step D1. Covered by D1-REG-4 (`test/security/08-d1-regression.security-spec.ts`).

---

**Summary of report service changes required:**

| Change | Breaking? | Must fix before go-live? |
|---|---|---|
| Replace `status NOT IN ('PAID')` with `status IN ('PENDING', 'OVERDUE')` | Yes — CANCELLED rows inflate outstanding total | **Yes** (lands with step D which adds the enum value) |
| Fix deposit creation guard (`deposits.service.ts:212`) | Yes — allows deposit against CANCELLED installment | **Yes** (lands with step D1; found during implementation) |
| Add refunds-owed query | No — new line | No (additive) |
| Add outstanding clawbacks query | No — new line | No (additive) |
| Fix XLSX export to exclude/label CANCELLED installments | Yes — misleading export | **Yes** (lands with step D) |

---

## 6. Authorization & Audit

Every corrective action moves money or changes ownership. SALES is excluded from
all corrective actions — this is a hard rule, not configurable.

### 6.1 New permission codes

| Code | Action |
|---|---|
| `payment-instruments:manage` | Create/update PaymentInstrument records |
| `payment-instruments:bounce` | Record a cheque bounce |
| `deposits:reverse` | Write a PaymentCorrection REVERSAL |
| `deposits:reassign` | Write a PaymentCorrection REASSIGNMENT |
| `contracts:cancel` | Cancel a contract (UNSIGNED or ACTIVE) |
| `contracts:release-unit` | Release unit (REQUIRES_APPROVAL path) |
| `broker-commissions:clawback:resolve` | Collect or waive an outstanding clawback |
| `bonus:clawback:resolve` | Collect or waive an outstanding bonus clawback |
| `info-requests:manage` | Advance InfoRequest status |
| `refunds:record` | Record a Refund against a ContractCancellation |

### 6.2 Per-operation requirements

| Operation | Roles | Permission | @PermissionsStrict | Reason mandatory | Notes |
|---|---|---|---|---|---|
| Create PaymentInstrument | ADMIN, SALES_MANAGER | `payment-instruments:manage` | No | No | Routine |
| Record cheque bounce | ADMIN | `payment-instruments:bounce` | **Yes** | **Yes** | |
| Reverse a deposit | ADMIN | `deposits:reverse` | **Yes** | **Yes** | SALES excluded |
| Reassign a deposit | ADMIN | `deposits:reassign` | **Yes** | **Yes** | SALES excluded; APPROVED deposits only |
| Cancel contract (UNSIGNED) | ADMIN | `contracts:cancel` | **Yes** | **Yes** | |
| Cancel contract (ACTIVE) | ADMIN | `contracts:cancel` | **Yes** | **Yes** | Highest-risk |
| Release unit after cancel | ADMIN | `contracts:release-unit` | **Yes** | No | |
| Record refund | ADMIN | `refunds:record` | **Yes** | No | Reference number serves as record |
| Commission clawback resolve | ADMIN | `broker-commissions:clawback:resolve` | **Yes** | **Yes** | |
| Bonus clawback resolve | ADMIN | `bonus:clawback:resolve` | **Yes** | **Yes** | |
| Advance InfoRequest status | ADMIN, SALES_MANAGER | `info-requests:manage` | No | No | |

### 6.3 AuditLog entry structure

**Deposit reversal (Sub-case B or manual):**
```json
{
  "action": "deposit.reversed",
  "entityType": "Deposit",
  "entityId": "<depositId>",
  "before": { "reviewStatus": "APPROVED", "verified": true, "amount": 50000 },
  "after": {
    "correctionId": "<correctionId>",
    "correctionType": "REVERSAL",
    "affectedInstallmentId": "<id>",
    "installmentPreviousStatus": "PAID",
    "installmentNewStatus": "OVERDUE",
    "installmentPaidAtPreserved": "2027-01-08",
    "reason": "..."
  }
}
```

**Deposit reassignment:**
```json
{
  "action": "deposit.reassigned",
  "entityType": "Deposit",
  "entityId": "<depositId>",
  "before": { "installmentId": "<sourceId>" },
  "after": { "installmentId": "<targetId>", "correctionId": "<id>", "reason": "..." }
}
```

**Contract cancellation:**
```json
{
  "action": "contract.cancelled",
  "entityType": "Contract",
  "entityId": "<contractId>",
  "before": { "status": "ACTIVE", "signedAt": "2026-09-01T...", "totalAmount": 2500000 },
  "after": {
    "status": "CANCELLED",
    "cancellationId": "<id>",
    "unitId": "<id>",
    "unitReleaseMode": "REQUIRES_APPROVAL",
    "customerId": "<id>",
    "customerDemoted": false,
    "totalCollectedSnapshot": 325000,
    "retainedAmount": 50000,
    "refundAmount": 275000,
    "cancelledInstallmentsCount": 54,
    "commissionAction": "CLAWBACK",
    "commissionClawbackIds": ["<bc1>"],
    "bonusAction": "CLAWBACK",
    "bonusClawbackIds": ["<be1>"],
    "policySnapshot": { "penaltyPct": 10, "bookingRefundPct": 0, "unitRelease": "REQUIRES_APPROVAL", "demoteClient": false },
    "reason": "..."
  }
}
```

**Cheque bounce (Sub-case A):**
```json
{
  "action": "payment-instrument.bounced",
  "entityType": "PaymentInstrument",
  "entityId": "<id>",
  "before": { "status": "DEPOSITED" },
  "after": {
    "status": "BOUNCED",
    "bounceDate": "...",
    "bounceReason": "...",
    "subCase": "A",
    "affectedDepositIds": ["D3", "D4", "D5"],
    "depositsSetToRejected": ["D3", "D4", "D5"],
    "correctionRowsWritten": 0,
    "penaltyInstallmentId": null
  }
}
```

---

## 7. Authorization & Audit (renumbered: was §6, §7 is now Migration)

*(Sections 6 and 7 were renumbered in rev 3 to accommodate the new scenario section 4.6 and reporting section 5.3. Authorization & Audit content is above.)*

---

## 8. Migration & Sequencing

No live customers exist yet. The rule: anything that prevents a correct record from
being created for the first real customer must land before go-live.

### 8.1 Must land before first signed contract

| Step | Change | Effort | Test that proves it |
|---|---|---|---|
| **A** | Add `PaymentInstrument` model + optional FK + `lastCorrectionId` on Installment + indexes. | S | Unit: Deposit linked to PI; PI FK resolves; `lastCorrectionId` nullable on Installment. |
| **B** | Implement cheque lifecycle transitions. `ChequeLifecycleService`. Add Sub-case A bounce path (PENDING_REVIEW deposits → REJECTED; no PaymentCorrection; installments unchanged). | M | Unit: Sub-case A: bounce sets deposits to REJECTED, installments unchanged. Invalid transitions throw. |
| **C** | Add `PaymentCorrection` model. Implement `deposits:reverse` (Sub-case B). Add Sub-case B to bounce handler (APPROVED deposits: write correction, update installment status, preserve paidAt, set lastCorrectionId). Update `verify(false)` to call same path. Add `BOUNCE_PENALTY` to PlanPaymentType enum. | M | Unit: Sub-case B: bounce writes PaymentCorrection, installment flips to PENDING/OVERDUE with lastCorrectionId set, paidAt preserved. FG-06: verify(false) on APPROVED deposit writes correction, installment moves to PENDING. |
| **D** | Add `ContractStatus` enum + `status`/`cancelledAt` to Contract. Add `InstallmentStatus.CANCELLED`. Add `ContractCancellation` + `Refund` + `ClawbackStatus` enum + clawback fields on `BrokerCommission`/`BonusEntry`. Implement `contracts:cancel` **and** `contracts:release-unit` (both ship together). Fix report queries: `status NOT IN ('PAID')` → `status IN ('PENDING', 'OVERDUE')`; fix XLSX export to exclude CANCELLED. | L | Unit: cancel ACTIVE contract; unit stays SOLD (REQUIRES_APPROVAL path); 54 PENDING installments → CANCELLED; PAID installments unchanged; BC1 clawback overlay written; CC1 policySnapshot present. Separate test: release-unit endpoint flips unit to AVAILABLE, sets unitReleasedAt. Report test: CANCELLED installments not counted in outstanding total. XLSX test: CANCELLED rows absent from obligations view. |
| **E** | Seed all 8 Settings with defaults for each existing company. Must ship with D (cancellation service reads settings). | S | Seed test: each company has all 8 keys with correct defaults. |
| **F** | Add `paymentMethod` to `RecordDepositDto` (admin path). Closes FG-08. | S | Unit: POST /deposits with paymentMethod=CHEQUE; field is set. |
| **G** | Guard `confirmBookingPayment()` against PENDING status. Guard `unconfirmBookingPayment()` against customer-proof deposits. | S | Unit: confirm while PENDING_REVIEW → 409. Unconfirm does not delete customer deposits. |

**Why `contracts:release-unit` moved into step D (was K in rev 2):** The default
for `cancellation.unit.returnToAvailable` is `REQUIRES_APPROVAL`. If the cancel
endpoint ships without the release endpoint, every cancellation leaves the unit
permanently SOLD with no recovery path. The two endpoints are inseparable.

### 8.2 Can be additive after first customer

| Step | Change | Effort | Test that proves it |
|---|---|---|---|
| **H** | `deposits:reassign` (PaymentCorrection REASSIGNMENT). Guard: APPROVED deposits only. | S | Unit: deposit moved; source installment corrected; target installment PAID with original paidAt; lastCorrectionId on both. |
| **I** | `PATCH /info-requests/:id` to advance status. Closes FG-04. | S | Unit: OPEN → RESPONDED → CLOSED; invalid transitions rejected. |
| **J** | `payment_proof_approved` / `payment_proof_rejected` added to `EMAIL_ELIGIBLE_TEMPLATES`. Closes FG-07. | S | Integration: approve proof; notification flagged email-eligible. |
| **K** | `paymentMethod` on admin booking-confirmation path. | S | Unit: confirmBookingPayment stores paymentMethod on the created Deposit. |
| **L** | `broker-commissions:clawback:resolve` + `bonus:clawback:resolve` (collect / waive). Must land before first commission payout cycle after go-live. Three new columns on both models: `clawbackCollectedAmount`, `clawbackCollectedReference`, `clawbackCollectedPaymentMethod`. Plus `clawbackWaiveReason` (separate from `clawbackReason`). New `ClawbackStatus.PARTIALLY_COLLECTED` value for partial recovery. | M | Unit: OUTSTANDING → COLLECTED (full amount); commission.status unchanged (still APPROVED; BrokerCommissionStatus has no PAID value — see §D4 design note). bonusEntry.status unchanged (still PAID). Partial repayment → PARTIALLY_COLLECTED, NOT COLLECTED. OUTSTANDING → WAIVED: waiveReason stored separately from cancellation clawbackReason. COLLECTED/WAIVED row → 409 on second resolve. clawbackStatus null → 409. Cross-tenant: 404. Atomicity: rollback leaves nothing changed. |
| **M** | Refunds-owed + outstanding-clawbacks lines added to financial report. | S | Unit: report with a cancelled contract shows correct refundsOwed and clawback receivable totals. |

### 8.3 Dependency order

```
A (PaymentInstrument + lastCorrectionId on Installment)
  └─ B (Sub-case A bounce path)
  └─ C (Sub-case B bounce + PaymentCorrection + verify(false) fix)

D (ContractStatus + cancel workflow + release-unit + report query fixes)
E (seed settings — atomic with D)
F (RecordDepositDto.paymentMethod)     — independent; ~1 day
G (dual-path collision guards)         — independent; ~hours
─── go-live gate ───
H–M  (additive; L must land before first payout cycle)
```

---

## Open Questions

### OQ-1 ~~Should `REVERSED` installments suppress the OVERDUE cron?~~ — RESOLVED

The `cheque.bounced.installmentAction` setting writes the correct status at bounce
time. The overdue cron only promotes PENDING → OVERDUE, which is the correct
forward-only path. No cron patching needed.

---

### OQ-2: What happens to an UNSIGNED contract when it is cancelled?

Should cancellation of an UNSIGNED contract (no money moved, `signedAt = null`)
require the same `ContractCancellation` record and financial fields?

**Recommended default:** Yes — apply the same record. Financial fields default to
zero; the operator can enter non-zero values if a booking amount was paid before
signing. Consistent audit trail, minimal overhead.

---

### OQ-3: Should a cancelled contract be restorable?

**Recommended default:** Keep CANCELLED terminal. Reinstatement is a new business
event and should produce a new contract number. If contract-number continuity is
required (court filings), the new contract could carry an `originalContractNumber`
field — but not speculatively.

---

### OQ-4: Is there a formal `cheque_bounced` notification template needed?

**Recommended default:** Yes — add `cheque_bounced` (PUSH + EMAIL-eligible), distinct
from `payment_proof_rejected`. Body states cheque number, bounce date, any penalty
amount, instructs customer to contact sales. Seed inactive; operator activates once
they confirm it meets their legal disclosure requirements.

---

## Design assumptions that did not survive contact with the schema

These four discrepancies were found during implementation — not review — because the
design was written against an assumed schema that was never built exactly as assumed.
All four are corrected in the implementation; they are recorded here so D4 and later
steps are not written against the same wrong assumptions.

---

### 1. `AuditLog` has no `payload` field

**Assumed:** `AuditLog` has three JSON columns — `before`, `after`, and `payload` — where
audit metadata (correctionId, affectedInstallmentIds, policySnapshot, etc.) lives in `payload`.
§6.3 showed four audit examples with a three-field structure.

**Reality:** `AuditLog` has only `before` and `after`. There is no `payload` column.
Confirmed by schema inspection and by reading live rows written by the Step B/C/D3 services.

**Resolution:** All fields previously shown under `payload` were merged into `after`.
§6.3 was corrected in rev 4 (Appendix C-22). All services write to `before`/`after` only.

---

### 2. `BrokerCommissionStatus` has no `PAID` value

**Assumed:** The enum is `PENDING | APPROVED | REJECTED | CANCELLED | PAID`. The design
used `PAID` as a commission status throughout §4.3 and §4.6 S2 to mean "money was sent."

**Reality:** The actual enum is `PENDING | APPROVED | REJECTED | CANCELLED`. There is no
`PAID` value. Commission payment is tracked via the `payoutId → BrokerPayout.status` relation.
A "paid" commission is one with `payoutId IS NOT NULL AND payout.status IN ('PROCESSING', 'PAID')`.

**Resolution:** Introduced `isCommissionEffectivelyPaid()` in D3 to identify disbursed
commissions via the payout relation. §4.3 table and §4.6 S2 corrected in rev 4 (C-19, C-20, C-21).

*Note for D4:* The clawback resolve endpoint guards against `clawbackStatus = OUTSTANDING`,
not against `commission.status = PAID` (which cannot exist). §8.2 step L's phrase
"commission.status unchanged (still PAID)" is wrong — the status is `APPROVED` and stays `APPROVED`.

---

### 3. S2's BC1 state was unrepresentable as written

**Assumed:** S2 walkthrough started with `BC1: status=PAID` (before correction). This starting
state cannot exist — `BrokerCommissionStatus` has no `PAID` value — so the scenario could
not be seeded as written.

**Reality:** The equivalent state is `BC1: status=APPROVED, payoutId → BrokerPayout{status:PAID}`.
This is what `isCommissionEffectivelyPaid()` correctly identifies as effectively disbursed.

**Resolution:** The D3-9e and D3-10c security tests seed BC1 as `APPROVED` with a payout
whose status is `PROCESSING` or `PAID`. §4.6 S2 corrected in rev 4 (C-21).

---

### 4. `CLAWBACK` path depends on payout status, not commission status alone

**Assumed (implicit):** Commission status alone (`PENDING` → cancel; `PAID` → overlay) determines
the CLAWBACK action. No additional payout-status dimension was modelled.

**Reality:** There are five meaningful states:
1. PENDING, no payout → cancel
2. APPROVED, no payout or DRAFT payout → cancel (+ remove from payout, recompute totals)
3. APPROVED + APPROVED payout → cancel commission, revert payout to DRAFT or CANCELLED if empty
4. APPROVED + PROCESSING or PAID payout → overlay (Hard Rule 2; money in flight or confirmed)
5. REJECTED / CANCELLED → no action

Case 3 is the critical gap: an APPROVED payout has authorised payment but money has not left.
Treating it as "effectively paid" creates a phantom clawback receivable. Treating it as
"not paid" (and cancelling the commission) requires atomically recomputing the payout totals
and reverting the payout to DRAFT for re-approval.

**Resolution:** D3b landed both the narrowing of `isCommissionEffectivelyPaid()` to
`PROCESSING|PAID` and the payout side-effects (aggregate remaining commissions →
DRAFT or CANCELLED) atomically in the same `$transaction`. §4.3 updated in rev 5 (C-23).

---

## Appendix — Conflict Log

Changes from each revision are recorded here for traceability.

### Rev 2 changes (from rev 1)

| # | Location in rev 1 | Prior value | New value | Reason |
|---|---|---|---|---|
| C-1 | §4.3 Unit default | `auto` | `REQUIRES_APPROVAL` | Owner specified |
| C-2 | §4.3 Customer role default | `if_no_other_active_contract` | `false` | Owner specified |
| C-3 | §4.3 BrokerCommission default | `manual` | `CLAWBACK` | Owner specified |
| C-4 | §4.3 BonusEntry default | `manual` | `CLAWBACK` | Owner specified |
| C-5 | §4.3 BrokerCommission narrative | "system never automatically changes" | Automatically cancels PENDING/APPROVED; clawback overlay for PAID | Required by Hard Rule 2 + CLAWBACK default |
| C-6 | §5.1 `computeInstallmentStatus()` | Pure derived-state function returning `REVERSED` display state | Eliminated; bounce handler writes PENDING/OVERDUE directly | `installmentAction` setting makes the decision at write time |
| C-7 | §2.3 costs | "all read endpoints must use computedStatus()" | No extra join on normal read paths | Consequence of C-6 |
| C-8 | §3.4 BOUNCED transition | "installment status re-derived" (implicit) | Explicitly writes PENDING/OVERDUE in transaction | Formalized by installmentAction setting |
| C-9 | OQ-1 | Undecidable | Resolved by `installmentAction` setting | Owner provided the answer |

### Rev 3 changes (from rev 2)

| # | Location in rev 2 | Prior statement | New statement / addition | Reason |
|---|---|---|---|---|
| C-10 | §3.4 BOUNCED transition | Single bounce path described; assumed APPROVED deposits | Two explicit sub-cases: Sub-case A (PENDING_REVIEW → REJECTED; no PaymentCorrection) and Sub-case B (APPROVED → PaymentCorrection REVERSAL) | S1 walkthrough exposed that post-dated cheques bounce before clearance — the common Egyptian market case. The prior design was incomplete. |
| C-11 | §3.2 schema | No `lastCorrectionId` on Installment | Added `lastCorrectionId` nullable FK to Installment | Without it, a PENDING installment after a Sub-case B reversal is indistinguishable from a never-paid PENDING installment for any reader that doesn't join PaymentCorrection |
| C-12 | §2.3 costs | "customer portal must handle REVERSED state" | Removed REVERSED display state; `lastCorrectionId` IS NOT NULL is the signal; correction context fetched only in detail views | Consequence of C-6 being formalized; the clean solution is a row-level marker not a derived status |
| C-13 | §3 (new §3.5) | Not present | Added complete traceability section: all read paths, which ones must check `lastCorrectionId`, and the correction context query | Review question 1 |
| C-14 | §3 (new §3.6) | Not present | Explicit policy: `Installment.paidAt` NOT cleared on Sub-case B reversal; `Deposit.paidAt` NOT changed; REASSIGNMENT clears `paidAt` only when source installment has no other covering deposit | Review question 2 |
| C-15 | §4 (new §4.6) | Not present | Three end-to-end scenario walkthroughs (S1, S2, S3) with every row in order | Review question 3; also exposed C-10 |
| C-16 | §5 (new §5.3) | Not present | Reporting correctness: identified two breaking queries (`NOT IN ('PAID')` and XLSX export), two new needed queries (refunds owed, outstanding clawbacks) | Review question 4 |
| C-17 | §7 (now §8) step K | K in post-go-live additive list | Merged K into step D (must ship with cancel endpoint) | `contracts:release-unit` is required when default is REQUIRES_APPROVAL; shipping cancel without release leaves no recovery path for the unit |
| C-18 | §8.1 step D | Not in original step | Added report query fixes (`status NOT IN ('PAID')` → `status IN ('PENDING', 'OVERDUE')`, XLSX) to step D | These queries break the moment `InstallmentStatus.CANCELLED` is introduced; must ship together |

### Rev 4 changes (from rev 3)

> **Date:** 2026-09-16 (rev 4: schema-accuracy pass — BrokerCommissionStatus enum
> has no PAID value; §6.3 AuditLog has no payload column)

| # | Location in rev 3 | Prior statement | New statement / addition | Reason |
|---|---|---|---|---|
| C-19 | §4.3 BrokerCommission table | Four-row table using `PAID` as a `BrokerCommissionStatus` value; single "APPROVED → CANCELLED" row | Replaced with five-row table distinguishing APPROVED-with-no-paid-payout (→ CANCELLED) from APPROVED-with-payout-PROCESSING/PAID (→ clawback overlay); added explicit note that `BrokerCommissionStatus` has no `PAID` value and that disbursement is tracked via `payoutId → BrokerPayout.status` | `BrokerCommissionStatus` enum is PENDING/APPROVED/REJECTED/CANCELLED — no PAID. The design was written against a schema that was never implemented. Service uses `isCommissionEffectivelyPaid()` to identify disbursed commissions via the payout relation. |
| C-20 | §4.5 clawback state machine | "commission was PAID" | "commission effectively disbursed (BrokerCommission: payoutId set, payout.status PROCESSING or PAID; BonusEntry: status = PAID)" | Removes the impossible `BrokerCommissionStatus.PAID` reference; `BonusEntryStatus` does have PAID so that branch is kept as-is |
| C-21 | §4.6 S2 starting state + step 3 + admin view | `BC1: status=PAID` in three places | `BC1: status=APPROVED, payoutId → payout with status=PAID` | `BrokerCommissionStatus` has no PAID. The S2 fixture seeds BC1 as APPROVED with a paid payout, which is what `isCommissionEffectivelyPaid()` identifies as effectively disbursed. |
| C-22 | §6.3 AuditLog entries (all four examples) | Three-field structure: `before`, `after`, `payload` | Two-field structure: `before`, `after` — all fields previously shown under `payload` moved into `after` | `AuditLog` schema has no `payload` column. Confirmed by schema inspection and by reading live DB rows written by the Step B/C/D3 services. |

### Rev 5 changes (from rev 4)

> **Date:** 2026-09-17 (rev 5: payout dimension — CLAWBACK on APPROVED payout commission
> requires atomic payout side-effects; narrowed `isCommissionEffectivelyPaid()`)

| # | Location in rev 4 | Prior statement | New statement / addition | Reason |
|---|---|---|---|---|
| C-23 | §4.3 BrokerCommission table + narrative | Four-row table with no payout-status dimension beyond "effectively disbursed"; `isCommissionEffectivelyPaid()` checked APPROVED\|PROCESSING\|PAID payout | Five-row table adding explicit `APPROVED payout` row with payout side-effects (remove from payout, recompute totals, revert to DRAFT or CANCELLED); `isCommissionEffectivelyPaid()` narrowed to PROCESSING\|PAID; added payout side-effects narrative | An APPROVED payout has not yet disbursed money; treating it as "effectively paid" creates a phantom clawback receivable. Narrowing alone creates a money-loss path (cancelled commission amount stays in APPROVED payout totals). Both changes must land atomically. BonusEntry has no equivalent payout batching model — no change needed there. |

### Rev 6 changes (from rev 5)

> **Date:** 2026-09-17 (rev 6: D4 three decisions — §8.2 step L text corrected; PARTIALLY_COLLECTED; separate waive-reason column)

| # | Location in rev 5 | Prior statement | New statement / addition | Reason |
|---|---|---|---|---|
| C-24 | §8.2 step L test note | "commission.status unchanged (still PAID)" | "commission.status unchanged (still APPROVED); bonusEntry.status unchanged (still PAID)" | `BrokerCommissionStatus` has no `PAID` value (established in C-19/C-20). A commission on the clawback path is `APPROVED` with a `PROCESSING` or `PAID` payout. The step L text repeated the same wrong assumption that was corrected in rev 4 for §4.3 and §4.5. |
| C-25 | §4.5 clawback state machine + §8.2 step L schema note | No partial-recovery state; schema had only OUTSTANDING/COLLECTED/WAIVED | Added `PARTIALLY_COLLECTED` to `ClawbackStatus` enum; added `clawbackCollectedAmount`, `clawbackCollectedReference`, `clawbackCollectedPaymentMethod` columns on both `BrokerCommission` and `BonusEntry` | A broker returning 50,000 of a 75,000 commission is a distinct, reportable state. Leaving `clawbackStatus = OUTSTANDING` with a partial amount would cause the outstanding-clawbacks report query (`WHERE clawbackStatus = 'OUTSTANDING'`) to overstate receivables by the already-recovered amount — the same class of reporting error the LEDGER design exists to prevent. The three new columns record the financial detail of each collection. `PARTIALLY_COLLECTED` rows are included in the outstanding-receivables aggregate with balance = `commission.netAmount - clawbackCollectedAmount`. A second `collect` call accumulates the amount and re-evaluates. |
| C-26 | §4.5 clawback overlay schema note | `clawbackReason` described as covering both the cancellation reason and future waive reason | Added `clawbackWaiveReason String? @db.VarChar(2000)` to both models; waive endpoint requires it; stored separately from `clawbackReason` (the cancellation reason) | `clawbackReason` is set at contract cancellation time to record why the clawback was created. Waiving a receivable is a distinct, later financial decision — forcing both reasons into the same column conflates two different actors, two different moments, and two different justifications. A dispute auditor must be able to read both independently. |
