-- A discount above the company's cap (setting pricing.maxDiscountPct) needs
-- this permission. Admins could give any discount until now, so every current
-- admin keeps that power; admins added later get it only when granted.
INSERT INTO "Permission" ("id", "code", "description")
VALUES (gen_random_uuid(), 'pricing:approve-discount', 'Give a discount above the company cap (pricing.maxDiscountPct)')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT u."id", p."id"
FROM "User" u
CROSS JOIN "Permission" p
WHERE p."code" = 'pricing:approve-discount'
  AND u."role" = 'ADMIN'
  AND u."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
