-- P11 — Manual/offline payment-proof review on Deposit.
--
-- Two new enums + six new columns + three indexes + two FKs. Legacy
-- `verified Boolean` is kept; new code reads `reviewStatus` and the boolean
-- mirrors it (true iff APPROVED). Backfill maps existing rows:
--   * verified=true                              → APPROVED
--   * verified=false AND receiptUrl IS NOT NULL  → PENDING_REVIEW
--   * else                                       → NO_PROOF (the default).

CREATE TYPE "DepositReviewStatus" AS ENUM ('NO_PROOF', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

ALTER TABLE "Deposit"
  ADD COLUMN "reviewStatus" "DepositReviewStatus" NOT NULL DEFAULT 'NO_PROOF',
  ADD COLUMN "rejectionReason" VARCHAR(2000),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" UUID,
  ADD COLUMN "proofDocumentId" UUID,
  ADD COLUMN "paymentMethod" "PaymentMethod";

CREATE INDEX "Deposit_reviewStatus_idx" ON "Deposit"("reviewStatus");
CREATE INDEX "Deposit_reviewedById_idx" ON "Deposit"("reviewedById");
CREATE INDEX "Deposit_proofDocumentId_idx" ON "Deposit"("proofDocumentId");

ALTER TABLE "Deposit"
  ADD CONSTRAINT "Deposit_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Deposit_proofDocumentId_fkey"
    FOREIGN KEY ("proofDocumentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Idempotent backfill. Safe to re-run because the WHERE clauses gate by both
-- the legacy field AND the current reviewStatus default (rows already moved
-- away from NO_PROOF are not re-touched).
UPDATE "Deposit"
   SET "reviewStatus" = 'APPROVED'
 WHERE "verified" = true
   AND "reviewStatus" = 'NO_PROOF';

UPDATE "Deposit"
   SET "reviewStatus" = 'PENDING_REVIEW'
 WHERE "verified" = false
   AND "receiptUrl" IS NOT NULL
   AND "reviewStatus" = 'NO_PROOF';
