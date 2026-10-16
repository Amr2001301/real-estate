-- CreateEnum
CREATE TYPE "ContractAmendmentType" AS ENUM ('TRANSFER', 'UNIT_SWAP');

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" UUID NOT NULL,
    "type" "ContractAmendmentType" NOT NULL,
    "contractId" UUID NOT NULL,
    "fromCustomerId" UUID,
    "toCustomerId" UUID,
    "fromUnitId" UUID,
    "toUnitId" UUID,
    "fromTotal" DECIMAL(14,2),
    "toTotal" DECIMAL(14,2),
    "reason" VARCHAR(2000) NOT NULL,
    "performedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractAmendment_contractId_idx" ON "ContractAmendment"("contractId");

-- CreateIndex
CREATE INDEX "ContractAmendment_companyId_idx" ON "ContractAmendment"("companyId");

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

