-- Step 15: notification delivery tracking columns
-- Adds four nullable columns to Notification so NotificationsService.send()
-- can record the actual push and email delivery outcome, independent of the
-- existing sentAt field (which means "row created", not "delivered").
--
-- Purely additive. No type changes. No NOT NULL on existing columns.

ALTER TABLE "Notification"
  ADD COLUMN "emailSentAt"  TIMESTAMP(3),
  ADD COLUMN "emailError"   VARCHAR(500),
  ADD COLUMN "pushSentAt"   TIMESTAMP(3),
  ADD COLUMN "pushError"    VARCHAR(500);
