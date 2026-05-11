-- Link CRM Leads to Client (User) records.
--
-- Strategy:
--   1. Add Lead.clientId as nullable.
--   2. Backfill in three passes:
--        a) Existing User with same phone.
--        b) Existing User with same email (only when no phone match).
--        c) For the rest, create User stubs (role = CLIENT) deduped by phone,
--           then link.
--   3. Sanity-check no rows remain unlinked.
--   4. Promote Lead.clientId to NOT NULL and add the FK + index.
--
-- The migration is idempotent for the schema steps; the backfill UPDATEs/INSERT
-- only touch rows that haven't been linked yet.

-- Ensure gen_random_uuid() is available. Postgres 13+ has it built-in; on
-- older or managed instances it may be provided by the pgcrypto extension.
-- Both forms are safe and idempotent.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Add column (nullable for now)
ALTER TABLE "Lead" ADD COLUMN "clientId" UUID;

-- 2a. Match existing users by phone.
UPDATE "Lead" l
SET "clientId" = u.id
FROM "User" u
WHERE l."clientId" IS NULL
  AND l.phone IS NOT NULL
  AND u.phone = l.phone;

-- 2b. Match remaining leads by email (when the lead has an email and the
--     existing user record has the same email and no phone collision).
UPDATE "Lead" l
SET "clientId" = u.id
FROM "User" u
WHERE l."clientId" IS NULL
  AND l.email IS NOT NULL
  AND u.email = l.email;

-- 2c. Create User stubs for unmatched leads.
--     Dedupe by phone first (since the same phone can appear on multiple
--     historical leads) and skip emails that collide with an existing User.
WITH unmatched AS (
  SELECT DISTINCT ON (l.phone)
    l.phone,
    l."fullName",
    l.email,
    l."createdAt"
  FROM "Lead" l
  WHERE l."clientId" IS NULL
    AND l.phone IS NOT NULL
  ORDER BY l.phone, l."createdAt" ASC
)
INSERT INTO "User" (
  id, role, "fullName", phone, email, locale, active, "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'CLIENT',
  COALESCE(NULLIF(um."fullName", ''), 'Unknown'),
  um.phone,
  CASE
    WHEN um.email IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM "User" u2 WHERE u2.email = um.email) THEN NULL
    ELSE um.email
  END,
  'ar',
  TRUE,
  um."createdAt",
  um."createdAt"
FROM unmatched um
ON CONFLICT (phone) DO NOTHING;

-- Re-link freshly-created users.
UPDATE "Lead" l
SET "clientId" = u.id
FROM "User" u
WHERE l."clientId" IS NULL
  AND l.phone IS NOT NULL
  AND u.phone = l.phone;

-- 3. Sanity check: every Lead should now have a clientId. Fail loudly otherwise
--    so we don't silently corrupt data with a NOT NULL constraint.
DO $$
DECLARE
  unlinked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unlinked_count FROM "Lead" WHERE "clientId" IS NULL;
  IF unlinked_count > 0 THEN
    RAISE EXCEPTION 'Lead backfill incomplete: % rows still have NULL clientId', unlinked_count;
  END IF;
END $$;

-- 4. Lock it down.
ALTER TABLE "Lead" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");
