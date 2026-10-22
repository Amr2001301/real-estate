-- When a bonus entry was approved (owed to the sales person from then).
ALTER TABLE "BonusEntry" ADD COLUMN "approvedAt" TIMESTAMP(3);
-- Bonuses approved or paid before the column existed: their creation is
-- the closest date known.
UPDATE "BonusEntry" SET "approvedAt" = "createdAt" WHERE "status" IN ('APPROVED', 'PAID') AND "approvedAt" IS NULL;
