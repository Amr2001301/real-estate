-- «قيمة وحدتك»: a project's price per meter over time (per unit type, or the
-- whole project when "unitType" is null).
CREATE TYPE "PriceRateSource" AS ENUM ('MARKET', 'MANUAL');

CREATE TABLE "UnitPriceRate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "unitType" TEXT,
    "pricePerMeter" DECIMAL(14,2) NOT NULL,
    "source" "PriceRateSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "UnitPriceRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UnitPriceRate_companyId_projectId_unitType_recordedAt_idx" ON "UnitPriceRate"("companyId", "projectId", "unitType", "recordedAt");

ALTER TABLE "UnitPriceRate" ADD CONSTRAINT "UnitPriceRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnitPriceRate" ADD CONSTRAINT "UnitPriceRate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The starting point of the history: today's average price per meter of the
-- units for sale, per type and for the whole project.
INSERT INTO "UnitPriceRate" ("id", "companyId", "projectId", "unitType", "pricePerMeter", "source")
SELECT gen_random_uuid(), p."companyId", p."id", u."type", ROUND(AVG(u."price" / u."area")::numeric, 2), 'MARKET'
FROM "Unit" u
JOIN "Building" b ON b."id" = u."buildingId"
JOIN "Phase" ph ON ph."id" = b."phaseId"
JOIN "Project" p ON p."id" = ph."projectId"
WHERE u."status" = 'AVAILABLE' AND u."area" > 0 AND p."companyId" IS NOT NULL
GROUP BY p."companyId", p."id", u."type";

INSERT INTO "UnitPriceRate" ("id", "companyId", "projectId", "unitType", "pricePerMeter", "source")
SELECT gen_random_uuid(), p."companyId", p."id", NULL, ROUND(AVG(u."price" / u."area")::numeric, 2), 'MARKET'
FROM "Unit" u
JOIN "Building" b ON b."id" = u."buildingId"
JOIN "Phase" ph ON ph."id" = b."phaseId"
JOIN "Project" p ON p."id" = ph."projectId"
WHERE u."status" = 'AVAILABLE' AND u."area" > 0 AND p."companyId" IS NOT NULL
GROUP BY p."companyId", p."id";
