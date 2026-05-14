-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "selectedDurationMonths" INTEGER,
ADD COLUMN     "selectedDurationOptionId" UUID,
ADD COLUMN     "selectedIncreasePercentage" DECIMAL(6,2),
ADD COLUMN     "snapshotDownPaymentAmount" DECIMAL(14,2),
ADD COLUMN     "snapshotFinancedAmount" DECIMAL(14,2),
ADD COLUMN     "snapshotMonthlyInstallment" DECIMAL(14,2),
ADD COLUMN     "snapshotRemainingAmount" DECIMAL(14,2),
ADD COLUMN     "snapshotTotalPayable" DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "Reservation_selectedDurationOptionId_idx" ON "Reservation"("selectedDurationOptionId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_selectedDurationOptionId_fkey" FOREIGN KEY ("selectedDurationOptionId") REFERENCES "InstallmentPlanDurationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
