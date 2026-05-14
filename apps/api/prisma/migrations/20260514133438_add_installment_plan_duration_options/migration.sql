-- AlterTable
ALTER TABLE "InstallmentPlanTemplate" ALTER COLUMN "installmentsCount" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InstallmentPlanDurationOption" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "increasePercentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallmentPlanDurationOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentPlanDurationOption_planId_idx" ON "InstallmentPlanDurationOption"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlanDurationOption_planId_durationMonths_key" ON "InstallmentPlanDurationOption"("planId", "durationMonths");

-- AddForeignKey
ALTER TABLE "InstallmentPlanDurationOption" ADD CONSTRAINT "InstallmentPlanDurationOption_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
