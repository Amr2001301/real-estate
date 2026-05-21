-- AlterEnum
-- Additive enum value. Postgres appends 'SALES_MANAGER' to the existing
-- "UserRole" type; existing rows and roles are unaffected. This migration only
-- adds the value (it does not use it), so it is safe to run outside the same
-- transaction that would later reference it.
ALTER TYPE "UserRole" ADD VALUE 'SALES_MANAGER';
