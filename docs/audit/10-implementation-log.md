# 10 — Reversal Layer Implementation Log

> **Source design:** `09-reversal-design.md`
> **Convention:** one entry per step, opened when work starts, closed when green.
> Format: `Step | Date | Files changed | Migration | Test delta | Status`

### Verification rule (adopted 2026-09-15)

No number in this document is claimed as measured unless it was produced by a
command actually run at that commit.  Projected counts are never written as if
they were measurements.

**Methodology for historical unit counts:** checked out each step's final commit
and ran `npx jest --runInBand --silent | grep "^Tests:"`.  Steps A–C show a
small number of spurious failures (3–5) in `MT-013 MODEL_TENANCY boot assertion`
when run against today's Prisma client, because the installed client now contains
models added in later steps (ContractCancellation, Refund).  Those tests passed
at commit time when the generated client matched the schema.  The *total* count
(pass + fail) from the re-run is therefore the best proxy for the original count.

**Steps A–C unit counts**: recorded at commit time; re-running today produces the
same total but 3–5 schema-drift failures in MT-013.  Marked "recorded at commit
time" rather than UNVERIFIED, because the totals match and the mechanism is
understood.

**Security suite counts (Steps A–D1)**: not re-verified — security tests require
the live database to be at a specific migration state; re-running at older commits
would require rolling back the applied migrations.  Marked UNVERIFIED.  D2
security count (163) is directly verified at HEAD.

---

## Step A — PaymentInstrument schema + plumbing

**Date:** 2026-09-14
**Design ref:** `09-reversal-design.md` §3.2, §3.5, §3.6, §8.1 step A
**Status:** DONE ✓

### Migration

`20260914055009_step_a_payment_instrument` — purely additive:

```sql
CREATE TYPE "PaymentInstrumentType" AS ENUM ('BANK_TRANSFER', 'CHEQUE');
CREATE TYPE "PaymentInstrumentStatus" AS ENUM ('PENDING_CLEARANCE', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'REPLACED', 'CANCELLED');
ALTER TABLE "Deposit"      ADD COLUMN "paymentInstrumentId" UUID;
ALTER TABLE "Installment"  ADD COLUMN "lastCorrectionId"    UUID;
CREATE TABLE "PaymentInstrument" (...);
CREATE INDEX ... (4 indexes on PaymentInstrument, 1 on Deposit, 1 on Installment)
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT ... (3 FKs: replacedById self, recordedById→User, companyId→Company)
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_paymentInstrumentId_fkey" ... ON DELETE SET NULL
```

No drops. No type changes. No NOT NULL on existing columns.

### `lastCorrectionId` deferral note

`Installment.lastCorrectionId` is added as a plain `String? @db.Uuid` column with an index. The `@relation` decorator (FK to `PaymentCorrection`) is intentionally deferred to Step C when the `PaymentCorrection` model is created. This is per the design spec: "add the column only if Prisma allows it without the target model."

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `PaymentInstrumentType`, `PaymentInstrumentStatus` enums; `PaymentInstrument` model; `Deposit.paymentInstrumentId` nullable FK + index; `Installment.lastCorrectionId` column + index; reverse relations on `Company` and `User` |
| `apps/api/prisma/migrations/20260914055009_step_a_payment_instrument/migration.sql` | Generated migration (new file) |
| `apps/api/src/common/prisma/model-tenancy.ts` | Added `PaymentInstrument: 'TENANT_OWNED'` in payments section |
| `apps/api/src/common/prisma/__tests__/fixtures/legacy-tenant-scoped-models.fixture.ts` | Added `'paymentinstrument'` to legacy set |
| `apps/api/src/common/prisma/__tests__/mt014-model-tenancy-policy.spec.ts` | Updated TENANT_OWNED cardinality assertions: 46 → 47 (×2) |
| `apps/api/test/security/01-middleware-classification.security-spec.ts` | MC-2: 46 → 47; added `PaymentInstrument` to spot-checks |
| `apps/api/test/security/03-payment-instrument-tenancy.security-spec.ts` | New file: 9 Step-A tests (PI-1 fail-closed, PI-2 data isolation, PI-3 nullable FK, PI-4 field acceptance) |
| `apps/api/test/security/seed/security-fixture.ts` | Added `paymentInstrument.deleteMany` before `user.deleteMany` in `teardownCompany` (FK: `recordedById → User RESTRICT`) |

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Security (`jest-security.json`) | 66 tests (62 pass, 4 fail) | **93 tests (93 pass, 0 fail)** — UNVERIFIED (see verification rule above) | +27 tests, 0 new failures |
| Unit (`jest`) | 2003 pass | **2003 pass** — recorded at commit time (a005b7b); re-run today: 2003 total, 5 schema-drift failures in MT-013 | 0 delta |
| e2e (`jest-e2e.json`) | 20 fail (pre-existing) | 20 fail (same pre-existing) | 0 new failures |
| Typecheck | 3 errors (pre-existing) | 3 errors (same pre-existing) | 0 new errors |

Pre-existing failures confirmed unrelated to Step A:
- e2e: MinIO upload tests (E5, F5, G*); IDOR/reports/strict-permissions (pre-existing MT work)
- typecheck: `notifications.module.ts`, `reservations-permissions.spec.ts`, `visits-notifications.spec.ts` (all in original `git status M`)

### Security note

`PaymentInstrument.recordedById` uses `ON DELETE RESTRICT` (Prisma default). This prevents deleting a `User` who has recorded instruments — intentional, consistent with the audit trail requirement. The `teardownCompany` in the test fixture must delete instruments before users; this is now implemented.

---

*Next: Step B — ChequeLifecycleService + Sub-case A bounce path*

---

## Step B — ChequeLifecycleService + Sub-case A bounce path

**Date:** 2026-09-15
**Design ref:** `09-reversal-design.md` §3.3, §3.4 Sub-case A, §4.4, §6.2, §6.3, §8.1 step B
**Status:** DONE ✓

### Migration

`20260915081820_step_b_bounce_penalty_enum` — purely additive:

```sql
ALTER TYPE "PlanPaymentType" ADD VALUE 'BOUNCE_PENALTY';
```

No drops. No type changes. No NOT NULL on existing columns.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `BOUNCE_PENALTY` to `PlanPaymentType` enum |
| `apps/api/prisma/migrations/20260915081820_step_b_bounce_penalty_enum/migration.sql` | Generated migration (new file) |
| `apps/api/src/modules/payment-instruments/payment-instruments.service.ts` | New: `ChequeLifecycleService` — all transitions, Sub-case A bounce, AuditLog write, BOUNCE_PENALTY installment |
| `apps/api/src/modules/payment-instruments/payment-instruments.controller.ts` | New: REST endpoints for all transitions with correct authorization |
| `apps/api/src/modules/payment-instruments/payment-instruments.dto.ts` | New: DTOs for create, bounce, clear, replace |
| `apps/api/src/modules/payment-instruments/payment-instruments.module.ts` | New: NestJS module wiring |
| `apps/api/src/app.module.ts` | Added `PaymentInstrumentsModule` import |
| `apps/api/prisma/seed.ts` | Added `payment-instruments:manage` and `payment-instruments:bounce` permission codes |
| `apps/api/src/modules/payment-instruments/__tests__/cheque-lifecycle.spec.ts` | New: 27 unit + integration tests |
| `apps/api/test/security/05-payment-instrument-attack.security-spec.ts` | New: 8 cross-tenant attack matrix tests (PI-B-1 through PI-B-8) |

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Unit (`jest`) | 2003 pass | **2035 pass** — recorded at commit time (594d192); re-run today: 2035 total, 3 schema-drift failures in MT-013 | +32 tests, 0 new failures |
| Security (`jest-security.json`) | 115 tests (115 pass) | **123 tests (123 pass)** — UNVERIFIED | +8 tests, 0 new failures |
| Typecheck | 3 errors (pre-existing) | 3 errors (same pre-existing) | 0 new errors |
| Lint | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

### Implementation notes

- All state-machine transitions from §3.3 are implemented: PENDING_CLEARANCE→DEPOSITED, PENDING_CLEARANCE→CANCELLED, DEPOSITED→CLEARED, DEPOSITED→BOUNCED (Sub-case A), BOUNCED→REPLACED.
- `DEPOSITED→BOUNCED` guard: if any linked deposit is APPROVED (Sub-case B), throws 501 Not Implemented with a clear message. Sub-case B deferred to Step C.
- Bounce AuditLog entry exactly matches §6.3 structure: `action:"payment-instrument.bounced"`, `subCase:"A"`, `correctionRowsWritten:0`, `penaltyInstallmentId`.
- `DEPOSITED→CLEARED` atomically approves linked deposits and marks installments PAID in a single `$transaction`.
- Settings values (`cheque.bounced.penaltyAmount`) are read as suggestions only per Hard Rule 1 — the operator's submitted value is what gets stored.
- `cheque_bounced` notification is best-effort post-transaction (catch swallowed to avoid blocking the response).

*Next: Step C — PaymentCorrection model + Sub-case B bounce + verify(false) fix*

