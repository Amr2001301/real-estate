-- AlterTable
-- Additive, nullable self-reference for sales team scoping. Existing rows get
-- managerId = NULL (unaffected). ON DELETE SET NULL so removing a manager
-- detaches their team members rather than deleting them.
ALTER TABLE "User" ADD COLUMN "managerId" UUID;

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
