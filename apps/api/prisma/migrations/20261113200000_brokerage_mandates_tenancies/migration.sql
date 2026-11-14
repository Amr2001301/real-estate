-- BRK-2: owners' mandates, rent tenancies and their monthly payments, and a visit on a listing.
-- CreateEnum
CREATE TYPE "MandateKind" AS ENUM ('EXCLUSIVE', 'OPEN');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "VisitAppointment" ADD COLUMN     "listingId" UUID;

-- CreateTable
CREATE TABLE "ListingMandate" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "kind" "MandateKind" NOT NULL,
    "commissionPct" DECIMAL(5,2),
    "commissionAmount" DECIMAL(14,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "expiryNotifiedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "ListingMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "tenantName" TEXT NOT NULL,
    "tenantPhone" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" DECIMAL(14,2) NOT NULL,
    "paymentDay" INTEGER NOT NULL,
    "deposit" DECIMAL(14,2),
    "notes" TEXT,
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedAt" TIMESTAMP(3),
    "lastDueReminderPeriod" TEXT,
    "endingNotifiedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" UUID NOT NULL,
    "tenancyId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingMandate_companyId_endDate_idx" ON "ListingMandate"("companyId", "endDate");

-- CreateIndex
CREATE INDEX "ListingMandate_listingId_idx" ON "ListingMandate"("listingId");

-- CreateIndex
CREATE INDEX "Tenancy_companyId_status_idx" ON "Tenancy"("companyId", "status");

-- CreateIndex
CREATE INDEX "Tenancy_listingId_idx" ON "Tenancy"("listingId");

-- CreateIndex
CREATE INDEX "RentPayment_companyId_idx" ON "RentPayment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_tenancyId_period_key" ON "RentPayment"("tenancyId", "period");

-- CreateIndex
CREATE INDEX "VisitAppointment_listingId_idx" ON "VisitAppointment"("listingId");

-- AddForeignKey
ALTER TABLE "ListingMandate" ADD CONSTRAINT "ListingMandate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingMandate" ADD CONSTRAINT "ListingMandate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

