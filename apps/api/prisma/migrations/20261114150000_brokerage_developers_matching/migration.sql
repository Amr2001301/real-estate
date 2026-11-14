-- CreateEnum
CREATE TYPE "PlanFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "developerProjectId" UUID;

-- CreateTable
CREATE TABLE "BrokerDeveloper" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "defaultCommissionPct" DECIMAL(5,2),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "BrokerDeveloper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperProject" (
    "id" UUID NOT NULL,
    "developerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "commissionPct" DECIMAL(5,2),
    "deliveryDate" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "DeveloperProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperPlan" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "downPaymentPct" DECIMAL(5,2) NOT NULL,
    "years" INTEGER NOT NULL,
    "frequency" "PlanFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "deliveryPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cashDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "DeveloperPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadRequirement" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "kinds" "ListingKind"[],
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "cities" TEXT[],
    "unitTypes" TEXT[],
    "bedroomsMin" INTEGER,
    "areaMin" DOUBLE PRECISION,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "LeadRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerDeveloper_companyId_name_key" ON "BrokerDeveloper"("companyId", "name");

-- CreateIndex
CREATE INDEX "DeveloperProject_companyId_idx" ON "DeveloperProject"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProject_developerId_name_key" ON "DeveloperProject"("developerId", "name");

-- CreateIndex
CREATE INDEX "DeveloperPlan_projectId_idx" ON "DeveloperPlan"("projectId");

-- CreateIndex
CREATE INDEX "DeveloperPlan_companyId_idx" ON "DeveloperPlan"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadRequirement_leadId_key" ON "LeadRequirement"("leadId");

-- CreateIndex
CREATE INDEX "LeadRequirement_companyId_idx" ON "LeadRequirement"("companyId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDeveloper" ADD CONSTRAINT "BrokerDeveloper_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "BrokerDeveloper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperPlan" ADD CONSTRAINT "DeveloperPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DeveloperProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperPlan" ADD CONSTRAINT "DeveloperPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRequirement" ADD CONSTRAINT "LeadRequirement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRequirement" ADD CONSTRAINT "LeadRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

