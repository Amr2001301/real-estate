-- Balloon plans: a big payment every 3/6/12 months beside a small (or zero)
-- monthly one. Additive, all nullable: existing plans stay ordinary plans.
ALTER TABLE "InstallmentPlanTemplate" ADD COLUMN "balloonSharePct" DECIMAL(5,2);
ALTER TABLE "InstallmentPlanTemplate" ADD COLUMN "balloonEveryMonths" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "snapshotBalloonAmount" DECIMAL(14,2);
ALTER TABLE "Reservation" ADD COLUMN "snapshotBalloonEveryMonths" INTEGER;
ALTER TABLE "InstallmentPlan" ADD COLUMN "balloonAmount" DECIMAL(14,2);
ALTER TABLE "InstallmentPlan" ADD COLUMN "balloonEveryMonths" INTEGER;
