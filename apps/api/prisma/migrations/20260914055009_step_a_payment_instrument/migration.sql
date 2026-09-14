-- CreateEnum
CREATE TYPE "PaymentInstrumentType" AS ENUM ('BANK_TRANSFER', 'CHEQUE');

-- CreateEnum
CREATE TYPE "PaymentInstrumentStatus" AS ENUM ('PENDING_CLEARANCE', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'REPLACED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "paymentInstrumentId" UUID;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "lastCorrectionId" UUID;

-- CreateTable
CREATE TABLE "PaymentInstrument" (
    "id" UUID NOT NULL,
    "type" "PaymentInstrumentType" NOT NULL,
    "bankName" VARCHAR(200),
    "referenceNumber" VARCHAR(100),
    "chequeNumber" VARCHAR(100),
    "drawerBankName" VARCHAR(200),
    "chequeDueDate" TIMESTAMP(3),
    "clearingDate" TIMESTAMP(3),
    "bounceReason" VARCHAR(500),
    "bounceDate" TIMESTAMP(3),
    "replacedById" UUID,
    "status" "PaymentInstrumentStatus" NOT NULL DEFAULT 'PENDING_CLEARANCE',
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "PaymentInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentInstrument_companyId_idx" ON "PaymentInstrument"("companyId");

-- CreateIndex
CREATE INDEX "PaymentInstrument_status_idx" ON "PaymentInstrument"("status");

-- CreateIndex
CREATE INDEX "PaymentInstrument_replacedById_idx" ON "PaymentInstrument"("replacedById");

-- CreateIndex
CREATE INDEX "PaymentInstrument_recordedById_idx" ON "PaymentInstrument"("recordedById");

-- CreateIndex
CREATE INDEX "Deposit_paymentInstrumentId_idx" ON "Deposit"("paymentInstrumentId");

-- CreateIndex
CREATE INDEX "Installment_lastCorrectionId_idx" ON "Installment"("lastCorrectionId");

-- AddForeignKey
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "PaymentInstrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrument" ADD CONSTRAINT "PaymentInstrument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_paymentInstrumentId_fkey" FOREIGN KEY ("paymentInstrumentId") REFERENCES "PaymentInstrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
