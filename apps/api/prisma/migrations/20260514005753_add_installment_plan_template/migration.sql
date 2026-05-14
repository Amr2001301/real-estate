-- CreateEnum
CREATE TYPE "DownPaymentType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "InstallmentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY');

-- CreateEnum
CREATE TYPE "StartDateRule" AS ENUM ('MANUAL', 'AFTER_RESERVATION', 'AFTER_CONTRACT');

-- CreateEnum
CREATE TYPE "PlanTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanPaymentType" AS ENUM ('RESERVATION', 'DOWN_PAYMENT', 'INSTALLMENT', 'FINAL_PAYMENT');

-- CreateTable
CREATE TABLE "InstallmentPlanTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" UUID NOT NULL,
    "unitId" UUID,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPrice" DECIMAL(14,2) NOT NULL,
    "reservationAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "downPaymentType" "DownPaymentType" NOT NULL DEFAULT 'FIXED',
    "downPaymentValue" DECIMAL(14,2) NOT NULL,
    "downPaymentAmount" DECIMAL(14,2) NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "frequency" "InstallmentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "startDateRule" "StartDateRule" NOT NULL DEFAULT 'AFTER_CONTRACT',
    "manualStartDate" TIMESTAMP(3),
    "finalPaymentAmount" DECIMAL(14,2),
    "visibility" TEXT NOT NULL DEFAULT 'SALES_ONLY',
    "status" "PlanTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTemplateScheduleItem" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "paymentType" "PlanPaymentType" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2) NOT NULL,
    "remainingBalance" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PlanTemplateScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentPlanTemplate_projectId_idx" ON "InstallmentPlanTemplate"("projectId");

-- CreateIndex
CREATE INDEX "InstallmentPlanTemplate_status_idx" ON "InstallmentPlanTemplate"("status");

-- CreateIndex
CREATE INDEX "PlanTemplateScheduleItem_planId_idx" ON "PlanTemplateScheduleItem"("planId");

-- AddForeignKey
ALTER TABLE "InstallmentPlanTemplate" ADD CONSTRAINT "InstallmentPlanTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlanTemplate" ADD CONSTRAINT "InstallmentPlanTemplate_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlanTemplate" ADD CONSTRAINT "InstallmentPlanTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTemplateScheduleItem" ADD CONSTRAINT "PlanTemplateScheduleItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
