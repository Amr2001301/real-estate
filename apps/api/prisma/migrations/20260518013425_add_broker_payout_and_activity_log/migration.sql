-- CreateEnum
CREATE TYPE "BrokerPayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrokerPayoutMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "BrokerActivityType" AS ENUM ('PAYOUT_CREATED', 'PAYOUT_APPROVED', 'PAYOUT_PROCESSING', 'PAYOUT_PAID', 'PAYOUT_CANCELLED');

-- AlterTable
ALTER TABLE "BrokerCommission" ADD COLUMN     "payoutId" UUID;

-- CreateTable
CREATE TABLE "BrokerPayout" (
    "id" UUID NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "brokerId" UUID NOT NULL,
    "period" TEXT,
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalWithholding" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BrokerPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" "BrokerPayoutMethod",
    "paymentReference" TEXT,
    "receiptUrl" TEXT,
    "invoiceUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "processedById" UUID,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerActivityLog" (
    "id" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "brokerAgentId" UUID,
    "type" "BrokerActivityType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerPayout_payoutNumber_key" ON "BrokerPayout"("payoutNumber");

-- CreateIndex
CREATE INDEX "BrokerPayout_brokerId_status_idx" ON "BrokerPayout"("brokerId", "status");

-- CreateIndex
CREATE INDEX "BrokerPayout_brokerId_period_idx" ON "BrokerPayout"("brokerId", "period");

-- CreateIndex
CREATE INDEX "BrokerPayout_status_createdAt_idx" ON "BrokerPayout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrokerActivityLog_brokerId_createdAt_idx" ON "BrokerActivityLog"("brokerId", "createdAt");

-- CreateIndex
CREATE INDEX "BrokerActivityLog_brokerAgentId_createdAt_idx" ON "BrokerActivityLog"("brokerAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "BrokerCommission_payoutId_idx" ON "BrokerCommission"("payoutId");

-- AddForeignKey
ALTER TABLE "BrokerCommission" ADD CONSTRAINT "BrokerCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "BrokerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayout" ADD CONSTRAINT "BrokerPayout_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayout" ADD CONSTRAINT "BrokerPayout_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayout" ADD CONSTRAINT "BrokerPayout_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerPayout" ADD CONSTRAINT "BrokerPayout_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerActivityLog" ADD CONSTRAINT "BrokerActivityLog_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerActivityLog" ADD CONSTRAINT "BrokerActivityLog_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
