-- A custom domain's state on the public website's hosting (Vercel).
ALTER TABLE "CompanyDomain"
  ADD COLUMN "hostingStatus" VARCHAR(20),
  ADD COLUMN "hostingError" VARCHAR(500),
  ADD COLUMN "hostingCheckedAt" TIMESTAMP(3),
  ADD COLUMN "hostingRecords" JSONB;
