-- F12: a company created from the platform started with no lead sources, and
-- the dashboard had no screen to add one, so its leads had no source. Give
-- every company that has none the defaults new companies now start with
-- (src/modules/leads/lead-source-defaults.ts). Data only; no schema change.
INSERT INTO "LeadSource" ("id", "name", "active", "createdAt", "companyId")
SELECT gen_random_uuid(), d.name, true, now(), c."id"
FROM "Company" c
CROSS JOIN (VALUES
  ('{"ar":"فيسبوك","en":"Facebook"}'::jsonb),
  ('{"ar":"انستغرام","en":"Instagram"}'::jsonb),
  ('{"ar":"واتساب","en":"WhatsApp"}'::jsonb),
  ('{"ar":"موقع الويب","en":"Website"}'::jsonb),
  ('{"ar":"إحالة","en":"Referral"}'::jsonb),
  ('{"ar":"زيارة مباشرة","en":"Walk-in"}'::jsonb),
  ('{"ar":"اتصال هاتفي","en":"Phone call"}'::jsonb)
) AS d(name)
WHERE NOT EXISTS (SELECT 1 FROM "LeadSource" s WHERE s."companyId" = c."id");
