-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('DEVELOPER', 'BROKERAGE');

-- CreateEnum
CREATE TYPE "CompanyLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "capabilities" JSONB,
ADD COLUMN     "customerAppEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lifecycleStatus" "CompanyLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "staffAppEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "CompanyType" NOT NULL DEFAULT 'DEVELOPER',
ADD COLUMN     "websiteEnabled" BOOLEAN NOT NULL DEFAULT true;
