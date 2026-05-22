-- Unit maintainable/warranty items + nullable request snapshot fields. Fully
-- additive: existing units start with no items, existing requests get NULL
-- itemId/warrantyStatus/warrantyEndSnapshot.

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('IN_WARRANTY', 'OUT_OF_WARRANTY', 'UNKNOWN');

-- CreateTable
CREATE TABLE "UnitMaintenanceItem" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "categoryId" UUID,
    "name" JSONB NOT NULL,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "supplierName" TEXT,
    "contractorName" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitMaintenanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitMaintenanceItem_unitId_idx" ON "UnitMaintenanceItem"("unitId");
CREATE INDEX "UnitMaintenanceItem_categoryId_idx" ON "UnitMaintenanceItem"("categoryId");
CREATE INDEX "UnitMaintenanceItem_active_idx" ON "UnitMaintenanceItem"("active");

-- AlterTable: MaintenanceRequest item link + warranty snapshot
ALTER TABLE "MaintenanceRequest" ADD COLUMN "itemId" UUID;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "warrantyStatus" "WarrantyStatus";
ALTER TABLE "MaintenanceRequest" ADD COLUMN "warrantyEndSnapshot" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MaintenanceRequest_itemId_idx" ON "MaintenanceRequest"("itemId");

-- AddForeignKey
ALTER TABLE "UnitMaintenanceItem" ADD CONSTRAINT "UnitMaintenanceItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitMaintenanceItem" ADD CONSTRAINT "UnitMaintenanceItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UnitMaintenanceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
