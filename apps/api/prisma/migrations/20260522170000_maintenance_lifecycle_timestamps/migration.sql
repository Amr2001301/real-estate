-- Maintenance lifecycle timestamps. Fully additive, all nullable; no backfill.
-- Existing requests get NULL for every column (resolution/SLA metrics simply
-- skip them until they next transition).

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "firstInProgressAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MaintenanceRequest_resolvedAt_idx" ON "MaintenanceRequest"("resolvedAt");
CREATE INDEX "MaintenanceRequest_closedAt_idx" ON "MaintenanceRequest"("closedAt");
