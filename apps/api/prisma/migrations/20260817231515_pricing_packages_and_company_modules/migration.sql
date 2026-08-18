-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "modules" JSONB;

-- CreateTable
CREATE TABLE "PricingPackage" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "planTier" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descAr" TEXT,
    "descEn" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "monthlyPrice" DECIMAL(12,2),
    "annualPrice" DECIMAL(12,2),
    "setupFee" DECIMAL(12,2),
    "maxUsers" INTEGER,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "specialOffer" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingPackage_companyId_idx" ON "PricingPackage"("companyId");

-- CreateIndex
CREATE INDEX "PricingPackage_planTier_idx" ON "PricingPackage"("planTier");

-- AddForeignKey
ALTER TABLE "PricingPackage" ADD CONSTRAINT "PricingPackage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
