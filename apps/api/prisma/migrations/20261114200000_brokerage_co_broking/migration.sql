-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "coBrokerAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "coBrokerName" TEXT,
ADD COLUMN     "coBrokerPaidAt" TIMESTAMP(3),
ADD COLUMN     "coBrokerPct" DECIMAL(5,2),
ADD COLUMN     "coBrokerPhone" TEXT;

