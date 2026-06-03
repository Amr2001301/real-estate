-- Maintenance resolution loop (Phase A) — additive only.
--
-- One new enum + eight nullable columns + two indexes on MaintenanceRequest.
-- No existing data is modified; every column is nullable with no default, so
-- historical rows keep NULL (no complaint, no confirmation, no rating).

CREATE TYPE "MaintenanceResolutionConfirmedBy" AS ENUM ('CUSTOMER', 'SUPERVISOR', 'BOTH');

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "complaintAt" TIMESTAMP(3),
  ADD COLUMN "unresolvedAt" TIMESTAMP(3),
  ADD COLUMN "customerConfirmedResolutionAt" TIMESTAMP(3),
  ADD COLUMN "supervisorConfirmedResolutionAt" TIMESTAMP(3),
  ADD COLUMN "resolvedBy" "MaintenanceResolutionConfirmedBy",
  ADD COLUMN "customerRating" INTEGER,
  ADD COLUMN "customerRatingText" TEXT,
  ADD COLUMN "customerRatingSubmittedAt" TIMESTAMP(3);

CREATE INDEX "MaintenanceRequest_complaintAt_idx" ON "MaintenanceRequest"("complaintAt");
CREATE INDEX "MaintenanceRequest_unresolvedAt_idx" ON "MaintenanceRequest"("unresolvedAt");
