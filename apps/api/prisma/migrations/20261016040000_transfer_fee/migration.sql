-- Transfer fee (تنازل): a TRANSFER_FEE plan row, recorded on the amendment.
ALTER TYPE "PlanPaymentType" ADD VALUE 'TRANSFER_FEE';

ALTER TABLE "ContractAmendment" ADD COLUMN "feeAmount" DECIMAL(14,2);

-- Every company gets the settings, switched off.
INSERT INTO "Setting" ("id", "companyId", "key", "value", "updatedAt")
SELECT gen_random_uuid(), c."id", d.key, d.value::jsonb, NOW()
FROM "Company" c
CROSS JOIN (VALUES
  ('transferFee.enabled', 'false'),
  ('transferFee.mode', '"PERCENT"'),
  ('transferFee.value', '1')
) AS d(key, value)
ON CONFLICT ("companyId", "key") DO NOTHING;
