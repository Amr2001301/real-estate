-- More of the buyer's identity for booking forms and contracts, and the
-- company's own customer fields.
ALTER TABLE "User" ADD COLUMN "birthDate" DATE;
ALTER TABLE "User" ADD COLUMN "birthPlace" VARCHAR(120);
ALTER TABLE "User" ADD COLUMN "occupation" VARCHAR(120);
ALTER TABLE "User" ADD COLUMN "employer" VARCHAR(200);
ALTER TABLE "User" ADD COLUMN "nationalIdIssueDate" DATE;
ALTER TABLE "User" ADD COLUMN "nationalIdIssuePlace" VARCHAR(120);
ALTER TABLE "User" ADD COLUMN "homePhone" VARCHAR(30);
ALTER TABLE "User" ADD COLUMN "customFields" JSONB;

CREATE TABLE "CustomerField" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" JSONB NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerField_companyId_key_key" ON "CustomerField"("companyId", "key");

ALTER TABLE "CustomerField" ADD CONSTRAINT "CustomerField_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
