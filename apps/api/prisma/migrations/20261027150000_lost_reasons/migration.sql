-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "lostNote" TEXT,
ADD COLUMN     "lostReasonId" UUID;

-- CreateTable
CREATE TABLE "LostReason" (
    "id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "LostReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LostReason_companyId_idx" ON "LostReason"("companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_lostReasonId_idx" ON "Lead"("companyId", "lostReasonId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostReason" ADD CONSTRAINT "LostReason_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every company starts with the common reasons (src/modules/leads/lost-reason-defaults.ts);
-- the admin renames, adds or switches them off.
INSERT INTO "LostReason" ("id", "name", "active", "sortOrder", "createdAt", "companyId")
SELECT gen_random_uuid(), d.name, true, d.ord, now(), c."id"
FROM "Company" c
CROSS JOIN (VALUES
  ('{"ar":"السعر مرتفع","en":"Price too high"}'::jsonb, 1),
  ('{"ar":"اشترى من منافس","en":"Bought from a competitor"}'::jsonb, 2),
  ('{"ar":"الموقع غير مناسب","en":"Location not suitable"}'::jsonb, 3),
  ('{"ar":"المساحة أو التصميم غير مناسب","en":"Size or layout not suitable"}'::jsonb, 4),
  ('{"ar":"نظام السداد غير مناسب","en":"Payment plan not suitable"}'::jsonb, 5),
  ('{"ar":"موعد التسليم بعيد","en":"Delivery too far"}'::jsonb, 6),
  ('{"ar":"أجّل قرار الشراء","en":"Postponed the purchase"}'::jsonb, 7),
  ('{"ar":"لا يرد / تعذّر التواصل","en":"Unreachable"}'::jsonb, 8),
  ('{"ar":"غير جاد","en":"Not serious"}'::jsonb, 9),
  ('{"ar":"أخرى","en":"Other"}'::jsonb, 10)
) AS d(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM "LostReason" r WHERE r."companyId" = c."id");

-- Leads already lost: when they were lost is when their stage last changed.
UPDATE "Lead" SET "lostAt" = "stageChangedAt" WHERE "stage" = 'LOST' AND "lostAt" IS NULL;
