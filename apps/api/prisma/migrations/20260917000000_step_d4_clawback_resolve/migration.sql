-- Step D4: clawback collect / waive
-- Purely additive: new enum value + 4 nullable columns on BrokerCommission and BonusEntry.
-- No drops. No type changes. No NOT NULL on existing columns.

-- 1. New ClawbackStatus value for partial repayment
ALTER TYPE "ClawbackStatus" ADD VALUE 'PARTIALLY_COLLECTED';

-- 2. BrokerCommission — financial detail columns for collect/waive
ALTER TABLE "BrokerCommission"
  ADD COLUMN "clawbackCollectedAmount"        DECIMAL(14,2),
  ADD COLUMN "clawbackCollectedReference"     VARCHAR(100),
  ADD COLUMN "clawbackCollectedPaymentMethod" "PaymentMethod",
  ADD COLUMN "clawbackWaiveReason"            VARCHAR(2000);

-- 3. BonusEntry — same columns
ALTER TABLE "BonusEntry"
  ADD COLUMN "clawbackCollectedAmount"        DECIMAL(14,2),
  ADD COLUMN "clawbackCollectedReference"     VARCHAR(100),
  ADD COLUMN "clawbackCollectedPaymentMethod" "PaymentMethod",
  ADD COLUMN "clawbackWaiveReason"            VARCHAR(2000);
