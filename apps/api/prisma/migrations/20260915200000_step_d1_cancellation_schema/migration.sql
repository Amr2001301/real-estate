-- Step D1 (09-reversal-design.md §4.1, §4.2, §4.5, §8.1 step D)
--
-- Additive changes:
--   • ContractStatus enum  (UNSIGNED | ACTIVE | CANCELLED)
--   • ClawbackStatus enum  (OUTSTANDING | COLLECTED | WAIVED)
--   • InstallmentStatus.CANCELLED added to existing enum
--   • Contract.status (default UNSIGNED) + Contract.cancelledAt
--   • InstallmentPlan.cancelledAt
--   • ContractCancellation table (TENANT_OWNED)
--   • Refund table (TENANT_OWNED)
--   • Clawback overlay columns on BrokerCommission and BonusEntry
--
-- Non-additive element — the only one:
--   BACKFILL: existing Contract rows get status = ACTIVE where signedAt IS NOT
--   NULL, UNSIGNED otherwise.  This is required so the new column is never
--   in an inconsistent state before the cancel endpoint is deployed.

-- ── New enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "ContractStatus" AS ENUM ('UNSIGNED', 'ACTIVE', 'CANCELLED');

CREATE TYPE "ClawbackStatus" AS ENUM ('OUTSTANDING', 'COLLECTED', 'WAIVED');

-- ── Extend existing InstallmentStatus enum ────────────────────────────────────

ALTER TYPE "InstallmentStatus" ADD VALUE 'CANCELLED';

-- ── Contract: add status + cancelledAt ───────────────────────────────────────

ALTER TABLE "Contract"
  ADD COLUMN "status"      "ContractStatus" NOT NULL DEFAULT 'UNSIGNED',
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- BACKFILL: contracts with signedAt set become ACTIVE; unsigned ones stay UNSIGNED.
-- This is the only non-additive element in this migration.
UPDATE "Contract"
SET "status" = CASE
  WHEN "signedAt" IS NOT NULL THEN 'ACTIVE'::"ContractStatus"
  ELSE 'UNSIGNED'::"ContractStatus"
END;

CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- ── InstallmentPlan: add cancelledAt ─────────────────────────────────────────

ALTER TABLE "InstallmentPlan"
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- ── ContractCancellation table ────────────────────────────────────────────────

CREATE TABLE "ContractCancellation" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractId"             UUID NOT NULL,
  "cancelledById"          UUID NOT NULL,
  "reason"                 VARCHAR(2000) NOT NULL,
  "cancellationDate"       TIMESTAMP(3) NOT NULL,
  "totalCollectedSnapshot" DECIMAL(14,2) NOT NULL,
  "retainedAmount"         DECIMAL(14,2) NOT NULL,
  "refundAmount"           DECIMAL(14,2) NOT NULL,
  "financialNotes"         VARCHAR(2000),
  "unitReleaseOverride"    VARCHAR(50),
  "demoteCustomerOverride" BOOLEAN,
  "commissionActionOverride" VARCHAR(20),
  "bonusActionOverride"    VARCHAR(20),
  "policySnapshot"         JSONB NOT NULL,
  "unitReleasedAt"         TIMESTAMP(3),
  "customerDemotedAt"      TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "companyId"              UUID,

  CONSTRAINT "ContractCancellation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractCancellation_contractId_key" ON "ContractCancellation"("contractId");
CREATE INDEX "ContractCancellation_contractId_idx" ON "ContractCancellation"("contractId");
CREATE INDEX "ContractCancellation_companyId_idx" ON "ContractCancellation"("companyId");

ALTER TABLE "ContractCancellation"
  ADD CONSTRAINT "ContractCancellation_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractCancellation_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractCancellation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Refund table ──────────────────────────────────────────────────────────────

CREATE TABLE "Refund" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractCancellationId" UUID NOT NULL,
  "amount"                 DECIMAL(14,2) NOT NULL,
  "paymentMethod"          "PaymentMethod" NOT NULL,
  "referenceNumber"        VARCHAR(100),
  "bankName"               VARCHAR(200),
  "paidAt"                 TIMESTAMP(3) NOT NULL,
  "notes"                  VARCHAR(2000),
  "recordedById"           UUID NOT NULL,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "companyId"              UUID,

  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Refund_contractCancellationId_idx" ON "Refund"("contractCancellationId");
CREATE INDEX "Refund_companyId_idx" ON "Refund"("companyId");

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_contractCancellationId_fkey"
    FOREIGN KEY ("contractCancellationId") REFERENCES "ContractCancellation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BrokerCommission: clawback overlay columns ────────────────────────────────

ALTER TABLE "BrokerCommission"
  ADD COLUMN "clawbackStatus"        "ClawbackStatus",
  ADD COLUMN "clawbackReason"        VARCHAR(2000),
  ADD COLUMN "clawbackAt"            TIMESTAMP(3),
  ADD COLUMN "clawbackById"          UUID,
  ADD COLUMN "clawbackCollectedAt"   TIMESTAMP(3),
  ADD COLUMN "clawbackCollectedById" UUID,
  ADD COLUMN "clawbackWaivedAt"      TIMESTAMP(3),
  ADD COLUMN "clawbackWaivedById"    UUID;

CREATE INDEX "BrokerCommission_clawbackStatus_idx" ON "BrokerCommission"("clawbackStatus");

ALTER TABLE "BrokerCommission"
  ADD CONSTRAINT "BrokerCommission_clawbackById_fkey"
    FOREIGN KEY ("clawbackById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BrokerCommission_clawbackCollectedById_fkey"
    FOREIGN KEY ("clawbackCollectedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BrokerCommission_clawbackWaivedById_fkey"
    FOREIGN KEY ("clawbackWaivedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BonusEntry: clawback overlay columns ─────────────────────────────────────

ALTER TABLE "BonusEntry"
  ADD COLUMN "clawbackStatus"        "ClawbackStatus",
  ADD COLUMN "clawbackReason"        VARCHAR(2000),
  ADD COLUMN "clawbackAt"            TIMESTAMP(3),
  ADD COLUMN "clawbackById"          UUID,
  ADD COLUMN "clawbackCollectedAt"   TIMESTAMP(3),
  ADD COLUMN "clawbackCollectedById" UUID,
  ADD COLUMN "clawbackWaivedAt"      TIMESTAMP(3),
  ADD COLUMN "clawbackWaivedById"    UUID;

CREATE INDEX "BonusEntry_clawbackStatus_idx" ON "BonusEntry"("clawbackStatus");

ALTER TABLE "BonusEntry"
  ADD CONSTRAINT "BonusEntry_clawbackById_fkey"
    FOREIGN KEY ("clawbackById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BonusEntry_clawbackCollectedById_fkey"
    FOREIGN KEY ("clawbackCollectedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BonusEntry_clawbackWaivedById_fkey"
    FOREIGN KEY ("clawbackWaivedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
