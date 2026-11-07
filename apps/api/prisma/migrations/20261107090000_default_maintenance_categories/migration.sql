-- Every company starts with the common maintenance categories
-- (src/modules/maintenance/maintenance-category-defaults.ts); a company with no
-- category could not receive a single maintenance request. The admin renames,
-- adds or switches them off. Companies that already have any category are left
-- alone. Data only — no schema change.
INSERT INTO "MaintenanceCategory" ("id", "code", "name", "active", "priority", "slaDurationMinutes", "createdAt", "updatedAt", "companyId")
SELECT gen_random_uuid(), d.code, d.name, true, d.priority::"MaintenancePriority", d.sla, now(), now(), c."id"
FROM "Company" c
CROSS JOIN (VALUES
  ('plumbing',   '{"ar":"سباكة","en":"Plumbing"}'::jsonb,                          'HIGH',   1440),
  ('electrical', '{"ar":"كهرباء","en":"Electrical"}'::jsonb,                       'HIGH',   1440),
  ('hvac',       '{"ar":"تكييف","en":"HVAC"}'::jsonb,                              'MEDIUM', 2880),
  ('carpentry',  '{"ar":"نجارة","en":"Carpentry"}'::jsonb,                         'LOW',    4320),
  ('painting',   '{"ar":"دهانات وتشطيبات","en":"Painting & finishing"}'::jsonb,    'LOW',    7200),
  ('general',    '{"ar":"أعمال عامة","en":"General"}'::jsonb,                      'MEDIUM', 4320)
) AS d(code, name, priority, sla)
WHERE NOT EXISTS (SELECT 1 FROM "MaintenanceCategory" m WHERE m."companyId" = c."id");
