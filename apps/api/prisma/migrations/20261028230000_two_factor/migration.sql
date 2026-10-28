-- TFA1 — two-step sign-in (authenticator app)
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "totpRecoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "totpFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totpLockedUntil" TIMESTAMP(3);
