-- A phone proven by an OTP sign-in. Only a verified phone (or a verified
-- email) may link an account to CRM records that carry it.
ALTER TABLE "User" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- Backfill: a user without a password who has signed in did so with an OTP,
-- which proved the phone.
UPDATE "User"
SET "phoneVerifiedAt" = "lastLoginAt"
WHERE "passwordHash" IS NULL AND "lastLoginAt" IS NOT NULL AND "phone" IS NOT NULL;
