-- MT-055: Public branding fields on Company
-- All columns are nullable — existing rows stay valid with no backfill required.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ogImageUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "tagline" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactWhatsApp" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactAddress" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "officeHours" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
