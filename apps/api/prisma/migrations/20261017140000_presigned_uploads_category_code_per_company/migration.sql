-- U1c: maintenance attachments only from a presign for that user and request;
-- maintenance category codes unique per company, not across all companies.

-- CreateTable
CREATE TABLE "PresignedUpload" (
    "id" UUID NOT NULL,
    "key" VARCHAR(512) NOT NULL,
    "userId" UUID NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "PresignedUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresignedUpload_key_key" ON "PresignedUpload"("key");

-- CreateIndex
CREATE INDEX "PresignedUpload_companyId_idx" ON "PresignedUpload"("companyId");

-- AddForeignKey
ALTER TABLE "PresignedUpload" ADD CONSTRAINT "PresignedUpload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A category code was unique across every company: the second company to
-- name a category "Plumbing" got a server error. Unique per company now
-- (existing rows were globally unique, so they are unique per company too).
DROP INDEX "MaintenanceCategory_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceCategory_companyId_code_key" ON "MaintenanceCategory"("companyId", "code");
