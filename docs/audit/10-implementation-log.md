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
