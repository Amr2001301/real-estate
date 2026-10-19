-- F11: a cash plan — no instalments; what the booking leaves is one payment
-- due at signing.
ALTER TABLE "InstallmentPlanTemplate" ADD COLUMN "isCash" BOOLEAN NOT NULL DEFAULT false;
