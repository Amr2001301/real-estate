-- CreateTable
CREATE TABLE "BrokerageTarget" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "commissionTarget" DECIMAL(14,2) NOT NULL,
    "dealsTarget" INTEGER NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "achievedNotifiedAt" TIMESTAMP(3),
    "bonusPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "BrokerageTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerageTarget_companyId_period_idx" ON "BrokerageTarget"("companyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageTarget_companyId_userId_period_key" ON "BrokerageTarget"("companyId", "userId", "period");

-- AddForeignKey
ALTER TABLE "BrokerageTarget" ADD CONSTRAINT "BrokerageTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageTarget" ADD CONSTRAINT "BrokerageTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

