-- Facebook / Instagram lead ads linked straight to a company's Page.
CREATE TABLE "MetaConnection" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "pageId" VARCHAR(64) NOT NULL,
  "pageName" VARCHAR(200) NOT NULL,
  "tokenEnc" TEXT NOT NULL,
  "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  "campaignId" UUID,
  "projectId" UUID,
  "connectedById" UUID,
  "lastLeadAt" TIMESTAMP(3),
  "leadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetaConnection_pageId_key" ON "MetaConnection"("pageId");
CREATE INDEX "MetaConnection_companyId_idx" ON "MetaConnection"("companyId");
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MetaLeadReceipt" (
  "leadgenId" VARCHAR(64) NOT NULL,
  "companyId" UUID NOT NULL,
  "leadId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaLeadReceipt_pkey" PRIMARY KEY ("leadgenId")
);
CREATE INDEX "MetaLeadReceipt_companyId_idx" ON "MetaLeadReceipt"("companyId");
