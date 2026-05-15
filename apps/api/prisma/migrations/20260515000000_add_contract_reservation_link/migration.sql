-- AlterEnum: add CONVERTED to ReservationStatus
ALTER TYPE "ReservationStatus" ADD VALUE 'CONVERTED';

-- AlterEnum: add CONVERTED to ReservationActivityType
ALTER TYPE "ReservationActivityType" ADD VALUE 'CONVERTED';

-- AlterTable: add convertedAt to Reservation
ALTER TABLE "Reservation" ADD COLUMN "convertedAt" TIMESTAMP(3);

-- AlterTable: add contractNumber and reservationId to Contract
ALTER TABLE "Contract" ADD COLUMN "contractNumber" TEXT;
ALTER TABLE "Contract" ADD COLUMN "reservationId" UUID;

-- AlterTable: add frequency to InstallmentPlan
ALTER TABLE "InstallmentPlan" ADD COLUMN "frequency" "InstallmentFrequency" NOT NULL DEFAULT 'MONTHLY';

-- CreateIndex: unique constraints
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_reservationId_key" ON "Contract"("reservationId");

-- CreateIndex: lookup index
CREATE INDEX "Contract_reservationId_idx" ON "Contract"("reservationId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
