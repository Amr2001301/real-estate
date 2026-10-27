-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'GOOGLE', 'SNAPCHAT', 'WHATSAPP', 'SMS', 'EMAIL', 'BILLBOARD', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "campaignId" UUID;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "projectId" UUID,
    "sourceId" UUID,
    "startDate" DATE,
    "endDate" DATE,
    "budget" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSpend" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "spentOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "CampaignSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_companyId_code_key" ON "Campaign"("companyId", "code");

-- CreateIndex
CREATE INDEX "CampaignSpend_campaignId_spentOn_idx" ON "CampaignSpend"("campaignId", "spentOn");

-- CreateIndex
CREATE INDEX "CampaignSpend_companyId_idx" ON "CampaignSpend"("companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_campaignId_idx" ON "Lead"("companyId", "campaignId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSpend" ADD CONSTRAINT "CampaignSpend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSpend" ADD CONSTRAINT "CampaignSpend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Managing campaigns and their spend is its own permission; every current
-- admin gets it (admins added later get it from their role defaults).
INSERT INTO "Permission" ("id", "code", "description")
VALUES (gen_random_uuid(), 'campaigns:manage', 'Manage marketing campaigns and their spend')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT u."id", p."id"
FROM "User" u
CROSS JOIN "Permission" p
WHERE p."code" = 'campaigns:manage'
  AND u."role" = 'ADMIN'
  AND u."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
