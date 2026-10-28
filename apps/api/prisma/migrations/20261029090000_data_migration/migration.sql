-- CreateEnum
CREATE TYPE "MigrationRunStatus" AS ENUM ('OPEN', 'FINISHED');

-- CreateEnum
CREATE TYPE "MigrationEntity" AS ENUM ('PROJECT', 'UNIT', 'CUSTOMER', 'LEAD', 'ACTIVITY');

-- CreateTable
CREATE TABLE "MigrationRun" (
    "id" UUID NOT NULL,
    "sourceSystem" VARCHAR(60) NOT NULL,
    "sourceLabel" VARCHAR(80) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MigrationRunStatus" NOT NULL DEFAULT 'OPEN',
    "note" VARCHAR(300),
    "createdById" UUID,
    "lastUsedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "MigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRecord" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "sourceSystem" VARCHAR(60) NOT NULL,
    "entity" "MigrationEntity" NOT NULL,
    "externalId" VARCHAR(120) NOT NULL,
    "targetId" UUID NOT NULL,
    "extra" JSONB,
    "unmapped" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "MigrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRun_tokenHash_key" ON "MigrationRun"("tokenHash");

-- CreateIndex
CREATE INDEX "MigrationRun_companyId_createdAt_idx" ON "MigrationRun"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "MigrationRecord_runId_entity_idx" ON "MigrationRecord"("runId", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRecord_companyId_sourceSystem_entity_externalId_key" ON "MigrationRecord"("companyId", "sourceSystem", "entity", "externalId");

-- AddForeignKey
ALTER TABLE "MigrationRun" ADD CONSTRAINT "MigrationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MigrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRecord" ADD CONSTRAINT "MigrationRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

