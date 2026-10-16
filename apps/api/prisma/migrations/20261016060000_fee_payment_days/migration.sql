-- Payment period for fees (late fee, transfer fee) before they are overdue.
INSERT INTO "Setting" ("id", "companyId", "key", "value", "updatedAt")
SELECT gen_random_uuid(), c."id", 'fees.paymentDays', '14'::jsonb, NOW()
FROM "Company" c
ON CONFLICT ("companyId", "key") DO NOTHING;
