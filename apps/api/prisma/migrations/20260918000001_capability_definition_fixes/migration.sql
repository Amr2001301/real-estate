-- Phase 1 capability definition fixes
--
-- Fix 1: Make websiteEnabled / customerAppEnabled / staffAppEnabled nullable.
--   NULL means "no explicit override — use the plan default."
--   Resolution order: column (if NOT NULL) > plan default.
--   This prevents the columns' old @default(true) from defeating the plan gate.
--
-- Fix 2: Back-fill — set each column to NULL where its current value equals
--   what the plan would give anyway (i.e., it was never a real override, just
--   the old row-creation default).  Keep the explicit value only where it
--   genuinely differs from the plan default.
--
-- Plan defaults for the three column-backed features:
--   TRIAL:        website=true  customer=true  staff=true
--   STARTER:      website=false customer=false staff=true
--   PROFESSIONAL: website=true  customer=true  staff=true
--   ENTERPRISE:   website=true  customer=true  staff=true
--   CUSTOM:       website=true  customer=true  staff=true

-- ── Step 1: remove NOT NULL constraint and old @default(true) ────────────────

ALTER TABLE "Company" ALTER COLUMN "websiteEnabled"     DROP NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "customerAppEnabled" DROP NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "staffAppEnabled"    DROP NOT NULL;

ALTER TABLE "Company" ALTER COLUMN "websiteEnabled"     DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "customerAppEnabled" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "staffAppEnabled"    DROP DEFAULT;

-- ── Step 2: back-fill NULLs where column = plan default ──────────────────────

-- TRIAL / PROFESSIONAL / ENTERPRISE / CUSTOM:
--   all three plan defaults are true → NULL out the column where it is true.
UPDATE "Company" SET
  "websiteEnabled"     = CASE WHEN "websiteEnabled"     = true THEN NULL ELSE "websiteEnabled"     END,
  "customerAppEnabled" = CASE WHEN "customerAppEnabled" = true THEN NULL ELSE "customerAppEnabled" END,
  "staffAppEnabled"    = CASE WHEN "staffAppEnabled"    = true THEN NULL ELSE "staffAppEnabled"    END
WHERE "subscriptionPlan" IN ('TRIAL', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- STARTER:
--   website default=false  → NULL where value=false, keep true (explicit enable)
--   customer default=false → NULL where value=false, keep true (explicit enable)
--   staff default=true     → NULL where value=true,  keep false (explicit disable)
UPDATE "Company" SET
  "websiteEnabled"     = CASE WHEN "websiteEnabled"     = false THEN NULL ELSE "websiteEnabled"     END,
  "customerAppEnabled" = CASE WHEN "customerAppEnabled" = false THEN NULL ELSE "customerAppEnabled" END,
  "staffAppEnabled"    = CASE WHEN "staffAppEnabled"    = true  THEN NULL ELSE "staffAppEnabled"    END
WHERE "subscriptionPlan" = 'STARTER';
