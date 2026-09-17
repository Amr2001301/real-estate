-- Phase 1: Convert PricingPackage.planTier from plain String to SubscriptionPlan enum.
-- Rationale: planTier and Company.subscriptionPlan represent the same domain concept;
-- sharing one enum eliminates the risk of a planTier value that has no subscriptionPlan
-- counterpart. No live customers, so the type change is cheap today.

-- 1. Add CUSTOM to the existing SubscriptionPlan enum.
--    IF NOT EXISTS prevents the migration from failing if re-run (idempotent).
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- 2. Drop the existing planTier index before the type change (index rebuild
--    would be required anyway after an ALTER COLUMN TYPE).
DROP INDEX IF EXISTS "PricingPackage_planTier_idx";

-- 3. Cast planTier from text to SubscriptionPlan.
--    The USING expression performs an explicit cast; rows whose planTier value
--    is not a valid enum member will cause the migration to fail (the right
--    behaviour — surface data problems at migration time, not at query time).
ALTER TABLE "PricingPackage"
  ALTER COLUMN "planTier" TYPE "SubscriptionPlan"
  USING "planTier"::"SubscriptionPlan";

-- 4. Recreate the index after the type change.
CREATE INDEX "PricingPackage_planTier_idx" ON "PricingPackage"("planTier");
