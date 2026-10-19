-- F17: sales managers approve and reject their team's reservations. New
-- managers get both codes with their role tier (role-default-permissions.ts);
-- this gives them to the managers who already exist. Data only.
INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT u.id, p.id
FROM "User" u
JOIN "Permission" p ON p.code IN ('reservations:approve', 'reservations:reject')
WHERE u.role::text = 'SALES_MANAGER'
  AND u."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
