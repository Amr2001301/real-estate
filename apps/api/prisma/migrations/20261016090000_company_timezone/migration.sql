-- The company's time zone decides when an installment's due day has ended.
INSERT INTO "Setting" ("id", "companyId", "key", "value", "updatedAt")
SELECT gen_random_uuid(), c."id", 'company.timezone', '"Africa/Cairo"'::jsonb, NOW()
FROM "Company" c
ON CONFLICT ("companyId", "key") DO NOTHING;