---

## Step C — PaymentCorrection model + Sub-case B bounce + deposits:reverse endpoint

**Date:** 2026-09-15
**Design ref:** `09-reversal-design.md` §3.2, §3.4 Sub-case B, §5.1, §6.2, §6.3, §8.1 step C
**Status:** DONE ✓

### Migration

`20260915120000_step_c_payment_correction` — purely additive:

```sql
CREATE TYPE "PaymentCorrectionType" AS ENUM ('REVERSAL', 'REASSIGNMENT');
CREATE TABLE "PaymentCorrection" (...);  -- 5 FKs, 4 indexes
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_lastCorrectionId_fkey" FOREIGN KEY ("lastCorrectionId") REFERENCES "PaymentCorrection"("id");
```

No drops. No type changes. No NOT NULL on existing columns.
`Installment.lastCorrectionId` column was added in Step A; Step C wires the FK.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `PaymentCorrectionType` enum; `PaymentCorrection` model; wired `Installment.lastCorrectionId` as real `@relation`; back-relations on `Installment`, `Deposit`, `User`, `Company` |
| `apps/api/prisma/migrations/20260915120000_step_c_payment_correction/migration.sql` | New migration (purely additive) |
| `apps/api/src/common/prisma/model-tenancy.ts` | Added `PaymentCorrection: 'TENANT_OWNED'` (48 models comment) |
| `apps/api/src/common/prisma/__tests__/fixtures/legacy-tenant-scoped-models.fixture.ts` | Added `'paymentcorrection'` |
| `apps/api/src/common/prisma/__tests__/mt014-model-tenancy-policy.spec.ts` | Cardinality assertions: 47 → 48 (×2) |
| `apps/api/test/security/01-middleware-classification.security-spec.ts` | MC-2: 47 → 48; added `PaymentCorrection` to spot-checks |
| `apps/api/src/modules/payment-instruments/payment-instruments.dto.ts` | Added optional `installmentAction` to `RecordBounceDto` |
| `apps/api/src/modules/payment-instruments/payment-instruments.service.ts` | Sub-case B: writes `PaymentCorrection(REVERSAL)` per APPROVED deposit, reopens installment per `installmentAction`, preserves `paidAt`; `computeReopenStatus` helper; removed 501 guard |
| `apps/api/src/modules/deposits/deposits.dto.ts` | Added `ReverseDepositDto` |
| `apps/api/src/modules/deposits/deposits.service.ts` | `DEPOSIT_INCLUDE.installment` exposes `lastCorrectionId` + `lastCorrection` context; `reverseDeposit` method; FG-06: `verify(false)` on APPROVED+PAID routes through reversal path |
| `apps/api/src/modules/deposits/deposits.controller.ts` | Added `POST deposits/:id/reverse`; updated `verify` to pass `actor` |
| `apps/api/prisma/seed.ts` | Added `deposits:reverse` permission |
| `apps/api/src/modules/payment-instruments/__tests__/cheque-lifecycle.spec.ts` | Added Sub-case B tests (9 tests); added `paymentCorrection`/`installment.update` to mock; fixed Sub-case A zero-corrections assertion |
| `apps/api/src/modules/deposits/__tests__/deposit-reversal.spec.ts` | New file: 15 tests for `reverseDeposit` + FG-06 |
| `apps/api/test/security/06-deposit-correction-attack.security-spec.ts` | New file: 4 cross-tenant attack tests (DC-1 through DC-4) |
| `apps/api/test/security/seed/security-fixture.ts` | Added `paymentCorrection.deleteMany` to teardown; granted `deposits:reverse` to adminA |

### Three Invariants (§3.6 Hard Rules)

1. **`paidAt` NEVER cleared on REVERSAL** — `installment.update` data intentionally omits `paidAt`.
2. **`Deposit.reviewStatus` stays APPROVED on Sub-case B** — `deposit.updateMany` is NOT called for APPROVED deposits.
3. **Correction + status update + `lastCorrectionId` in ONE `$transaction`** — both sub-paths (`recordBounce` Sub-case B and `reverseDeposit`) use a single `$transaction`.

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Unit (`jest`) | 2035 pass | **2056 pass** — recorded at commit time (8a7d2b1); re-run today: 2056 total, 3 schema-drift failures in MT-013 | +21 tests, 0 new failures |
| Security (`jest-security.json`) | 123 tests | **128 tests (128 pass)** — UNVERIFIED | +5 tests, 0 new failures |
| Typecheck | 0 errors | 0 errors | 0 new errors |
| Lint | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

### Follow-up (not in Step C scope)

- `apps/web-admin/src/app/dashboard/contracts/[id]/page.tsx` — renders `inst.paidAt` and `inst.status`; should show a "Corrected" badge when `lastCorrectionId !== null` and display `lastCorrection.reason`
- `apps/web-admin/src/app/dashboard/payments/review/page.tsx` — deposit review queue; should surface correction context on previously-reversed deposits
- `apps/web-public/src/app/account/(customer)/installments/page.tsx` — customer installment list with `STATUS_LABELS`; should flag corrected installments
- `apps/mobile/mobile_customer/lib/features/installments/presentation/widgets/installment_card.dart` — Flutter customer installment card; add correction badge when `lastCorrectionId` is set
- `apps/mobile/mobile_staff/lib/features/contracts/presentation/screens/contract_detail_screen.dart` — Flutter staff contract detail; installment plan view needs correction context
- Step D: `ReassignDeposit` — move deposit from one installment to another (§8.1 Step D)

---

## Step D1 — ContractCancellation schema + report query protection

**Date:** 2026-09-15
**Design ref:** `09-reversal-design.md` §4.1, §4.2, §4.5, §8.1 step D (D1 only)
**Status:** DONE ✓

### Scope

D1 is strictly schema + report query protection. **Out of scope:** `contracts:cancel` endpoint, `contracts:release-unit`, clawback collect/waive, tenant Settings, refund recording.

### Migration

`20260915200000_step_d1_cancellation_schema` — additive + one backfill:

```sql
CREATE TYPE "ContractStatus"  AS ENUM ('UNSIGNED', 'ACTIVE', 'CANCELLED');
CREATE TYPE "ClawbackStatus"  AS ENUM ('OUTSTANDING', 'COLLECTED', 'WAIVED');
ALTER TYPE  "InstallmentStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "Contract"        ADD COLUMN "status" "ContractStatus" NOT NULL DEFAULT 'UNSIGNED';
ALTER TABLE "Contract"        ADD COLUMN "cancelledAt" TIMESTAMP(3);
-- BACKFILL (non-additive): derive status from signedAt
UPDATE "Contract" SET "status" = CASE
  WHEN "signedAt" IS NOT NULL THEN 'ACTIVE'::"ContractStatus"
  ELSE 'UNSIGNED'::"ContractStatus" END;
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
ALTER TABLE "InstallmentPlan"  ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE TABLE "ContractCancellation" (...);  -- 6 FKs, 3 indexes
CREATE TABLE "Refund"           (...);      -- 4 FKs, 2 indexes
ALTER TABLE "BrokerCommission"  ADD COLUMN clawback overlay (3 columns + index + 1 FK);
ALTER TABLE "BonusEntry"        ADD COLUMN clawback overlay (3 columns + index + 1 FK);
```

### Report query protection

`InstallmentStatus.CANCELLED` would silently bloat outstanding totals if any query used `status: { not: PAID }` negation. Four queries were affected — all changed to explicit `IN [PENDING, OVERDUE]`:

| File | Query | Before | After |
|---|---|---|---|
| `reports.service.ts:1237` | `unpaid` filter (outstanding + aging + overdue) | `{ not: PAID }` | `{ in: [PENDING, OVERDUE] }` |
| `me-home.module.ts:238` | Q4 next-due installment | `{ not: PAID }` | `{ in: [PENDING, OVERDUE] }` |
| `installments.module.ts:1140` | next-due in plan listing | `{ not: PAID }` | `{ in: [PENDING, OVERDUE] }` |
| `deposits.service.ts:212` | deposit creation guard | `{ not: PAID }` | `{ in: [PENDING, OVERDUE] }` |

### XLSX export

