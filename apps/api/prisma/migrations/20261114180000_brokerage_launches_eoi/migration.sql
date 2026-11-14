-- CreateEnum
CREATE TYPE "LaunchStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EoiStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'ALLOCATED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Launch" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "developerProjectId" UUID,
    "developerName" TEXT NOT NULL,
    "launchDate" DATE NOT NULL,
    "eoiAmount" DECIMAL(14,2) NOT NULL,
    "status" "LaunchStatus" NOT NULL DEFAULT 'UPCOMING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchEoi" (
    "id" UUID NOT NULL,
    "launchId" UUID NOT NULL,
    "leadId" UUID,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "preference" TEXT,
    "budget" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "EoiStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "allocation" TEXT,
    "refundedAt" TIMESTAMP(3),
    "agentId" UUID,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "LaunchEoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Launch_companyId_launchDate_idx" ON "Launch"("companyId", "launchDate");

-- CreateIndex
CREATE INDEX "LaunchEoi_launchId_status_idx" ON "LaunchEoi"("launchId", "status");

-- CreateIndex
CREATE INDEX "LaunchEoi_companyId_idx" ON "LaunchEoi"("companyId");

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchEoi" ADD CONSTRAINT "LaunchEoi_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchEoi" ADD CONSTRAINT "LaunchEoi_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchEoi" ADD CONSTRAINT "LaunchEoi_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchEoi" ADD CONSTRAINT "LaunchEoi_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

