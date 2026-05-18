-- CreateEnum
CREATE TYPE "BrokerCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BrokerCommission" (
    "id" UUID NOT NULL,
    "commissionNumber" TEXT NOT NULL,
    "brokerId" UUID NOT NULL,
    "brokerAgentId" UUID,
    "contractId" UUID NOT NULL,
    "reservationId" UUID,
    "unitId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "basisAmount" DECIMAL(14,2) NOT NULL,
    "commissionPct" DECIMAL(5,2),
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "withholdingPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "withholdingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "status" "BrokerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerCommission_commissionNumber_key" ON "BrokerCommission"("commissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerCommission_contractId_key" ON "BrokerCommission"("contractId");

-- CreateIndex
CREATE INDEX "BrokerCommission_brokerId_status_idx" ON "BrokerCommission"("brokerId", "status");

-- CreateIndex
CREATE INDEX "BrokerCommission_projectId_earnedAt_idx" ON "BrokerCommission"("projectId", "earnedAt");

-- CreateIndex
CREATE INDEX "BrokerCommission_brokerAgentId_idx" ON "BrokerCommission"("brokerAgentId");

-- CreateIndex
CREATE INDEX "BrokerCommission_status_earnedAt_idx" ON "BrokerCommission"("status", "earnedAt");

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
