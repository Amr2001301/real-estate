-- CreateEnum
CREATE TYPE "ReservationBookingPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'WAIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReservationActivityType" ADD VALUE 'BOOKING_PAYMENT_CONFIRMED';
ALTER TYPE "ReservationActivityType" ADD VALUE 'BOOKING_PAYMENT_UNCONFIRMED';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "bookingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bookingNotes" TEXT,
ADD COLUMN     "bookingPaidAt" TIMESTAMP(3),
ADD COLUMN     "bookingPaymentStatus" "ReservationBookingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "installmentPlanTemplateId" UUID;

-- CreateIndex
CREATE INDEX "Reservation_installmentPlanTemplateId_idx" ON "Reservation"("installmentPlanTemplateId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_installmentPlanTemplateId_fkey" FOREIGN KEY ("installmentPlanTemplateId") REFERENCES "InstallmentPlanTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
