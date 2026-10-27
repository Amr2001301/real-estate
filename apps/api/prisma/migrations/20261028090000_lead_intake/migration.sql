-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'returned';

-- CreateTable
CREATE TABLE "LeadIntakeKey" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "campaignId" UUID,
    "projectId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "LeadIntakeKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntakeKey_tokenHash_key" ON "LeadIntakeKey"("tokenHash");

-- CreateIndex
CREATE INDEX "LeadIntakeKey_companyId_idx" ON "LeadIntakeKey"("companyId");

-- AddForeignKey
ALTER TABLE "LeadIntakeKey" ADD CONSTRAINT "LeadIntakeKey_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadIntakeKey" ADD CONSTRAINT "LeadIntakeKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadIntakeKey" ADD CONSTRAINT "LeadIntakeKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

