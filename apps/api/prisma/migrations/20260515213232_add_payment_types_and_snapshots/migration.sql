-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('BOOKING_AMOUNT', 'DOWN_PAYMENT', 'INSTALLMENT', 'FINAL_PAYMENT');

-- DropForeignKey
ALTER TABLE "Deposit" DROP CONSTRAINT "Deposit_contractId_fkey";

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "reservationId" UUID,
ADD COLUMN     "type" "DepositType" NOT NULL DEFAULT 'INSTALLMENT',
ALTER COLUMN "contractId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "type" "PlanPaymentType" NOT NULL DEFAULT 'INSTALLMENT';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "snapshotFinalPaymentAmount" DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "Deposit_reservationId_idx" ON "Deposit"("reservationId");

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
