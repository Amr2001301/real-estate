-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "fbclid" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "id" DROP DEFAULT;
