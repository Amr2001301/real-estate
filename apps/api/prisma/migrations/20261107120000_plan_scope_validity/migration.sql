-- Project-level instalment plans: a plan without a unit applies to the project's
-- units (all of them, or the unit types listed). `percentPriced` marks a plan that
-- holds percentages and is worked out per unit at reservation time; an older
-- unit-less plan (absolute amounts) keeps `false` and is used as stored. A plan may
-- also be offered only between dates.
ALTER TABLE "InstallmentPlanTemplate"
  ADD COLUMN "percentPriced" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unitTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "validTo" TIMESTAMP(3);
