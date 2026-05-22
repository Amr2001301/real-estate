-- AlterEnum
-- Additive enum value: lets Documents attach to a MaintenanceRequest. Existing
-- rows/types are unaffected. Postgres appends the value to the "DocumentOwnerType"
-- type; this migration only adds it (does not use it), so it is safe.
ALTER TYPE "DocumentOwnerType" ADD VALUE 'MAINTENANCE_REQUEST';
