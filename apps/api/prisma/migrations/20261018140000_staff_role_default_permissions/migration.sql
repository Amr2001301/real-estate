-- Staff created from the dashboard got no permission codes, so every page
-- refused them until an admin ticked each box by hand. New users now get
-- their role's tier on creation (src/modules/permissions/
-- role-default-permissions.ts); this gives the same tier to staff who have
-- no codes at all. Anyone with at least one code was configured by an admin
-- and is left as is. Codes missing from the catalog are skipped.

WITH sales AS (
  SELECT unnest(ARRAY[
    'leads:read', 'leads:create', 'leads:update', 'leads:note', 'leads:assign', 'leads:advance-stage',
    'visits:read', 'visits:create', 'visits:schedule', 'visits:confirm', 'visits:complete',
    'visits:reschedule', 'visits:cancel', 'visits:no-show',
    'reservations:read', 'reservations:create', 'reservations:update',
    'contracts:read',
    'projects:read', 'units:read', 'installments:read', 'deposits:read',
    'bonus:entries:read', 'targets:read',
    'broker_leads:read', 'broker_contracts:read', 'broker_reservations:read'
  ]) AS code
),
tier AS (
  SELECT 'SALES'::text AS role, code FROM sales
  UNION ALL SELECT 'SALES_MANAGER', code FROM sales
  UNION ALL SELECT 'SALES_MANAGER', 'targets:manage'
  UNION ALL SELECT 'MAINTENANCE_SUPERVISOR', 'maintenance:read'
  UNION ALL SELECT 'MAINTENANCE_SUPERVISOR', 'maintenance:resolve'
  UNION ALL SELECT 'ADMIN', p.code FROM "Permission" p
),
bare AS (
  SELECT u.id, u.role::text AS role
  FROM "User" u
  WHERE u."companyId" IS NOT NULL
    AND u.role::text IN ('ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR')
    AND NOT EXISTS (SELECT 1 FROM "UserPermission" up WHERE up."userId" = u.id)
)
INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT b.id, p.id
FROM bare b
JOIN tier t ON t.role = b.role
JOIN "Permission" p ON p.code = t.code
ON CONFLICT DO NOTHING;
