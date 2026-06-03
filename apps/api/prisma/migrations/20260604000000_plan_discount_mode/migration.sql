-- Installment-plan discount: fixed-or-percentage mode.
--
-- Mirrors the downPaymentType/reservationAmountType pattern. Additive only:
-- two new columns with safe defaults, then backfill the value from the existing
-- (fixed) discountAmount so every existing plan keeps its current behaviour
-- (type=FIXED, value=amount). `discountAmount` remains the computed amount.

ALTER TABLE "InstallmentPlanTemplate"
  ADD COLUMN "discountType" "DownPaymentType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "discountValue" DECIMAL(14, 2) NOT NULL DEFAULT 0;

UPDATE "InstallmentPlanTemplate"
  SET "discountValue" = "discountAmount";
