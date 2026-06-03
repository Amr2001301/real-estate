-- Installment-plan booking/reservation amount: fixed-or-percentage mode.
--
-- Mirrors the existing downPaymentType/downPaymentValue pattern. Additive only:
-- two new columns with safe defaults, then backfill the value from the existing
-- (fixed) reservationAmount so every existing plan keeps its current behaviour
-- (type=FIXED, value=amount). `reservationAmount` remains the computed amount.

ALTER TABLE "InstallmentPlanTemplate"
  ADD COLUMN "reservationAmountType" "DownPaymentType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "reservationAmountValue" DECIMAL(14, 2) NOT NULL DEFAULT 0;

UPDATE "InstallmentPlanTemplate"
  SET "reservationAmountValue" = "reservationAmount";
