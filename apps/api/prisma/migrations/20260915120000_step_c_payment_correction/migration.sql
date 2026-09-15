-- Step C: PaymentCorrection model + wire Installment.lastCorrectionId FK
-- Purely additive: new enum, new table, new FK constraints only.
-- No drops. No type changes. No NOT NULL on existing columns.

-- CreateEnum
CREATE TYPE "PaymentCorrectionType" AS ENUM ('REVERSAL', 'REASSIGNMENT');

-- CreateTable
CREATE TABLE "PaymentCorrection" (
    "id" UUID NOT NULL,
    "type" "PaymentCorrectionType" NOT NULL,
    "depositId" UUID NOT NULL,
    "sourceInstallmentId" UUID,
    "targetInstallmentId" UUID,
    "reason" VARCHAR(2000) NOT NULL,
    "performedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "PaymentCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCorrection_depositId_idx" ON "PaymentCorrection"("depositId");

-- CreateIndex
CREATE INDEX "PaymentCorrection_sourceInstallmentId_idx" ON "PaymentCorrection"("sourceInstallmentId");

-- CreateIndex
CREATE INDEX "PaymentCorrection_targetInstallmentId_idx" ON "PaymentCorrection"("targetInstallmentId");

-- CreateIndex
CREATE INDEX "PaymentCorrection_companyId_idx" ON "PaymentCorrection"("companyId");

-- AddForeignKey (Installment.lastCorrectionId → PaymentCorrection.id — column added in Step A)
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_lastCorrectionId_fkey" FOREIGN KEY ("lastCorrectionId") REFERENCES "PaymentCorrection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_sourceInstallmentId_fkey" FOREIGN KEY ("sourceInstallmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_targetInstallmentId_fkey" FOREIGN KEY ("targetInstallmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
