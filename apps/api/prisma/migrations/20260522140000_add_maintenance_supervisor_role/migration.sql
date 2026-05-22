-- Add the MAINTENANCE_SUPERVISOR role. Additive enum value; no data backfill.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MAINTENANCE_SUPERVISOR';
