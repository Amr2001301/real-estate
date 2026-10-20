-- EE6 (F10): a project's data — type, district, total area, license number.
-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COASTAL', 'ADMINISTRATIVE', 'COMMERCIAL', 'MEDICAL', 'MIXED_USE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "district" TEXT,
ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "totalArea" DOUBLE PRECISION,
ADD COLUMN     "type" "ProjectType";

