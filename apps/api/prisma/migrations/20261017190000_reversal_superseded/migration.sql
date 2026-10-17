-- A deposit approved again after a reversal counts as collected again.
ALTER TABLE "PaymentCorrection" ADD COLUMN "supersededAt" TIMESTAMP(3);

-- Deposits already re-approved after their reversal.
UPDATE "PaymentCorrection" pc
SET "supersededAt" = d."reviewedAt"
FROM "Deposit" d
WHERE d."id" = pc."depositId"
  AND pc."type" = 'REVERSAL'
  AND d."reviewStatus" = 'APPROVED'
  AND d."reviewedAt" IS NOT NULL
  AND d."reviewedAt" > pc."createdAt";
