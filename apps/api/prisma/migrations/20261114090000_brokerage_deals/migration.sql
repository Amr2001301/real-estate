-- BRK-3: brokerage deals, their agents' commission splits, the company's commission rules, and developer claims.
-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealSplitRole" AS ENUM ('AGENT', 'MANAGER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'CLOSED',
    "listingId" UUID,
    "leadId" UUID,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "dealValue" DECIMAL(14,2) NOT NULL,
    "closedOn" DATE NOT NULL,
    "commissionTotal" DECIMAL(14,2) NOT NULL,
    "commissionReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "agentId" UUID,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealSplit" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "DealSplitRole" NOT NULL,
    "sharePct" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "DealSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" UUID NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "agentPct" DECIMAL(5,2) NOT NULL,
    "managerPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperClaim" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "dealId" UUID NOT NULL,
    "developerName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "submittedOn" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "DeveloperClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimPayment" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receivedOn" DATE NOT NULL,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "ClaimPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_companyId_status_closedOn_idx" ON "Deal"("companyId", "status", "closedOn");

-- CreateIndex
CREATE INDEX "Deal_agentId_idx" ON "Deal"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_companyId_code_key" ON "Deal"("companyId", "code");

-- CreateIndex
CREATE INDEX "DealSplit_companyId_userId_idx" ON "DealSplit"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealSplit_dealId_userId_role_key" ON "DealSplit"("dealId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRule_companyId_kind_key" ON "CommissionRule"("companyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperClaim_dealId_key" ON "DeveloperClaim"("dealId");

-- CreateIndex
CREATE INDEX "DeveloperClaim_companyId_status_idx" ON "DeveloperClaim"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperClaim_companyId_code_key" ON "DeveloperClaim"("companyId", "code");

-- CreateIndex
CREATE INDEX "ClaimPayment_claimId_idx" ON "ClaimPayment"("claimId");

-- CreateIndex
CREATE INDEX "ClaimPayment_companyId_idx" ON "ClaimPayment"("companyId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSplit" ADD CONSTRAINT "DealSplit_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSplit" ADD CONSTRAINT "DealSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSplit" ADD CONSTRAINT "DealSplit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperClaim" ADD CONSTRAINT "DeveloperClaim_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperClaim" ADD CONSTRAINT "DeveloperClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPayment" ADD CONSTRAINT "ClaimPayment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "DeveloperClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPayment" ADD CONSTRAINT "ClaimPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The deals permissions; the staff who already exist get their role's codes
-- (role-default-permissions.ts grants them to staff created later).
INSERT INTO "Permission" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'deals:read', 'View brokerage deals (a rep: their own)'),
  (gen_random_uuid(), 'deals:manage', 'Record and cancel brokerage deals'),
  (gen_random_uuid(), 'deals:finance', 'Commission rules, developer claims, commission received and agent payouts')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT u."id", p."id"
FROM "User" u
CROSS JOIN "Permission" p
WHERE ((p."code" IN ('deals:read', 'deals:manage') AND u."role" IN ('ADMIN', 'SALES_MANAGER', 'SALES'))
    OR (p."code" = 'deals:finance' AND u."role" = 'ADMIN'))
  AND u."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