`GET /installment-plans/:planId/export.xlsx` added to `InstallmentsController`. CANCELLED rows appear labelled "ملغى" but are excluded from the outstanding summary total.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `ContractStatus`, `ClawbackStatus` enums; `CANCELLED` to `InstallmentStatus`; `Contract.status/cancelledAt/@@index`; `InstallmentPlan.cancelledAt`; `ContractCancellation` + `Refund` models; clawback overlay on `BrokerCommission`/`BonusEntry`; back-relations on `Company`/`User` |
| `apps/api/prisma/migrations/20260915200000_step_d1_cancellation_schema/migration.sql` | New migration with backfill |
| `apps/api/src/common/prisma/model-tenancy.ts` | Added `ContractCancellation: 'TENANT_OWNED'`, `Refund: 'TENANT_OWNED'` (50 models) |
| `apps/api/src/common/prisma/__tests__/fixtures/legacy-tenant-scoped-models.fixture.ts` | Added `'contractcancellation'`, `'refund'` |
| `apps/api/src/common/prisma/__tests__/mt014-model-tenancy-policy.spec.ts` | Cardinality: 48 → 50 (both assertions) |
| `apps/api/test/security/01-middleware-classification.security-spec.ts` | MC-2: 48 → 50; added `ContractCancellation`/`Refund` spot-checks |
| `apps/api/src/modules/reports/reports.service.ts` | `unpaid` const: `{ not: PAID }` → `Prisma.InstallmentWhereInput { in: [PENDING, OVERDUE] }` |
| `apps/api/src/modules/me-home/me-home.module.ts` | Q4: `{ not: PAID }` → `{ in: [PENDING, OVERDUE] }` |
| `apps/api/src/modules/installments/installments.module.ts` | Next-due + `planXlsx` service + export endpoint |
| `apps/api/src/modules/deposits/deposits.service.ts` | Guard: `{ not: PAID }` → `{ in: [PENDING, OVERDUE] }`; error msg updated |
| `apps/api/src/modules/reports/__tests__/financial-summary.spec.ts` | 3 `has(w, '"not":"PAID"')` → `has(w, '"PENDING"') && has(w, '"OVERDUE"')` |
| `apps/api/src/modules/deposits/__tests__/deposit-recording-workflow.spec.ts` | Guard assertion updated: `{ not: 'PAID' }` → `{ in: ['PENDING', 'OVERDUE'] }` |
| `apps/api/src/modules/installments/__tests__/step-d1-cancelled-installments.spec.ts` | New: 15 tests (D1-1 backfill, D1-2 report query, D1-3 me-home, D1-4 XLSX, D1-5 deposit guard) |
| `apps/api/test/security/07-contract-cancellation-tenancy.security-spec.ts` | New: 12 tests (CC-1 fail-closed, CC-2 data isolation, CC-3 Refund fail-closed, CC-4 Refund isolation, CC-5/6 cross-tenant attack, CC-7 positive path) |
| `apps/api/test/security/seed/security-fixture.ts` | Added `refund.deleteMany` + `contractCancellation.deleteMany` to `teardownCompany` |

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2056 pass | **2069 pass** — directly measured at commit ea2b25a | +13 tests, 0 new failures |
| Security (`jest-security.json`) | 132 tests | **144 tests (144 pass)** — UNVERIFIED | +12 tests, 0 new failures |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## Step D2 — Eight tenant Settings + CancellationPolicyService (suggestion layer)

**Date:** 2026-09-15
**Design ref:** `09-reversal-design.md` §4.4, §8.1 step E (pulled forward as D2 because D3 depends on it)
**Status:** DONE ✓

### Scope

Eight per-tenant `Setting` rows that govern cancellation and cheque-bounce workflows. A read-only `CancellationPolicyService` that computes `getCancellationSuggestion` and `getBounceSuggestion` from those rows. Per-key write-time validation wired into `SettingsService.upsert`. Idempotent seed helper (`createMany + skipDuplicates`) called from `seed.ts` (existing companies) and `SuperAdminService.createCompany` (new companies).

**Hard Rule 1 (design constraint):** Policy produces a SUGGESTION only. Operator-entered values are the truth. A setting is never used to compute a historical amount, never applied automatically.

**Out of scope:** `contracts:cancel` endpoint, `contracts:release-unit`, clawback resolution (Step D3).

### No migration

All 8 keys are stored in the existing `Setting` model (`@@unique([companyId, key])`). No schema change required.

### Seeding defaults

| Key | Default |
|---|---|
| `cancellation.bookingAmount.refundPct` | `0` |
| `cancellation.contract.penaltyPct` | `10` |
| `cancellation.unit.returnToAvailable` | `REQUIRES_APPROVAL` |
| `cancellation.customer.demoteToClient` | `false` |
| `cancellation.brokerCommission.action` | `CLAWBACK` |
| `cancellation.salesBonus.action` | `CLAWBACK` |
| `cheque.bounced.installmentAction` | `REOPEN_AS_OVERDUE` |
| `cheque.bounced.penaltyAmount` | `0` |

### Suggestion formula (§4.4 S2)

```
bookingCollected       = Σ APPROVED Deposits where type=BOOKING_AMOUNT
otherCollected         = totalCollected − bookingCollected
suggestedBookingRefund = bookingCollected × (bookingRefundPct / 100)
suggestedPenalty       = otherCollected × (penaltyPct / 100)
suggestedRetained      = (bookingCollected − suggestedBookingRefund) + suggestedPenalty
suggestedRefund        = totalCollected − suggestedRetained
```

S2 worked example: 25,000 booking + 300,000 installments = 325,000 total; 0% booking refund, 10% penalty → retained 55,000, refund 270,000.

### Security model

`getCancellationSuggestion` uses middleware-scoped `PrismaService.findFirst({ where: { id } })`. Middleware injects `companyId`, so a cross-tenant `contractId` resolves to `null` → `NotFoundException` (404, not 403 — no existence leak).

### Files changed

| File | Change |
|---|---|
| `apps/api/src/modules/contracts/cancellation-settings.constants.ts` | New: 8 defaults + interfaces (`CancellationSettings`, `CancellationPolicySnapshot`, `BouncePolicySnapshot`) + `seedCancellationSettingsForCompany` helper |
| `apps/api/src/modules/contracts/cancellation-policy.service.ts` | New: `CancellationPolicyService` — `getCancellationSuggestion`, `getBounceSuggestion`, private `readSettings` |
| `apps/api/src/modules/contracts/__tests__/cancellation-policy.spec.ts` | New: 37 unit tests (SP-1–SP-9 formula/bounce/seed, VAL-1–VAL-12 per-key validation) |
| `apps/api/test/security/09-d2-settings-security.security-spec.ts` | New: 19 security tests (DS-1–DS-9b cross-tenant isolation + validation + seed) |
| `apps/api/src/modules/settings/settings.module.ts` | Added `SETTING_VALIDATORS` registry + `validateSettingValue` call in `upsert()` |
| `apps/api/src/modules/contracts/contracts.module.ts` | Added `CancellationPolicyService` to providers + exports; added `GET :id/cancellation-suggestion` endpoint |
| `apps/api/src/modules/payment-instruments/payment-instruments.controller.ts` | Added `CancellationPolicyService` injection + `GET :id/bounce-suggestion` endpoint |
| `apps/api/src/modules/payment-instruments/payment-instruments.module.ts` | Added `ContractsModule` import (to resolve `CancellationPolicyService`) |
| `apps/api/src/modules/super-admin/super-admin.service.ts` | Added `seedCancellationSettingsForCompany` call after `createCompany` transaction |
| `apps/api/prisma/seed.ts` | Added loop to seed 8 defaults for all existing companies |
| `apps/api/src/modules/super-admin/__tests__/company-foundation-d1.spec.ts` | Added `setting.createMany` mock stub |
| `apps/api/src/modules/super-admin/__tests__/company-d2.spec.ts` | Added `setting.createMany` mock stub |

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2069 pass | **2097 pass** — directly measured at HEAD (689a03f) | +28 tests, 0 new failures |
| Security (`jest-security.json`) | 144 tests | **163 tests (163 pass)** — directly measured at HEAD (689a03f), including randomized run | +19 tests, 0 new failures |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

### Known gap: company-creation window

`SuperAdminService.createCompany` commits the company row inside `$transaction` (line 157) and seeds settings with a separate call to `seedCancellationSettingsForCompany` outside the transaction (line 164).  There is a narrow window between these two calls where the company exists in the database without its 8 D2 setting rows.

**Mitigation (no fix required now):** `CancellationPolicyService.readSettings` falls back to `CANCELLATION_SETTING_DEFAULTS` for any key that has no row, so suggestions remain correct with the documented default values during the window.  If the process dies in that window, `seed.ts` re-run will fill the gap via `createMany({ skipDuplicates: true })`.

### Test-isolation fix applied in this commit

