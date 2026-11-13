-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('PRIMARY', 'RESALE', 'RENT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'CLOSED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "title" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "usage" "UnitUsage" NOT NULL DEFAULT 'RESIDENTIAL',
    "city" TEXT NOT NULL,
    "district" TEXT,
    "compound" TEXT,
    "address" TEXT,
    "developerName" TEXT,
    "projectName" TEXT,
    "area" DOUBLE PRECISION NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floor" INTEGER,
    "finishing" "UnitFinishing",
    "view" "UnitView",
    "price" DECIMAL(14,2) NOT NULL,
    "downPayment" DECIMAL(14,2),
    "deliveryDate" DATE,
    "description" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agentId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_companyId_kind_status_idx" ON "Listing"("companyId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_companyId_code_key" ON "Listing"("companyId", "code");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The listings permissions, and the staff who already exist get their role's
-- new codes (role-default-permissions.ts grants them to staff created later).
INSERT INTO "Permission" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'listings:read', 'View the brokerage company''s listings'),
  (gen_random_uuid(), 'listings:manage', 'Add, edit and close the brokerage company''s listings')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT u."id", p."id"
FROM "User" u
CROSS JOIN "Permission" p
WHERE p."code" IN ('listings:read', 'listings:manage')
  AND u."role" IN ('ADMIN', 'SALES_MANAGER', 'SALES')
  AND u."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
