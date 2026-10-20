-- EE4 (F10): unit models per project.
-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "modelId" UUID;

-- CreateTable
CREATE TABLE "UnitModel" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "netArea" DOUBLE PRECISION,
    "gardenArea" DOUBLE PRECISION,
    "roofArea" DOUBLE PRECISION,
    "terraceArea" DOUBLE PRECISION,
    "landArea" DOUBLE PRECISION,
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "bathrooms" INTEGER NOT NULL DEFAULT 0,
    "finishing" "UnitFinishing",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "UnitModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitModel_companyId_idx" ON "UnitModel"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitModel_projectId_code_key" ON "UnitModel"("projectId", "code");

-- AddForeignKey
ALTER TABLE "UnitModel" ADD CONSTRAINT "UnitModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitModel" ADD CONSTRAINT "UnitModel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "UnitModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