`07-contract-cancellation-tenancy.security-spec.ts` was refactored to move all
row creation (contract, ContractCancellation, Refund) into `beforeAll`.  The
original `it('CC-2')` mutated `secFixture.resources.a.contractId` and seven
subsequent tests (CC-4, CC-5, CC-5b, CC-6, CC-6b, CC-7, CC-7b) silently returned
early if run before CC-2.  Those tests were vacuous passes when randomized.
The fix creates a dedicated contract (not the fixture's shared contract), making
every test order-independent.  Verified with `--randomize`: 163/163.

---

*Next: Step D3 — contracts:cancel endpoint + unit-release + clawback overlay*

---

## Step D3 — contracts:cancel + contracts:release-unit

**Date:** 2026-09-15
**Design ref:** `09-reversal-design.md` §4.3, §4.5, §4.6, §6.2, §6.3, §8.1 step D (D3)
**Status:** DONE ✓

### Scope

`POST /contracts/:id/cancel` and `POST /contracts/:id/release-unit`. Both endpoints shipped together because the default `cancellation.unit.returnToAvailable` setting is `REQUIRES_APPROVAL`, which would leave every cancelled unit permanently SOLD without the release endpoint.

**Out of scope:** D4 clawback collect/waive resolution.

### Migration

`20260915300000_step_d3_bonus_entry_cancelled` — purely additive:

```sql
ALTER TYPE "BonusEntryStatus" ADD VALUE 'CANCELLED';
```

No drops. No type changes. No NOT NULL on existing columns.

`BonusEntryStatus` previously had `PENDING`, `APPROVED`, `PAID`. The `CANCELLED` value is needed so PENDING/APPROVED bonuses can be cancelled when their parent contract is cancelled.

### Hard Rules (from design §4.3)

1. **Hard Rule 1 — operator amounts are truth.** `retainedAmount` and `refundAmount` come from the request body verbatim; the D2 suggestion is never stored.
2. **Hard Rule 2 — nothing settled is deleted.** A PAID commission or bonus keeps its `status`. Clawback is an overlay (`clawbackStatus = OUTSTANDING`). Cancelled installments are marked `CANCELLED`, not deleted.
3. **Atomicity.** All 9 cancellation steps run in ONE `$transaction`. The `ContractCancellation` row is created last inside the transaction so `unitReleasedAt` / `customerDemotedAt` are available when the row is written.

### Authorization (§6.2)

- `cancel`: `@Roles(ADMIN)`, `@PermissionsStrict('contracts:cancel')`, reason MANDATORY
- `release-unit`: `@Roles(ADMIN)`, `@PermissionsStrict('contracts:release-unit')`
- Cross-tenant: contract not found in current company → 404, not 403 (no existence leak)

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `CANCELLED` to `BonusEntryStatus` enum |
| `apps/api/prisma/migrations/20260915300000_step_d3_bonus_entry_cancelled/migration.sql` | New migration (additive) |
| `apps/api/src/modules/contracts/contract-cancellation.service.ts` | New: `ContractCancellationService` — `cancel()` + `releaseUnit()` methods; `isCommissionEffectivelyPaid()` helper; all 9 cancellation steps in one `$transaction` |
| `apps/api/src/modules/contracts/contracts.module.ts` | Added `CancelContractDto`; wired `ContractCancellationService` into controller + module; added `POST :id/cancel` and `POST :id/release-unit` endpoints |
| `apps/api/prisma/seed.ts` | Added `contracts:cancel` and `contracts:release-unit` permission codes |
| `apps/api/src/modules/bonus/bonus.module.ts` | Added `BonusEntryStatus.CANCELLED` to the two `Record<BonusEntryStatus, string>` label maps (`entriesCsv`, `entriesXlsx`) |
| `apps/api/src/modules/contracts/__tests__/contract-cancellation.spec.ts` | New: 16 unit tests (CC-U-1 through CC-U-16) covering happy path, Hard Rule 1 and 2 invariants, AUTO release, customer demotion, CANCELLED terminal, UNSIGNED, atomicity, cross-tenant |
| `apps/api/test/security/10-d3-cancel-attack.security-spec.ts` | New: 9 security/e2e tests (S2 scenario, D3-1 through D3-8) with real Postgres |
| `apps/api/test/security/seed/security-fixture.ts` | Added `contracts:cancel` + `contracts:release-unit` permission grants to `adminA` |

### Implementation notes

- **`isCommissionEffectivelyPaid()`**: `BrokerCommissionStatus` has no `PAID` value. "Effectively paid" = `payoutId != null AND payout.status IN ['APPROVED', 'PROCESSING', 'PAID']`. The helper reads the payout status via `include: { payout: { select: { status: true } } }` in the pre-transaction read. *(Narrowed to PROCESSING|PAID only in D3b below — APPROVED is not effectively paid.)*
- **policySnapshot** captures the *tenant setting values* at cancel time (not the operator's per-transaction overrides). Operator overrides are stored in separate `unitReleaseOverride`, `commissionActionOverride` etc. columns.
- **AuditLog**: `payload` is not a field on `AuditLog` — the cancel audit data is merged into the `after` JSON column per `contract.cancelled` schema.
- **NOT VALID constraint** (D3-6 atomicity test): `ALTER TABLE "ContractCancellation" ADD CONSTRAINT ... CHECK (1 = 0) NOT VALID` is used instead of `CHECK (1 = 0)` so that pre-existing CC rows (from the S2 test) do not cause the ADD CONSTRAINT to fail. `NOT VALID` applies to new inserts only, which is sufficient to force the `$transaction` to roll back.

### Test results

| Suite | Before | After | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2097 pass | **2113 pass** — directly measured at HEAD | +16 tests, 0 new failures |
| Security (`jest-security.json --randomize`) | 163 tests | **172 tests (172 pass)** — directly measured at HEAD | +9 tests, 0 new failures |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

*Next: Step D3b — narrow `isCommissionEffectivelyPaid()` + atomic payout side-effects*

---

## Step D3b — Narrow `isCommissionEffectivelyPaid()` + atomic payout side-effects

**Date:** 2026-09-17
**Design ref:** `09-reversal-design.md` §4.3 (rev 5), Appendix C-23, §8.1 step D
**Status:** DONE ✓

### Scope

D3 shipped with `isCommissionEffectivelyPaid()` treating payout status `APPROVED|PROCESSING|PAID`
as "effectively paid." This was wrong: APPROVED means authorisation given but money not yet sent.
Cancelling an APPROVED-payout commission is safe, but the commission amount stays in the payout
totals, creating a phantom clawback receivable. Both corrections must land atomically.

**No migration.** All schema columns (`payoutId`, `totalGross`, `totalTax`, `totalWithholding`,
`totalNet`, `status`, `cancelledAt`, `cancelledById`, `cancelReason`) already exist on `BrokerPayout`.

### What changed

1. **Narrowed helper** — `isCommissionEffectivelyPaid()` now returns `true` only for `PROCESSING` or
   `PAID` payout status. `APPROVED` falls into the cancel path, not the overlay path.
2. **Atomic payout side-effects** — when an APPROVED-payout commission is cancelled, inside the
   same `$transaction`:
   - commission `payoutId` is set to `null`
   - remaining commissions on the payout are aggregated
   - if count = 0 → payout transitions to `CANCELLED` (with `cancelledAt`, `cancelledById`, `cancelReason`)
   - if count > 0 → payout reverts to `DRAFT` with recomputed totals (re-approval required;
     original approval was for a different amount)
3. **Design rev 5** — `09-reversal-design.md` updated with five-row §4.3 table, payout side-effects
   narrative, and Appendix C-23.

### Files changed

| File | Change |
|---|---|
| `apps/api/src/modules/contracts/contract-cancellation.service.ts` | Narrowed `isCommissionEffectivelyPaid()` to `PROCESSING\|PAID`; added payout side-effects (aggregate + DRAFT/CANCELLED) in the else branch |
| `apps/api/src/modules/contracts/__tests__/contract-cancellation.spec.ts` | Added CC-U-17 (PROCESSING payout → overlay), CC-U-18 (sole APPROVED commission → payout CANCELLED), CC-U-19 (one of two → payout DRAFT with recomputed totals); updated `buildTx()` to include `brokerCommission.aggregate` and `brokerPayout.update` mocks |
| `apps/api/test/security/10-d3-cancel-attack.security-spec.ts` | Added D3-9 (5 tests: BonusEntry PENDING/APPROVED, BrokerCommission PENDING-no-payout/APPROVED-no-payout/APPROVED+PAID-payout) and D3-10 (4 tests: APPROVED payout → payout CANCELLED, partial payout → DRAFT with exact totals, PROCESSING payout → overlay, atomicity via NOT VALID) — all real-Postgres |
| `docs/audit/09-reversal-design.md` | Rev 5: §4.3 five-row table with APPROVED payout row and payout side-effects narrative; Appendix C-23 |

### Test results

| Suite | Before (D3) | After (D3b) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2113 pass | **2116 pass** — directly measured at HEAD | +3 (CC-U-17, CC-U-18, CC-U-19) |
| Security (`jest-security.json --randomize`) | 172 pass | **181 pass** — directly measured at HEAD | +9 (D3-9 ×5, D3-10 ×4) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

*Next: Steps F + G — RecordDepositDto.paymentMethod + booking-payment dual-path guards*

---

## Steps F + G — paymentMethod on admin deposit path + booking-payment collision guards

**Date:** 2026-09-17
**Design ref:** `09-reversal-design.md` §5.2, §8.1 steps F and G; `08-functional-gaps.md` FG-08, §6.4
**Status:** DONE ✓

### Scope

Last two §8.1 pre-launch blockers:

**Step F (FG-08):** `RecordDepositDto` had no `paymentMethod` field, so every admin-recorded
installment deposit stored `NULL`. Added as an optional field (`PaymentMethod?`) — existing
deposits are unaffected; callers who do not send the field continue to get `null`.

**Step G (FG-13):** Two guards on the booking-payment dual-path collision:
1. `confirmBookingPayment()` — throws 409 if `bookingPaymentStatus === PENDING`. Prevents admin
   confirm from silently overriding a customer proof that is under review.
2. `unconfirmBookingPayment()` — no longer calls `deleteMany` on all `BOOKING_AMOUNT` deposits.
   Only deletes deposits with `proofDocumentId = null` (admin-created). Customer-submitted proof
   deposits (with `proofDocumentId` set) are left intact. After deleting admin deposits, counts
   remaining customer-proof deposits: if any remain, reverts `bookingPaymentStatus` to `PENDING`
   (proof still under review), not the caller's requested status (default `UNPAID`).

**PaymentInstrumentId link — NOT built (reported):**
The `Deposit` model already has a nullable `paymentInstrumentId` FK (added in Step A). The admin
`record()` path does NOT expose it. To link a `PaymentInstrument` from the admin recording flow
would require: (1) add `@IsOptional() @IsUUID() paymentInstrumentId?` to `RecordDepositDto`,
(2) load and validate the PI belongs to the same company in the pre-transaction read, (3) sync
`paymentMethod` from PI.type, (4) pass `paymentInstrumentId` to `deposit.create`. The validation
logic is non-trivial; the request did not include this and it is not built.

### No migration

All changed columns (`paymentMethod`, `proofDocumentId`) already exist on the `Deposit` model.
No schema change. No migration.

### Files changed

| File | Change |
|---|---|
| `apps/api/src/modules/deposits/deposits.dto.ts` | Added `@IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod` to `RecordDepositDto` |
| `apps/api/src/modules/deposits/deposits.service.ts` | Passes `paymentMethod: dto.paymentMethod ?? null` to `deposit.create` in `record()` |
| `apps/api/src/modules/reservations/reservations.module.ts` | `confirmBookingPayment()`: added PENDING guard (ConflictException, Step G); `unconfirmBookingPayment()`: scoped deleteMany to `proofDocumentId: null` and added customer-proof count to determine effective status (PENDING vs UNPAID) |
| `apps/api/src/modules/deposits/__tests__/deposit-recording-workflow.spec.ts` | Added 3 unit tests (Step F): paymentMethod=CHEQUE stored; omitted → null; invalid enum → 400 |
| `apps/api/test/security/11-fg-booking-payment-guards.security-spec.ts` | New: 11 real-Postgres security tests (FG-1a/b/c: confirm blocked while PENDING; FG-2a–e: unconfirm with customer-proof deposit — proof and document survive, admin deposit deleted, status=PENDING; FG-3a/b/c: unconfirm with admin-only deposit — deleted, status=UNPAID) |

### Test results

| Suite | Before (D3b) | After (F+G) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2116 pass | **2119 pass** — directly measured at HEAD | +3 (Step F: paymentMethod tests) |
| Security (`jest-security.json --randomize`) | 181 pass | **192 pass** — directly measured at HEAD | +11 (FG-1 ×3, FG-2 ×5, FG-3 ×3) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## Step D4 — Clawback collect + waive (BrokerCommission + BonusEntry)

**Date:** 2026-09-17
**Design ref:** `09-reversal-design.md` §4.5, §4.3, §8.2 step L, §6 (rev 6)
**Status:** DONE ✓

### What this step implements

Four endpoints for resolving an outstanding clawback receivable:

- `POST /broker-commissions/:id/clawback/collect` — record full or partial repayment from broker
- `POST /broker-commissions/:id/clawback/waive` — waive outstanding receivable with mandatory reason
- `POST /bonus-entries/:id/clawback/collect` — same for BonusEntry (simpler: no payout batching)
- `POST /bonus-entries/:id/clawback/waive` — waive BonusEntry receivable

**Hard Rule 2** (non-negotiable): collecting or waiving NEVER changes `commission.status` or `bonusEntry.status`. The clawback overlay is the only thing that moves.

**Partial recovery:** introduced `PARTIALLY_COLLECTED` as a new `ClawbackStatus` enum value. A 75,000 commission with 50,000 returned becomes `PARTIALLY_COLLECTED` (not `COLLECTED`). Second collect accumulates and promotes to `COLLECTED` when total ≥ netAmount. This preserves reporting accuracy — OUTSTANDING queries never overstate if partial repayment occurred.

**Separate waive reason:** `clawbackWaiveReason` is stored in its own column, distinct from `clawbackReason` (which records the cancellation reason). Both are independently readable.

### Migration

`20260917000000_step_d4_clawback_resolve` — purely additive:

```sql
ALTER TYPE "ClawbackStatus" ADD VALUE 'PARTIALLY_COLLECTED';
ALTER TABLE "BrokerCommission"
  ADD COLUMN "clawbackCollectedAmount"        DECIMAL(14,2),
  ADD COLUMN "clawbackCollectedReference"     VARCHAR(100),
  ADD COLUMN "clawbackCollectedPaymentMethod" "PaymentMethod",
  ADD COLUMN "clawbackWaiveReason"            VARCHAR(2000);
ALTER TABLE "BonusEntry"
  ADD COLUMN "clawbackCollectedAmount"        DECIMAL(14,2),
  ADD COLUMN "clawbackCollectedReference"     VARCHAR(100),
  ADD COLUMN "clawbackCollectedPaymentMethod" "PaymentMethod",
  ADD COLUMN "clawbackWaiveReason"            VARCHAR(2000);
```

No drops. No type changes. No NOT NULL on existing columns.

### Files changed

| File | Change |
|---|---|
| `docs/audit/09-reversal-design.md` | Rev 6: fixed §8.2 step L (removed wrong "commission.status=PAID" claim; added PARTIALLY_COLLECTED, separate waiveReason, correct status references); added conflict log C-24/C-25/C-26 |
| `apps/api/prisma/schema.prisma` | `ClawbackStatus` enum: added `PARTIALLY_COLLECTED`; `BrokerCommission` + `BonusEntry`: 4 new nullable columns (clawbackCollectedAmount/Reference/PaymentMethod, clawbackWaiveReason); fixed schema comment |
| `apps/api/prisma/migrations/20260917000000_step_d4_clawback_resolve/migration.sql` | New additive migration (see above) |
| `apps/api/src/modules/broker-commissions/clawback-resolution.service.ts` | New: `ClawbackResolutionService` — 4 methods (collectCommission, waiveCommission, collectBonus, waiveBonus); `$transaction` for atomicity; Hard Rule 2 enforced (status never set); AuditLog entries with before/after shape |
| `apps/api/src/modules/broker-commissions/dto/broker-commission.dto.ts` | Added `CollectClawbackDto` (amount, paymentMethod, optional reference) and `WaiveClawbackDto` (mandatory reason) |
| `apps/api/src/modules/broker-commissions/broker-commissions.controller.ts` | Added `collectClawback` + `waiveClawback` endpoints; ADMIN-only + `@PermissionsStrict('broker-commissions:clawback:resolve')` |
| `apps/api/src/modules/broker-commissions/broker-commissions.module.ts` | Added `ClawbackResolutionService` to providers + exports |
| `apps/api/src/modules/bonus/bonus.module.ts` | Added `collectBonusClawback` + `waiveBonusClawback` to BonusController; `ClawbackResolutionService` to BonusModule providers |
| `apps/api/prisma/seed.ts` | Added 2 permissions: `broker-commissions:clawback:resolve`, `bonus:clawback:resolve` |
| `apps/api/src/modules/broker-commissions/__tests__/clawback-resolution.spec.ts` | New: 16 unit tests (D4-C-1–D4-C-11 commission path, D4-B-1–D4-B-5 BonusEntry path); all mock-based |
| `apps/api/src/modules/broker-commissions/__tests__/broker-commissions-permissions.spec.ts` | Added `ClawbackResolutionService` to test module providers (DI fix) |
| `apps/api/test/security/12-d4-clawback-resolve.security-spec.ts` | New: 27 real-Postgres security tests (D4-1 through D4-14; atomicity via NOT VALID constraint) |

### Test counts

| Suite | Before (F+G) | After (D4) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2119 pass | **2135 pass** — directly measured at HEAD | +16 (D4 unit tests) |
| Security (`jest-security.json --randomize`) | 192 pass | **219 pass** — directly measured at HEAD | +27 (D4-1–D4-14) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## Step 15 — Email delivery observability + gap fill

**Date:** 2026-09-17
**Design ref:** `docs/audit/15-email-delivery.md`
**Status:** DONE ✓

### What this step implements

**Part A — Email delivery gap fill (FG-07 + A.2):**
Five template codes added to `EMAIL_ELIGIBLE_TEMPLATES`:
- `payment_proof_approved`, `payment_proof_rejected` (FG-07, Step 15 A.1): customers must learn payment proof decisions even without an FCM device.
- `reservation_expired` (Step 15 A.2): lost sale with zero customer notification. Highest severity.
- `installment_plan_created` (Step 15 A.2): customer's payment schedule — previously IN_APP only.
- `maintenance_request_status_changed` (Step 15 A.2): previously IN_APP only.

All five were previously customer-facing with no email fallback when FCM was unconfigured or the customer had no device.

**Part B — Delivery observability:**
- `sendNotificationEmail` in `email.service.ts` now returns `{ ok: true; sentAt: Date } | { ok: false; error: string }` instead of `Promise<void>`.
- `send()` in `notifications.module.ts` runs push and email **concurrently** via `Promise.all` (latency = `max(FCM, SMTP)`, not `FCM + SMTP`).
- After both settle, a single `notification.update` writes four outcome columns: `emailSentAt`, `emailError`, `pushSentAt`, `pushError`.
- `sentAt` is NOT repurposed — it still means "row created". Delivery truth lives exclusively in the four new columns. Schema comment documents this.

**Latency impact of awaiting email:**
Push and email run concurrently, so total added latency is `max(FCM_latency, SMTP_latency)` rather than sequential `FCM + SMTP`. FCM multicast is typically ~200–400 ms; a slow SMTP relay can be 2–5 s. All current call sites are post-transaction fire-and-forget (the business layer does not await `sendToUser`), so SMTP latency does not currently reach any user-facing HTTP response. If a future call site changes this, the smallest mitigation without a queue is to detach the email promise with `setImmediate` — one line, no new infra, no BullMQ.

**Also: stale Firebase comment fixed:**
`env.validation.ts:204` previously said "FCM is not yet wired in code." FCM is fully wired. Comment replaced; all three `FIREBASE_*` vars now required in production.

**Part C — deferred, next step after this one:**
`EMAIL_ELIGIBLE_TEMPLATES` (runtime Set) and `NotificationTemplate.channel` (DB column) are two independent sources of truth invisible to the admin template editor. **Recommended fix:** add `emailEnabled Boolean @default(false)` to `NotificationTemplate`. This requires:
1. Migration: add nullable `emailEnabled` column; backfill via seed upsert for the 23 currently eligible codes.
2. `send()`: replace `EMAIL_ELIGIBLE_TEMPLATES.has(code)` with `tpl.emailEnabled` (already in scope from the template lookup at line 322).
3. Admin API: expose `emailEnabled` in the template upsert DTO and response shape.
4. Admin UI (web-admin): add a toggle in the template edit form.
5. Remove `EMAIL_ELIGIBLE_TEMPLATES` entirely.
Separate step because it changes the admin API shape and the dashboard form.

### Migration

`20260917100000_notification_delivery_tracking` — purely additive:

```sql
ALTER TABLE "Notification"
  ADD COLUMN "emailSentAt"  TIMESTAMP(3),
  ADD COLUMN "emailError"   VARCHAR(500),
  ADD COLUMN "pushSentAt"   TIMESTAMP(3),
  ADD COLUMN "pushError"    VARCHAR(500);
```

No drops. No type changes. No NOT NULL on existing columns.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added 4 nullable outcome columns to `Notification`; `sentAt` schema comment |
| `apps/api/prisma/migrations/20260917100000_notification_delivery_tracking/migration.sql` | New additive migration |
| `apps/api/src/modules/notifications/notifications.module.ts` | Added 5 codes to `EMAIL_ELIGIBLE_TEMPLATES`; rewrote `send()` delivery section: concurrent push+email via `Promise.all`, outcome accumulator, single `notification.update` |
| `apps/api/src/modules/auth/email.service.ts` | `sendNotificationEmail` return type changed from `Promise<void>` to discriminated union |
| `apps/api/src/config/env.validation.ts` | Stale Firebase comment replaced; `FIREBASE_*` vars required in production |
| `apps/api/src/modules/notifications/__tests__/notification-delivery-tracking.spec.ts` | New: 18 unit tests covering all delivery outcome scenarios |
| `apps/api/src/modules/notifications/__tests__/notifications-helpers.spec.ts` | Added `notification.update` mock |
| `apps/api/src/modules/notifications/__tests__/notifications-permissions.spec.ts` | Added `user.findFirst` + `notification.update` to mock + `beforeEach` clear |
| `apps/api/src/config/__tests__/env.validation.spec.ts` | Added `FIREBASE_*` credentials to `validProd()` fixture |
| `docs/audit/15-email-delivery.md` | New: investigation findings |

### Test results

| Suite | Before (D4) | After (Step 15) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2135 pass | **2153 pass** — directly measured at HEAD | +18 |
| Security (`jest-security.json --runInBand`) | 219 pass | **219 pass** — directly measured at HEAD | 0 (no new security specs in this step) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

---

## Step 15C — `emailEnabled` column: single source of truth for email eligibility

**Date:** 2026-09-17
**Design ref:** `docs/audit/15-email-delivery.md` §7 Part C
**Status:** DONE ✓

### What this step implements

**Problem:** `EMAIL_ELIGIBLE_TEMPLATES` (a hardcoded runtime `Set`) and
`NotificationTemplate.channel` (the DB column) were two independent sources of
truth for the same question. An admin editing a template in the dashboard
couldn't see that email was also sent, and any new template code added without
touching the Set silently lost email delivery.

**Fix:**
1. `NotificationTemplate.emailEnabled Boolean @default(false)` — the DB is now
   the only authority.
2. Migration backfills `emailEnabled = true` for exactly the 23 codes that were
   in `EMAIL_ELIGIBLE_TEMPLATES`. Behaviour is unchanged on existing databases.
3. `send()` reads `tpl.emailEnabled` instead of `EMAIL_ELIGIBLE_TEMPLATES.has()`.
4. `EMAIL_ELIGIBLE_TEMPLATES` deleted entirely — no fallback that could recreate
   the two-sources problem.
5. Seed: every template object now carries `emailEnabled: true/false` explicitly
   so a fresh database matches a migrated one without running the backfill SQL.
6. Admin API: `UpsertTemplateDto` gains `@IsOptional() @IsBoolean() emailEnabled?`
   and the create/update blocks include it. `listTemplates` returns it via Prisma
   automatically.
7. web-admin: `Template` interface updated; table shows an "Email On/Off" badge
   per row; create/edit form adds an "Also send email" checkbox. Admins can now
   see and change email eligibility from the dashboard.

### Migration

`20260917200000_notification_template_email_enabled` — additive + backfill:

```sql
ALTER TABLE "NotificationTemplate" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "NotificationTemplate" SET "emailEnabled" = true WHERE code IN (... 23 codes ...);
```

No drops. No type changes. No NOT NULL added to existing non-null columns.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `emailEnabled Boolean @default(false)` to `NotificationTemplate` |
| `apps/api/prisma/migrations/20260917200000_notification_template_email_enabled/migration.sql` | New additive migration with backfill |
| `apps/api/src/modules/notifications/notifications.module.ts` | Deleted `EMAIL_ELIGIBLE_TEMPLATES`; added `emailEnabled?` to `UpsertTemplateDto`; updated `upsertTemplate()` create/update; `send()` reads `tpl.emailEnabled` |
| `apps/api/prisma/seed.ts` | Added `emailEnabled: true` to 23 template objects; `create` block now passes `emailEnabled` |
| `apps/api/src/modules/notifications/__tests__/notification-delivery-tracking.spec.ts` | Updated template mocks to include `emailEnabled`; new `Part C` describe: 3 behavioral + 3 seed-consistency groups (23 + 6 + 1 checks) |
| `apps/api/src/modules/notifications/__tests__/notifications-permissions.spec.ts` | Added `emailEnabled:true` write test + cross-tenant 403 guard test |
| `apps/web-admin/src/app/dashboard/notifications/templates/page.tsx` | `emailEnabled` in `Template` type, action, table column, form checkbox |
| `apps/web-admin/src/messages/ui.ts` | Added AR + EN labels: `colEmail`, `emailOn`, `emailOff`, `emailEnabledLabel` |

### Test results

| Suite | Before (Step 15) | After (Step 15C) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2153 pass | **2188 pass** — directly measured at HEAD | +35 |
| Security (`jest-security.json --randomize`) | 219 pass | **219 pass** — directly measured at HEAD | 0 (no new security specs) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## Phase 1 — Capability & Plan Limits: definition, resolution, and reporting

**Date:** 2026-09-17
**Design ref:** `docs/audit/07-product-split.md` Q4; `docs/audit/13-user-tenancy.md`
**Status:** DONE ✓

### Scope

Definition, resolution, and reporting of plan-based capability limits. **No enforcement in this phase.** Nothing blocks routes, creation, or login. The phase adds:

1. **Three-layer capability model**: plan defaults (code constants) ← per-company override (JSONB blob) ← column-backed app-enablement flags (`websiteEnabled`, `customerAppEnabled`, `staffAppEnabled`).
2. **`CUSTOM` plan tier** added to `SubscriptionPlan` enum. `PricingPackage.planTier` column promoted from `String` to the enum type.
3. **`capability-schema.ts`**: typed key sets, plan defaults for TRIAL/STARTER/PROFESSIONAL/ENTERPRISE/CUSTOM, `buildEffectiveView()` sync helper (used by both per-company read and bulk report), `validateCapabilityOverrides()` (rejects unknown keys, column-backed keys, float/negative limits, non-boolean features).
4. **Extended `CapabilityService`**: `getEffectiveCapabilities(id)`, `setCapabilityOverrides(id, overrides)` (validated write + cache invalidation), `getEffectiveLimits(id)`.
5. **Super-admin endpoints** (SUPER_ADMIN only, `@BypassTenant`): view three-layer breakdown, write typed overrides, read usage counts, cross-company capability report.
6. **Tenant-facing endpoints** (ADMIN/SALES_MANAGER, no companyId param — cross-tenant structurally impossible): `GET /capabilities/me`, `GET /capabilities/me/usage`.
7. **Security test file 13**: 20 `it` blocks (CAP-1 through CAP-12) covering the full attack matrix.

### Single source of truth decision

`websiteEnabled`, `customerAppEnabled`, `staffAppEnabled` remain authoritative as Company columns. They are NOT in the overridable blob (`OVERRIDE_ELIGIBLE_KEYS` excludes them). `buildEffectiveView` reads them directly from the Company row with `source = 'company_column'`. Super-admin continues to set them via `PATCH /super-admin/companies/:id`. No two sources of truth.

### Plan defaults

| Capability | TRIAL | STARTER | PROFESSIONAL | ENTERPRISE / CUSTOM |
|---|---|---|---|---|
| `limit.maxUnits` | 150 | 150 | 750 | null (unlimited) |
| `limit.maxUsers` | 15 | 15 | 50 | null |
| `limit.maxProjects` | 5 | 5 | 20 | null |
| `feature.brokers` | true | false | true | true |
| `feature.advancedReports` | true | false | true | true |
| `feature.maintenance` | true | false | false | true |
| `feature.customDomain` | true | false | false | true |
| `feature.publicWebsite` | true (col) | — (col) | — (col) | — (col) |
| `feature.customerApp` | true (col) | — (col) | — (col) | — (col) |
| `feature.staffApp` | true (col) | — (col) | — (col) | — (col) |
| All core features | true | true | true | true |

TRIAL intentionally shows the full product (evaluation). Column-backed features are controlled by Company columns, not plan defaults.

### Migration

`20260917300000_plan_tier_enum` — non-destructive type promotion:

```sql
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CUSTOM';
DROP INDEX IF EXISTS "PricingPackage_planTier_idx";
ALTER TABLE "PricingPackage"
  ALTER COLUMN "planTier" TYPE "SubscriptionPlan"
  USING "planTier"::"SubscriptionPlan";
CREATE INDEX "PricingPackage_planTier_idx" ON "PricingPackage"("planTier");
```

No drops. No existing rows affected (the column is nullable; existing String values cast safely).

### Security model

- Only SUPER_ADMIN reads or writes overrides. Super-admin endpoints are behind `SuperAdminGuard`.
- Company ADMIN reads own effective capabilities and usage via `GET /capabilities/me` (no companyId param — cross-tenant structurally impossible). SALES_MANAGER also allowed read-only.
- No write endpoint exists for company ADMIN.
- Cross-tenant attempts to super-admin endpoints return 403. Nonexistent company in super-admin endpoints returns 404.
- `OVERRIDE_ELIGIBLE_KEYS`: only 7 keys can go in the capabilities blob. Column-backed keys (`feature.publicWebsite`, `feature.customerApp`, `feature.staffApp`) are rejected on write with 400.
- No `@RequireCapability` on any route. No creation blocking. No login blocking. No app gating.

### Files changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added `CUSTOM` to `SubscriptionPlan`; `PricingPackage.planTier: SubscriptionPlan` (was `String`) |
| `apps/api/prisma/migrations/20260917300000_plan_tier_enum/migration.sql` | New migration (enum promotion) |
| `apps/api/src/common/capabilities/capability-schema.ts` | New: typed keys, plan defaults, `buildEffectiveView`, `validateCapabilityOverrides` |
| `apps/api/src/common/capabilities/capability.service.ts` | Added `getEffectiveCapabilities`, `setCapabilityOverrides`, `getEffectiveLimits`; added `Prisma` import |
| `apps/api/src/modules/super-admin/dto/super-admin.dto.ts` | `planTier: @IsEnum(SubscriptionPlan)` (was `@IsString`); added `UpdateCapabilityOverridesDto` |
| `apps/api/src/modules/super-admin/super-admin.service.ts` | Added 4 methods: `setCapabilityOverrides`, `getCapabilitiesView`, `getCompanyUsage`, `getCapabilityReport` |
| `apps/api/src/modules/super-admin/super-admin.controller.ts` | Added 4 endpoints: view, overrides, usage, report |
| `apps/api/src/modules/capabilities/capabilities.module.ts` | New: `CompanyCapabilitiesController` + `CompanyCapabilitiesModule` (tenant-facing) |
| `apps/api/src/app.module.ts` | Added `CompanyCapabilitiesModule` |
| `apps/api/src/common/capabilities/__tests__/capability-resolution.spec.ts` | New: 7 test groups (per-plan defaults, override both directions, override survives plan change, invalid rejected, cache invalidation, tenant scope, cross-tenant 404) |
| `apps/api/test/security/13-capability-tenancy.security-spec.ts` | New: 20 `it` blocks (CAP-1 through CAP-12 attack matrix) |

### Test results

| Suite | Before (Step 15C) | After (Phase 1) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2188 pass | **2224 pass** — directly measured at HEAD | +36 (7 groups, capability-resolution.spec.ts) |
| Security (`jest-security.json --randomize`) | 219 pass | **239 pass** — directly measured at HEAD | +20 (CAP-1 through CAP-12) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## Phase 2 — Capability Enforcement (blocking)

**Date:** 2026-09-18
**Scope:** Tasks 7–11 of the Capability Enforcement roadmap.
**Status:** DONE ✓

### What changed

Phase 2 is where capability checks actually block requests. Phase 1 only
wired the infrastructure; Phase 2 applies it at every relevant surface.

**Rule enforced by every change in this phase:**
_Limits block CREATION only. Reads, updates, and deletes always work.
A company over its limit must continue running its business on existing data._

#### Task 7 — @RequireCapability('feature.customerApp') on me/* routes

Applied to every customer-only endpoint. Notifications routes (`me/notifications`,
`me/devices`) were deliberately excluded — they serve all authenticated roles and
the CapabilityGuard already handles staffApp/customerApp gating per the user's role
via the always-check in Stage 1.

Controllers updated: `MeInstallmentsController`, `DepositsController` (4 methods),
`VisitsController` (3 methods), `ContractsModule` (myContracts), `RequestsModule` (4 methods).

#### Task 8 — Creation limits

- `PlanLimitService.checkUserLimit(role)` called in `users.service.ts::create()`.
  CLIENT/CUSTOMER roles bypass the count. ENTERPRISE with `null` limits is never blocked.
- `PlanLimitService.checkUnitLimit()` called in `units.service.ts::create()`.
- `PlanLimitService.checkProjectLimit()` called in `projects.service.ts::create()`.

`getRequiredCompanyId()` is called inside each `PlanLimitService` method (not by the
caller), so the caller cannot influence which company's limits are checked. Callers that
no longer need `companyId` exclusively for the limit check had the redundant ALS call
removed.

#### Task 9 — Domain resolver

Already correct from Phase 1 — `feature.publicWebsite` reads the `websiteEnabled`
column via the three-layer effective view. No change needed.

#### Task 10 — Cache invalidation on company update

`super-admin.service.ts::updateCompany()` calls `capabilityService.invalidateCache(id)`
when `subscriptionPlan`, `staffAppEnabled`, `customerAppEnabled`, or `websiteEnabled` is
included in the DTO. Both cache keys (`company-capabilities:*` and
`company-caps-effective:*`) are purged atomically.

#### Task 11 — Phase 2 security test file

`test/security/14-phase2-capability-enforcement.security-spec.ts` — 4 groups:
- **P2A**: Feature gates (STARTER plan broker/maintenance route → 403; blob override → 200)
- **P2B**: App-level enforcement (staffApp/customerApp disabled → login 403, refresh 403,
  existing token on protected route 403; re-enable → 200)
- **P2C**: Creation limits (maxUsers seat count; CLIENT never blocked; reads/updates pass
  at limit; limit raise takes immediate effect; cross-tenant isolation)
- **P2D**: SUPER_ADMIN bypass (never blocked by any capability check)

### Key design decisions

- `PlanLimitService` methods take no `companyId` parameter — they read from ALS
  internally. This ensures the check always uses the authenticated tenant's identity.
- `CapabilityGuard` Stage 1 (always-check) fires for every authenticated request; Stage 2
  fires only when `@RequireCapability` is present. Notification routes are not decorated
  because Stage 1 already gates them per role.
- `AuthModule` explicitly imports `CapabilityModule` because `AuthService` depends on
  `CapabilityService` for app-level login blocking.
- Test modules provide `PlanLimitService` mock via the `@Global()` `MockPrismaModule`
  (not `providers[]` at root level, which doesn't propagate to nested imported modules).

### Files changed

| File | Change |
|---|---|
| `apps/api/src/common/capabilities/plan-limit.service.ts` | `getRequiredCompanyId()` moved inside each method; parameters removed from public API |
| `apps/api/src/modules/installments/installments.module.ts` | `@RequireCapability('feature.customerApp')` on `MeInstallmentsController` |
| `apps/api/src/modules/deposits/deposits.controller.ts` | `@RequireCapability` on 4 me/* methods |
| `apps/api/src/modules/visits/visits.controller.ts` | `@RequireCapability` on 3 me/* methods |
| `apps/api/src/modules/contracts/contracts.module.ts` | `@RequireCapability` on `myContracts` |
| `apps/api/src/modules/requests/requests.module.ts` | `@RequireCapability` on 4 me/* methods |
| `apps/api/src/modules/users/users.service.ts` | `checkUserLimit(dto.role)` replaces manual `company.maxUsers` guard |
| `apps/api/src/modules/units/units.service.ts` | `checkUnitLimit()` at top of `create()` |
| `apps/api/src/modules/projects/projects.service.ts` | `checkProjectLimit()` at top of `create()`; unused `getRequiredCompanyId` import removed |
| `apps/api/src/modules/super-admin/super-admin.service.ts` | `invalidateCache(id)` after plan/app-flag changes in `updateCompany()` |
| `apps/api/src/modules/auth/auth.module.ts` | Added `CapabilityModule` to imports (AuthService depends on CapabilityService) |
| `apps/api/src/common/guards/__tests__/capability.guard.spec.ts` | Updated for Phase 2 always-check semantics; `c[0]!` assertion fix |
| `apps/api/src/common/capabilities/__tests__/capability.service.spec.ts` | Updated `makePrisma()` to return full row; fixed schema key references |
| `apps/api/src/common/capabilities/__tests__/capability-resolution.spec.ts` | Updated `redis.del` assertions for dual-key invalidation |
| `apps/api/src/modules/units/__tests__/units-permissions.spec.ts` | `MockPrismaModule` exports `PlanLimitService` mock |
| `apps/api/src/modules/units/__tests__/public-units-contract.spec.ts` | Same |
| `apps/api/src/modules/projects/__tests__/projects-permissions.spec.ts` | Same (+ `overrideProvider(R2Service)` preserved) |
| `apps/api/src/modules/projects/__tests__/public-projects-contract.spec.ts` | Same (+ `overrideProvider(R2Service)` preserved) |
| `apps/api/src/modules/users/__tests__/users-*.spec.ts` (4 files) | Added 4th constructor arg `planLimits` mock to `new UsersService(...)` |
| `apps/api/src/modules/auth/__tests__/auth-*.spec.ts` (7 files) | Added 6th constructor arg `caps` mock to `new AuthService(...)` |
| `apps/api/eslint.config.mjs` | Added `plan-limit.service.ts` to Tier B `prisma.user` allowlist |
| `apps/api/test/security/14-phase2-capability-enforcement.security-spec.ts` | New: P2A/P2B/P2C/P2D attack matrix |

### Test results

| Suite | Before (Phase 1) | After (Phase 2) | Delta |
|---|---|---|---|
| Unit (`jest --runInBand`) | 2224 pass | **2237 pass** — directly measured at HEAD | +13 (capability.guard, plan-limit, auth, users, units, projects test fixes) |
| Security (`jest-security.json --runInBand`) | 239 pass | **257 pass** — directly measured at HEAD (`SKIP_DB_RESET=1`, 14/14 suites) | +18 (14-phase2: P2A×3, P2B×7, P2C×6, P2D×1) |
| Typecheck (`tsc --noEmit`) | 0 errors | 0 errors | 0 new errors |
| Lint (`eslint`) | 0 errors (warnings only) | 0 errors (warnings only) | 0 new issues |

---

## E2E singleton — shared NestJS app for 26-file suite

**Date:** 2026-09-19
**Status:** DONE ✓

### Motivation

Local timing (SKIP_DB_RESET=1): 14.8 s for 26 specs, 311 tests.
CI cancelled at timeout-minutes=15 every run — confirmed via GitHub API step status.
Root cause: each spec file booted its own NestJS application (ts-jest cold compile + `AppModule.onModuleInit` + Prisma connect = ~90 s × 26 files > 15 min in CI).

### Step 1 (rbac-route-coverage → unit suite) — considered and rejected

Moving `rbac-route-coverage.e2e-spec.ts` to the unit suite (`src/`) was proposed as
a free win because it only does DI reflection (no HTTP, no DB). Rejected because
`PrismaService.onModuleInit()` calls `await this.$connect()` unconditionally on
every `AppModule` boot — there is no lazy-connect option. The unit suite runs against
a placeholder `DATABASE_URL` with no real Postgres, so the boot would fail.

The spec was never part of the 26-boot pool anyway (it manages its own module and
closes itself). Calling it a free win was wrong; the correct number is 25 files with
close() calls, 23 of which share no provider overrides (the shareable pool).

Do not revisit this idea without first making `PrismaService.onModuleInit()` lazy.

### Step 2 — singleton implementation

Same Module._cache mechanism as the security suite (`createSecurityTestApp`):
- `E2E_CACHE_KEY = '\0jest-e2e-shared-app'`
- `__E2E_SINGLETON_COMPILED__` env flag + `[E2E_SINGLETON_BROKEN]` guard
- `[E2E_VM_CONTEXT_UNSAFE]` seal on `app.get()`
- `close: async () => {}` (no-op) — `forceExit: true` in jest-e2e.json handles cleanup
- ThrottlerStorage override: 23 sequential `beforeAll` logins would exhaust the
  shared per-IP window; override passes through (totalHits=1, never blocked)

**Boot categorization:**
| Category | Count | Action |
|---|---|---|
| Shareable (no provider overrides) | 23 | → `createE2ETestApp()` |
| Isolated (provider overrides) | 2 | `email-verification`, `password-reset` → `createTestApp()` unchanged |
| Standalone | 1 | `rbac-route-coverage` — manages own module, unchanged |

**Teardown changes in the 23 shared specs:**
- 18 specs: afterAll only had `testApp.close()` → entire afterAll removed
- `mt-domain-isolation`, `mt-write-isolation`: rawPrisma cleanup + remove close()
- `strict-permissions`: inner afterAll (registered inside beforeAll) + remove close()
- `mt-tenant-isolation`, `reports-mt-isolation`: converted `testApp.prisma` +
  `runTenantContext(bypass)` to `testApp.rawPrisma` (cross-vm ALS issue: the
  spec's ALS instance is different from the singleton's PrismaService middleware ALS,
  so bypass wouldn't propagate). `runTenantContext` import removed from both files.

**`signAccessToken` helper — p11 + me-reservations:**
Both files called `app.get(JwtService)` + `app.get(ConfigService)` to mint tokens.
Sealed by `[E2E_VM_CONTEXT_UNSAFE]`. Fix: added `signAccessToken(userId, role, expiresIn?)`
to the `TestApp` interface, capturing `JwtService` and `ConfigService` closures in the
singleton's vm context at compile time (same pattern as `flushCapabilities`). Both specs
updated to use `testApp.signAccessToken()`.

**p12 — kept isolated (`createTestApp`):**
`p12-contract-conversion-documents` uses `testApp.app.get(ContractsService)` and
`enterTenantContext()` directly — both are vm-context-specific and cannot be bridged
via a closure helper. Reverted to isolated `createTestApp()` with `testApp.close()` in afterAll.

**mt-tenant-isolation — Phase 2 regression fix:**
Phase 2 added `checkProjectLimit()` in `projects.service.ts::create()`. The seeded
company is on TRIAL plan (maxProjects=5) but seed bypasses the service layer and creates
6 projects. HTTP `POST /v1/projects` always returned 403 from the singleton app.
Fix: create both projects via `rawPrisma.project.create()` directly — isolation invariants
(ISO-1–ISO-4) are tested via GET endpoints only, not by the project creation path.

### Step 3 — Isolation audit + two-run confirmation

**Isolation findings:**
- `strict-permissions`: grants 22 permission codes to `admin@example.com` in beforeAll. Not
  cleaned up (no delete in afterAll), but this only adds permissions — it never removes them
  from other specs' subjects. No ordering hazard found.
- `mt-tenant-isolation` + `reports-mt-isolation`: pre-existing issue resolved (rawPrisma
  replacement). No residual ordering hazard.
- All other MT specs already used rawPrisma correctly.

**Two-run results (same 7 pre-existing failures both times):**

| Run | Order | Suites | Tests | Time |
|---|---|---|---|---|
| 1 (forward, fresh DB) | alphabetical (Jest default) | 7 fail / 19 pass | 17 fail / 294 pass | 13.82 s |
| 2 (forward, fresh DB) | alphabetical (Jest default) | 7 fail / 19 pass | 17 fail / 294 pass | 13.364 s |
| 3 (reverse, fresh DB) | reverse-alphabetical (custom sequencer) | 7 fail / 19 pass | 17 fail / 294 pass | 14.21 s |

Failing suites are identical in all three runs (pre-existing baseline from 11-tree-state.md):
`flow-e-financial-documents`, `flow-f-maintenance`, `flow-g-upload` (MinIO),
`idor-penetration`, `rbac-route-coverage`, `reports-mt-isolation`, `strict-permissions`.


