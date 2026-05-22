-- Maintenance warranty/catalog flow + approval-based SLA. Fully additive:
-- existing requests default to reviewStatus APPROVED (they predate the gate and
-- are already in the operational workflow); existing categories/items get NULL
-- warranty-duration columns; the join table starts empty.

-- CreateEnum
CREATE TYPE "MaintenanceReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: MaintenanceCategory warranty duration (months)
ALTER TABLE "MaintenanceCategory" ADD COLUMN "warrantyDurationMonths" INTEGER;

-- AlterTable: UnitMaintenanceItem warranty duration snapshot (months)
ALTER TABLE "UnitMaintenanceItem" ADD COLUMN "warrantyDurationMonthsSnapshot" INTEGER;

-- AlterTable: MaintenanceRequest approval gate
ALTER TABLE "MaintenanceRequest" ADD COLUMN "reviewStatus" "MaintenanceReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "maxHandlingSlaMinutesSnapshot" INTEGER;

-- CreateIndex
CREATE INDEX "MaintenanceRequest_reviewStatus_idx" ON "MaintenanceRequest"("reviewStatus");

-- CreateTable
CREATE TABLE "MaintenanceRequestItem" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "itemId" UUID,
    "categoryId" UUID NOT NULL,
    "categoryPrioritySnapshot" "MaintenancePriority" NOT NULL,
    "handlingSlaMinutesSnapshot" INTEGER,
    "warrantyStatusSnapshot" "WarrantyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "warrantyEndSnapshot" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRequestItem_requestId_idx" ON "MaintenanceRequestItem"("requestId");
CREATE INDEX "MaintenanceRequestItem_categoryId_idx" ON "MaintenanceRequestItem"("categoryId");
CREATE INDEX "MaintenanceRequestItem_itemId_idx" ON "MaintenanceRequestItem"("itemId");

-- AddForeignKey
ALTER TABLE "MaintenanceRequestItem" ADD CONSTRAINT "MaintenanceRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequestItem" ADD CONSTRAINT "MaintenanceRequestItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UnitMaintenanceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequestItem" ADD CONSTRAINT "MaintenanceRequestItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
