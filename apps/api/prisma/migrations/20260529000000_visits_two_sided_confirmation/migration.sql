-- P2: Two-sided visit confirmation workflow.
-- All operations are additive; no destructive data changes. Safe to run
-- against an existing DB. The data backfill at the bottom uses defensive
-- WHERE clauses so it can be re-applied (or skipped silently) without
-- clobbering rows the application has already updated.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Enum: add AppointmentStatus.PENDING_RESCHEDULE
--    Postgres ALTER TYPE ... ADD VALUE is the documented additive form;
--    `IF NOT EXISTS` lets the migration be re-applied without error.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING_RESCHEDULE';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Enum: add four VisitActivityType values for the two-sided flow.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE "VisitActivityType" ADD VALUE IF NOT EXISTS 'CUSTOMER_CONFIRMED';
ALTER TYPE "VisitActivityType" ADD VALUE IF NOT EXISTS 'CUSTOMER_RESCHEDULE_REQUESTED';
ALTER TYPE "VisitActivityType" ADD VALUE IF NOT EXISTS 'REMINDER_SENT';
ALTER TYPE "VisitActivityType" ADD VALUE IF NOT EXISTS 'SALES_REASSIGNED';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Backfill of pre-P1 visit-request rows.
--    P1 started writing customer message to both `notes` and `requestNotes`
--    and started populating `preferredTime`. Old rows have null in the new
--    columns. These two updates patch them without overwriting anything an
--    admin or the post-P1 path may have already set.
--
--    Both statements are idempotent — re-running them is a no-op.
-- ─────────────────────────────────────────────────────────────────────────

-- 3a. Mirror legacy `notes` into `requestNotes` where the latter is still null.
UPDATE "VisitRequest"
SET "requestNotes" = "notes"
WHERE "requestNotes" IS NULL
  AND "notes" IS NOT NULL;

-- 3b. Derive HH:mm from `preferredDate` for rows with no `preferredTime`.
--    `to_char` returns a stable two-digit hour:minute string in the column's
--    local timezone, matching what the application now writes.
UPDATE "VisitRequest"
SET "preferredTime" = to_char("preferredDate", 'HH24:MI')
WHERE "preferredTime" IS NULL
  AND "preferredDate" IS NOT NULL;
