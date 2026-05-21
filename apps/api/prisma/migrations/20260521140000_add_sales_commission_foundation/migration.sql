-- Schema foundation for automatic sales-commission generation (Batch A).
-- Purely additive: no data rewrite, no behavior change. Existing BonusEntry rows
-- become source = 'MANUAL' with NULL contract/audit fields; existing BonusRule
-- rows get autoApplyOnSignedContract = false. Nothing is generated yet.

-- CreateEnum
CREATE TYPE "BonusEntrySource" AS ENUM ('MANUAL', 'CONTRACT_AUTO');

-- AlterTable: BonusRule — opt-in flag for auto sales commission on contract sign.
ALTER TABLE "BonusRule" ADD COLUMN "autoApplyOnSignedContract" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: BonusEntry — auto-commission provenance (all additive).
ALTER TABLE "BonusEntry" ADD COLUMN "source" "BonusEntrySource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "BonusEntry" ADD COLUMN "contractId" UUID;
ALTER TABLE "BonusEntry" ADD COLUMN "basisAmount" DECIMAL(14,2);
ALTER TABLE "BonusEntry" ADD COLUMN "commissionPct" DECIMAL(5,2);

-- CreateIndex: at most one BonusEntry per contract (Postgres allows multiple
-- NULLs, so manual entries are unconstrained).
CREATE UNIQUE INDEX "BonusEntry_contractId_key" ON "BonusEntry"("contractId");

-- AddForeignKey: SET NULL on contract deletion preserves the compensation record.
ALTER TABLE "BonusEntry" ADD CONSTRAINT "BonusEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
