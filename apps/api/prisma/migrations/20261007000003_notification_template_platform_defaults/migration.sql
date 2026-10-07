-- FG-26 (docs/audit/08-functional-gaps.md): notification templates are platform
-- defaults with optional per-company overrides.
--
-- Before: `code` was unique platform-wide, every row was back-filled to the seed
-- company, and the model was tenant-scoped — so every other company's template
-- lookup found nothing and its notifications were never sent.

DROP INDEX "NotificationTemplate_code_key";

-- Every existing row is the seeded platform catalogue (a global-unique code
-- could only ever belong to one company). They become the platform defaults.
UPDATE "NotificationTemplate" SET "companyId" = NULL;

-- NULLS NOT DISTINCT: one platform row (companyId NULL) per code, one override
-- per company per code.
CREATE UNIQUE INDEX "NotificationTemplate_companyId_code_key"
  ON "NotificationTemplate"("companyId", "code") NULLS NOT DISTINCT;
