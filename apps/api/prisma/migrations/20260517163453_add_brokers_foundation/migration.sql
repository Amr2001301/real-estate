-- CreateEnum
CREATE TYPE "BrokerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "BrokerUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "BrokerCommissionModel" AS ENUM ('PERCENT_OF_SALE', 'FIXED_PER_UNIT', 'TIERED');

-- CreateEnum
CREATE TYPE "BrokerLeadStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BROKER';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "brokerAgentId" UUID,
ADD COLUMN     "brokerId" UUID;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "brokerAgentId" UUID,
ADD COLUMN     "brokerApprovalStatus" "BrokerLeadStatus",
ADD COLUMN     "brokerApprovedAt" TIMESTAMP(3),
ADD COLUMN     "brokerId" UUID,
ADD COLUMN     "brokerRejectedAt" TIMESTAMP(3),
ADD COLUMN     "brokerRejectionReason" TEXT,
ADD COLUMN     "brokerSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "brokerAgentId" UUID,
ADD COLUMN     "brokerId" UUID,
ADD COLUMN     "commissionLockedAmount" DECIMAL(14,2),
ADD COLUMN     "commissionLockedPct" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "VisitAppointment" ADD COLUMN     "brokerAgentId" UUID,
ADD COLUMN     "brokerId" UUID;

-- AlterTable
ALTER TABLE "VisitRequest" ADD COLUMN     "brokerAgentId" UUID,
ADD COLUMN     "brokerId" UUID;

-- CreateTable
CREATE TABLE "Broker" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "commercialName" TEXT,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "taxId" TEXT,
    "commercialRegistration" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankIban" TEXT,
    "defaultCommissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "commissionModel" "BrokerCommissionModel" NOT NULL DEFAULT 'PERCENT_OF_SALE',
    "status" "BrokerStatus" NOT NULL DEFAULT 'PENDING',
    "contractStartAt" TIMESTAMP(3),
    "contractEndAt" TIMESTAMP(3),
    "contractPdfUrl" TEXT,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerUser" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "jobTitle" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "canManageBrokerUsers" BOOLEAN NOT NULL DEFAULT false,
    "canViewCommissions" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "status" "BrokerUserStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerProjectAccess" (
    "id" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "commissionPct" DECIMAL(5,2),
    "fixedAmountPerUnit" DECIMAL(14,2),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerProjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerUnitAccess" (
    "id" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerUnitAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Broker_code_key" ON "Broker"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_taxId_key" ON "Broker"("taxId");

-- CreateIndex
CREATE INDEX "Broker_status_idx" ON "Broker"("status");

-- CreateIndex
CREATE INDEX "Broker_code_idx" ON "Broker"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerUser_userId_key" ON "BrokerUser"("userId");

-- CreateIndex
CREATE INDEX "BrokerUser_brokerId_status_idx" ON "BrokerUser"("brokerId", "status");

-- CreateIndex
CREATE INDEX "BrokerProjectAccess_projectId_active_idx" ON "BrokerProjectAccess"("projectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerProjectAccess_brokerId_projectId_key" ON "BrokerProjectAccess"("brokerId", "projectId");

-- CreateIndex
CREATE INDEX "BrokerUnitAccess_unitId_active_idx" ON "BrokerUnitAccess"("unitId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerUnitAccess_brokerId_unitId_key" ON "BrokerUnitAccess"("brokerId", "unitId");

-- CreateIndex
CREATE INDEX "Contract_brokerId_idx" ON "Contract"("brokerId");

-- CreateIndex
CREATE INDEX "Contract_brokerAgentId_idx" ON "Contract"("brokerAgentId");

-- CreateIndex
CREATE INDEX "Lead_brokerId_idx" ON "Lead"("brokerId");

-- CreateIndex
CREATE INDEX "Lead_brokerAgentId_idx" ON "Lead"("brokerAgentId");

-- CreateIndex
CREATE INDEX "Lead_brokerApprovalStatus_idx" ON "Lead"("brokerApprovalStatus");

-- CreateIndex
CREATE INDEX "Reservation_brokerId_idx" ON "Reservation"("brokerId");

-- CreateIndex
CREATE INDEX "Reservation_brokerAgentId_idx" ON "Reservation"("brokerAgentId");

-- CreateIndex
CREATE INDEX "VisitAppointment_brokerId_idx" ON "VisitAppointment"("brokerId");

-- CreateIndex
CREATE INDEX "VisitAppointment_brokerAgentId_idx" ON "VisitAppointment"("brokerAgentId");

-- CreateIndex
CREATE INDEX "VisitRequest_brokerId_idx" ON "VisitRequest"("brokerId");

-- CreateIndex
CREATE INDEX "VisitRequest_brokerAgentId_idx" ON "VisitRequest"("brokerAgentId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAppointment" ADD CONSTRAINT "VisitAppointment_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_brokerAgentId_fkey" FOREIGN KEY ("brokerAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUser" ADD CONSTRAINT "BrokerUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUser" ADD CONSTRAINT "BrokerUser_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerProjectAccess" ADD CONSTRAINT "BrokerProjectAccess_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerProjectAccess" ADD CONSTRAINT "BrokerProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUnitAccess" ADD CONSTRAINT "BrokerUnitAccess_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerUnitAccess" ADD CONSTRAINT "BrokerUnitAccess_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
