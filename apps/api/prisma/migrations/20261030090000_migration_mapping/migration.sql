-- CreateTable
CREATE TABLE "MigrationMapping" (
    "id" UUID NOT NULL,
    "sourceSystem" VARCHAR(60) NOT NULL,
    "field" VARCHAR(160) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "target" VARCHAR(120),
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" UUID,

    CONSTRAINT "MigrationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationMapping_companyId_sourceSystem_idx" ON "MigrationMapping"("companyId", "sourceSystem");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationMapping_sourceSystem_companyId_field_value_key" ON "MigrationMapping"("sourceSystem", "companyId", "field", "value");

-- AddForeignKey
ALTER TABLE "MigrationMapping" ADD CONSTRAINT "MigrationMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
