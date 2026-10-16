-- Open reservations whose plan has a final (balloon) payment were priced with
-- that payment left inside the monthly split, so converting them would bill
-- it twice (monthly rows + a final row). Re-price their snapshot the way the
-- code now does: the final payment comes out before the split (and before
-- the increase), the monthly amount is rounded down to the cent, and the
-- total gains the final payment once.
WITH fixed AS (
  SELECT
    r."id",
    GREATEST(0, r."snapshotRemainingAmount" - r."snapshotFinalPaymentAmount") AS remaining,
    ROUND(
      GREATEST(0, r."snapshotRemainingAmount" - r."snapshotFinalPaymentAmount")
        * (1 + COALESCE(r."selectedIncreasePercentage", 0) / 100),
      2
    ) AS financed
  FROM "Reservation" r
  WHERE r."status" IN ('PENDING', 'APPROVED')
    AND r."snapshotFinalPaymentAmount" > 0
    AND r."selectedDurationMonths" > 0
    AND r."snapshotRemainingAmount" IS NOT NULL
    AND r."snapshotFinancedAmount" IS NOT NULL
    AND r."snapshotTotalPayable" IS NOT NULL
)
UPDATE "Reservation" r
SET
  "snapshotRemainingAmount"    = f.remaining,
  "snapshotFinancedAmount"     = f.financed,
  "snapshotMonthlyInstallment" = FLOOR(f.financed * 100 / r."selectedDurationMonths") / 100,
  "snapshotTotalPayable"       = r."snapshotTotalPayable" - r."snapshotFinancedAmount" + f.financed + r."snapshotFinalPaymentAmount"
FROM fixed f
WHERE r."id" = f."id";
