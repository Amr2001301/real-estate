-- EE5 (F10): handover dates — the phase's, and a unit's own.
-- AlterTable
ALTER TABLE "Phase" ADD COLUMN     "deliveryDate" DATE;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "deliveryDate" DATE;

