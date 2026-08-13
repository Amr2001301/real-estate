-- MT-Schema-04: Setting model compound PK redesign
-- Replaces the global `key @id` with a per-company `(companyId, key)` unique
-- constraint so each tenant can have its own settings namespace.
-- No existing rows to migrate (Setting table is always empty at this stage).

-- Step 1: Drop the old primary key constraint on "key"
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey";

-- Step 2: Drop the old index on companyId (replaced by unique constraint)
DROP INDEX IF EXISTS "Setting_companyId_idx";

-- Step 3: Add the new UUID primary key column
ALTER TABLE "Setting" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

-- Step 4: Make companyId non-nullable (no rows exist, safe to run directly)
ALTER TABLE "Setting" ALTER COLUMN "companyId" SET NOT NULL;

-- Step 5: Add new primary key on id
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id");

-- Step 6: Add compound unique constraint
CREATE UNIQUE INDEX "Setting_companyId_key_key" ON "Setting"("companyId", "key");

-- Step 7: Update foreign key to Cascade (was SetNull)
ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_companyId_fkey";
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
