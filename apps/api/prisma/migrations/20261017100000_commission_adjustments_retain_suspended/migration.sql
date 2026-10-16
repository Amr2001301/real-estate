-- U2b (decisions 4, 5, 6 of 2026-10-16):
--  * BrokerCommissionAdjustment: the difference when a paid commission's
--    contract price changes (TOP_UP / CLAWBACK), netted into the next payout.
--  * BonusEntry source ADJUSTMENT (+ adjustsEntryId) for the same on a paid
--    sales bonus.
--  * retainedOnCancellation: RETAIN on cancellation keeps the commission /
--    bonus payable.
--  * Broker.suspendedAt: a sale reserved before the suspension still earns.

-- CreateEnum
CREATE TYPE "BrokerCommissionAdjustmentKind" AS ENUM ('TOP_UP', 'CLAWBACK');

-- AlterEnum
ALTER TYPE "BonusEntrySource" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "BonusEntry" ADD COLUMN     "adjustsEntryId" UUID,
ADD COLUMN     "retainedOnCancellation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Broker" ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BrokerCommission" ADD COLUMN     "retainedOnCancellation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BrokerCommissionAdjustment" (
    "id" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "kind" "BrokerCommissionAdjustmentKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutId" UUID,
    "companyId" UUID,

    CONSTRAINT "BrokerCommissionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerCommissionAdjustment_brokerId_payoutId_idx" ON "BrokerCommissionAdjustment"("brokerId", "payoutId");

-- CreateIndex
CREATE INDEX "BrokerCommissionAdjustment_commissionId_idx" ON "BrokerCommissionAdjustment"("commissionId");

-- CreateIndex
CREATE INDEX "BrokerCommissionAdjustment_companyId_idx" ON "BrokerCommissionAdjustment"("companyId");

-- CreateIndex
CREATE INDEX "BonusEntry_adjustsEntryId_idx" ON "BonusEntry"("adjustsEntryId");

-- AddForeignKey
ALTER TABLE "BrokerCommissionAdjustment" ADD CONSTRAINT "BrokerCommissionAdjustment_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommissionAdjustment" ADD CONSTRAINT "BrokerCommissionAdjustment_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "BrokerCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommissionAdjustment" ADD CONSTRAINT "BrokerCommissionAdjustment_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "BrokerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommissionAdjustment" ADD CONSTRAINT "BrokerCommissionAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: cancellations already made with RETAIN (operator override, else
-- the policy in force at the time).
UPDATE "BrokerCommission" bc SET "retainedOnCancellation" = true
FROM "ContractCancellation" cc
WHERE cc."contractId" = bc."contractId"
  AND COALESCE(cc."commissionActionOverride", cc."policySnapshot"->>'commissionAction') = 'RETAIN'
  AND bc."status" NOT IN ('REJECTED', 'CANCELLED');

UPDATE "BonusEntry" be SET "retainedOnCancellation" = true
FROM "ContractCancellation" cc
WHERE cc."contractId" = be."contractId"
  AND COALESCE(cc."bonusActionOverride", cc."policySnapshot"->>'bonusAction') = 'RETAIN'
  AND be."status" <> 'CANCELLED';

-- Backfill: brokers suspended or terminated today. The exact moment was not
-- recorded; their last update is the closest known time.
UPDATE "Broker" SET "suspendedAt" = "updatedAt" WHERE "status" IN ('SUSPENDED', 'TERMINATED');

-- A bonus ADJUSTMENT carries the difference after a price change: negative
-- when the price went down. Every other entry stays strictly positive.
ALTER TABLE "BonusEntry" DROP CONSTRAINT "bonus_entry_amount_positive";
ALTER TABLE "BonusEntry"
  ADD CONSTRAINT "bonus_entry_amount_positive"
  CHECK ("amount" > 0 OR ("source"::text = 'ADJUSTMENT' AND "amount" <> 0));

-- An adjustment's direction is its kind; the amount is always positive.
ALTER TABLE "BrokerCommissionAdjustment"
  ADD CONSTRAINT "broker_commission_adjustment_amount_positive"
  CHECK ("amount" > 0);
