-- Late-payment fee: a LATE_FEE plan row linked to the installment it was
-- charged on; waivedAt marks a fee the company waived.
ALTER TYPE "PlanPaymentType" ADD VALUE 'LATE_FEE';

ALTER TABLE "Installment" ADD COLUMN "feeForId" UUID;
ALTER TABLE "Installment" ADD COLUMN "waivedAt" TIMESTAMP(3);

CREATE INDEX "Installment_feeForId_idx" ON "Installment"("feeForId");

ALTER TABLE "Installment" ADD CONSTRAINT "Installment_feeForId_fkey"
  FOREIGN KEY ("feeForId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every company gets the settings, switched off, so they show on the
-- settings page with their defaults.
INSERT INTO "Setting" ("id", "companyId", "key", "value", "updatedAt")
SELECT gen_random_uuid(), c."id", d.key, d.value::jsonb, NOW()
FROM "Company" c
CROSS JOIN (VALUES
  ('lateFee.enabled', 'false'),
  ('lateFee.graceDays', '7'),
  ('lateFee.mode', '"PERCENT"'),
  ('lateFee.value', '1'),
  ('lateFee.repeat', '"ONCE"'),
  ('lateFee.maxPerInstallment', '0')
) AS d(key, value)
ON CONFLICT ("companyId", "key") DO NOTHING;
