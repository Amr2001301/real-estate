# 10 — Reversal Layer Implementation Log

> **Source design:** `09-reversal-design.md`
> **Convention:** one entry per step, opened when work starts, closed when green.
> Format: `Step | Date | Files changed | Migration | Test delta | Status`

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
| Security (`jest-security.json`) | 66 tests (62 pass, 4 fail) | **93 tests (93 pass, 0 fail)** | +27 tests, 0 new failures |
| Unit (`jest`) | 2003 pass | **2003 pass** | 0 delta |
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
| Unit (`jest`) | 2003 pass | **2035 pass** | +32 tests, 0 new failures |
| Security (`jest-security.json`) | 115 tests (115 pass) | **123 tests (123 pass)** | +8 tests, 0 new failures |
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
