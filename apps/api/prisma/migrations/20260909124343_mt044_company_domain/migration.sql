-- CreateEnum
CREATE TYPE "DomainType" AS ENUM ('PLATFORM_SUBDOMAIN', 'CUSTOM');

-- CreateTable
CREATE TABLE "CompanyDomain" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "type" "DomainType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDomain_hostname_key" ON "CompanyDomain"("hostname");

-- CreateIndex
CREATE INDEX "CompanyDomain_companyId_idx" ON "CompanyDomain"("companyId");

-- CreateIndex
CREATE INDEX "CompanyDomain_isPrimary_idx" ON "CompanyDomain"("isPrimary");

-- AddForeignKey
ALTER TABLE "CompanyDomain" ADD CONSTRAINT "CompanyDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
