-- The AI assistant, sold apart from the subscription plans: the platform's
-- question packages, each company's current one-month period, and the
-- account of activations, renewals and top-ups.
CREATE TABLE "AiPackage" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "questions" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyAiPlan" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "packageId" UUID,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "quota" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "alerted80At" TIMESTAMP(3),
    "alertedFullAt" TIMESTAMP(3),
    "alertedEndingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAiPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAiPlan_companyId_key" ON "CompanyAiPlan"("companyId");
CREATE INDEX "CompanyAiPlan_status_periodEnd_idx" ON "CompanyAiPlan"("status", "periodEnd");

CREATE TABLE "AiLedgerEntry" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "packageId" UUID,
    "questions" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(500),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiLedgerEntry_companyId_createdAt_idx" ON "AiLedgerEntry"("companyId", "createdAt");

ALTER TABLE "CompanyAiPlan" ADD CONSTRAINT "CompanyAiPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAiPlan" ADD CONSTRAINT "CompanyAiPlan_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiLedgerEntry" ADD CONSTRAINT "AiLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiLedgerEntry" ADD CONSTRAINT "AiLedgerEntry_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
