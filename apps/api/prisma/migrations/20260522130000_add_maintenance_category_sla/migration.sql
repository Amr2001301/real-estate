-- Maintenance category priority/SLA + duplicate prevention, plus request
-- priority/dueAt snapshot. All additive: existing rows keep NULL code/SLA,
-- priority defaults to MEDIUM, and existing requests get NULL priority/dueAt.

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterTable: MaintenanceCategory
ALTER TABLE "MaintenanceCategory" ADD COLUMN "code" TEXT;
ALTER TABLE "MaintenanceCategory" ADD COLUMN "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "MaintenanceCategory" ADD COLUMN "slaDurationMinutes" INTEGER;
ALTER TABLE "MaintenanceCategory" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: unique code (Postgres allows multiple NULLs, so existing rows are fine)
CREATE UNIQUE INDEX "MaintenanceCategory_code_key" ON "MaintenanceCategory"("code");

-- AlterTable: MaintenanceRequest snapshot fields
ALTER TABLE "MaintenanceRequest" ADD COLUMN "priority" "MaintenancePriority";
ALTER TABLE "MaintenanceRequest" ADD COLUMN "dueAt" TIMESTAMP(3);
