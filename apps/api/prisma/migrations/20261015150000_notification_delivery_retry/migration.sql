-- FG-09 — redelivery of failed push / e-mail notifications.
ALTER TABLE "Notification" ADD COLUMN "deliveryRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRetryAt" TIMESTAMP(3);

-- The retry job scans the last 24 hours of notifications.
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
