-- U3d: the unit handover (decision 1). Warranties start and maintenance
-- opens at handover, not at the contract's creation.

-- CreateTable
CREATE TABLE "UnitHandover" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "handedOverAt" TIMESTAMP(3) NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "notes" VARCHAR(2000),
    "performedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "UnitHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitHandover_contractId_key" ON "UnitHandover"("contractId");

-- CreateIndex
CREATE INDEX "UnitHandover_unitId_idx" ON "UnitHandover"("unitId");

-- CreateIndex
CREATE INDEX "UnitHandover_companyId_idx" ON "UnitHandover"("companyId");

-- AddForeignKey
ALTER TABLE "UnitHandover" ADD CONSTRAINT "UnitHandover_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitHandover" ADD CONSTRAINT "UnitHandover_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: a contract signed before handovers existed is treated as handed
-- over on the date its warranties already started (its creation date), so
-- its customer keeps filing maintenance and nothing moves.
INSERT INTO "UnitHandover" ("id", "contractId", "unitId", "handedOverAt", "notes", "companyId")
SELECT gen_random_uuid(), c."id", c."unitId", c."createdAt", 'Recorded before unit handovers were tracked', c."companyId"
FROM "Contract" c
WHERE c."status" = 'ACTIVE' AND c."signedAt" IS NOT NULL AND c."deletedAt" IS NULL;
