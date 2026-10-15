-- Per-user e-mail / push opt-outs by notification group. NULL = every channel
-- on (the default for everyone today); in-app notifications are never off.
ALTER TABLE "User" ADD COLUMN "notificationPrefs" JSONB;
