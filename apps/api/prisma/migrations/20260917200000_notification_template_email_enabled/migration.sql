-- Part C: single source of truth for notification email eligibility.
-- Adds emailEnabled to NotificationTemplate so the admin dashboard can see and
-- toggle email delivery without consulting a hardcoded runtime Set.
-- Default false: every existing row keeps its current behaviour until the
-- backfill below sets the flag for the 23 codes that were in
-- EMAIL_ELIGIBLE_TEMPLATES at the time of this migration.

ALTER TABLE "NotificationTemplate" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: exactly the 23 codes that were in EMAIL_ELIGIBLE_TEMPLATES.
-- No template gains or loses email delivery compared to today's runtime
-- behaviour. Any code absent from this list stays emailEnabled = false.
UPDATE "NotificationTemplate"
SET "emailEnabled" = true
WHERE code IN (
  'reservation_status_changed',
  'reservation_submitted_admin',
  'reservation_payment_requested',
  'reservation_booking_paid',
  'reservation_expired',
  'contract_created_customer',
  'contract_signed_customer',
  'contract_document_available',
  'deposit_recorded',
  'deposit_verified',
  'maintenance_request_created',
  'maintenance_request_assigned',
  'maintenance_request_resolved',
  'maintenance_request_closed',
  'maintenance_request_status_changed',
  'installment_due_soon',
  'installment_plan_created',
  'broker_approved',
  'broker_suspended',
  'user_account_approved',
  'user_account_suspended',
  'payment_proof_approved',
  'payment_proof_rejected'
);
