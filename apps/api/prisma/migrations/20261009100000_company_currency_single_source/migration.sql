-- One currency per company, shown everywhere (dashboard for every role, broker
-- portal, public site, mobile apps, notifications, chat): "Company"."currency".
--
-- Before, the dashboard read a free-text `reports.currency` setting (admins
-- only — every other role silently got SAR), the site and apps hard-coded EGP,
-- and Company.currency defaulted to SAR while nothing displayed it.

-- 1. New companies default to Egypt.
ALTER TABLE "Company" ALTER COLUMN "currency" SET DEFAULT 'EGP';
ALTER TABLE "Company" ALTER COLUMN "timezone" SET DEFAULT 'Africa/Cairo';

-- 2. A company that chose a currency in the old setting keeps it.
UPDATE "Company" c
SET "currency" = UPPER(TRIM(s."value" #>> '{}'))
FROM "Setting" s
WHERE s."companyId" = c."id"
  AND s."key" = 'reports.currency'
  AND UPPER(TRIM(s."value" #>> '{}')) IN ('EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'USD');

-- 3. An Egyptian company still on the old SAR default, that never chose a
--    currency, is moved to EGP (the SAR default never matched it).
UPDATE "Company" c
SET "currency" = 'EGP'
WHERE c."country" = 'EG'
  AND c."currency" = 'SAR'
  AND NOT EXISTS (
    SELECT 1 FROM "Setting" s
    WHERE s."companyId" = c."id" AND s."key" = 'reports.currency'
      AND UPPER(TRIM(s."value" #>> '{}')) = 'SAR'
  );

-- 4. The setting is replaced by Company.currency; the API now refuses it.
DELETE FROM "Setting" WHERE "key" = 'reports.currency';
