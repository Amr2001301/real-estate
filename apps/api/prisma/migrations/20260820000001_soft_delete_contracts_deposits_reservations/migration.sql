-- Add soft-delete support to Contract, Reservation, and Deposit.
-- Existing records remain active (deletedAt IS NULL).

ALTER TABLE "Contract"     ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Reservation"  ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Deposit"      ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Contract_deletedAt_idx"    ON "Contract"("deletedAt");
CREATE INDEX "Reservation_deletedAt_idx" ON "Reservation"("deletedAt");
CREATE INDEX "Deposit_deletedAt_idx"     ON "Deposit"("deletedAt");
