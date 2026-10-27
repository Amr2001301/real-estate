-- CreateEnum
CREATE TYPE "LeadNoteKind" AS ENUM ('NOTE', 'CALL', 'MEETING', 'WHATSAPP', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "LeadCallResult" AS ENUM ('ANSWERED', 'NO_ANSWER', 'BUSY', 'UNREACHABLE', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "LeadFollowUpType" AS ENUM ('CALL', 'MEETING', 'WHATSAPP', 'FOLLOW_UP');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "nextActionAt" TIMESTAMP(3),
ADD COLUMN     "nextActionNote" TEXT,
ADD COLUMN     "nextActionType" "LeadFollowUpType";

-- AlterTable
ALTER TABLE "LeadNote" ADD COLUMN     "callResult" "LeadCallResult",
ADD COLUMN     "kind" "LeadNoteKind" NOT NULL DEFAULT 'NOTE',
ADD COLUMN     "nextActionAt" TIMESTAMP(3),
ADD COLUMN     "nextActionType" "LeadFollowUpType",
ADD COLUMN     "parentId" UUID;

-- CreateIndex
CREATE INDEX "Lead_companyId_nextActionAt_idx" ON "Lead"("companyId", "nextActionAt");

-- CreateIndex
CREATE INDEX "LeadNote_parentId_idx" ON "LeadNote"("parentId");

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LeadNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

