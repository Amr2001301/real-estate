-- A reservation on a plan priced by instalment count (quarterly, semi-annual,
-- yearly) records how often its rows fall; null = monthly.
ALTER TABLE "Reservation" ADD COLUMN "snapshotFrequency" "InstallmentFrequency";

-- Open reservations made on such a plan before it was snapshotted have no
-- snapshot, so they could never be converted. Take it from the plan, as
-- countPlanSnapshot() does for new ones: no markup, rows = the plan's count,
-- the per-row amount rounded down (conversion puts the rest on the last row).
WITH snap AS (
  SELECT r.id,
         t."installmentsCount" AS n,
         t."installmentsCount" * CASE t."frequency"
           WHEN 'QUARTERLY' THEN 3 WHEN 'SEMI_ANNUAL' THEN 6 WHEN 'YEARLY' THEN 12 ELSE 1 END AS months,
         t."frequency",
         t."downPaymentAmount" AS dp,
         t."finalPaymentAmount" AS fin,
         r."bookingAmount" AS booking,
         t."netPrice" - r."bookingAmount" - t."downPaymentAmount" - COALESCE(t."finalPaymentAmount", 0) AS rem
  FROM "Reservation" r
  JOIN "InstallmentPlanTemplate" t ON t.id = r."installmentPlanTemplateId"
  WHERE r."selectedDurationMonths" IS NULL
    AND r."status" IN ('PENDING', 'APPROVED')
    AND r."deletedAt" IS NULL
    AND t."installmentsCount" > 0
    AND NOT EXISTS (SELECT 1 FROM "InstallmentPlanDurationOption" o WHERE o."planId" = t.id)
)
UPDATE "Reservation" r
SET "selectedDurationMonths"     = snap.months,
    "selectedIncreasePercentage" = 0,
    "snapshotDownPaymentAmount"  = snap.dp,
    "snapshotRemainingAmount"    = snap.rem,
    "snapshotFinancedAmount"     = snap.rem,
    "snapshotMonthlyInstallment" = floor(snap.rem * 100 / snap.n) / 100,
    "snapshotTotalPayable"       = snap.booking + snap.dp + snap.rem + COALESCE(snap.fin, 0),
    "snapshotFinalPaymentAmount" = snap.fin,
    "snapshotFrequency"          = snap."frequency"
FROM snap
WHERE r.id = snap.id
  AND snap.rem >= 0;
