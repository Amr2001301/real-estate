-- Project-level instalment plans: a plan without a unit applies to the project's
-- units (all of them, or the unit types listed), priced by percentages and worked
-- out per unit at reservation time. A plan may also be offered only between dates.
ALTER TABLE "InstallmentPlanTemplate"
  ADD COLUMN "unitTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "validTo" TIMESTAMP(3);
