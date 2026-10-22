-- P4: printed documents — the company's letterhead, signature and stamp, and
-- the wording of its contracts and booking forms.
CREATE TABLE "PrintSettings" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "letterheadMode" VARCHAR(20) NOT NULL DEFAULT 'BUILT_IN',
    "headerImageUrl" TEXT,
    "footerImageUrl" TEXT,
    "pageImageUrl" TEXT,
    "marginTopMm" INTEGER NOT NULL DEFAULT 14,
    "marginBottomMm" INTEGER NOT NULL DEFAULT 16,
    "marginSideMm" INTEGER NOT NULL DEFAULT 16,
    "signatoryName" VARCHAR(120),
    "signatoryTitle" VARCHAR(120),
    "signatureImage" BYTEA,
    "signatureType" VARCHAR(20),
    "stampImage" BYTEA,
    "stampType" VARCHAR(20),
    "sealDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "variant" VARCHAR(20) NOT NULL DEFAULT 'ANY',
    "name" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrintSettings_companyId_key" ON "PrintSettings"("companyId");
CREATE INDEX "DocumentTemplate_companyId_documentType_idx" ON "DocumentTemplate"("companyId", "documentType");

ALTER TABLE "PrintSettings" ADD CONSTRAINT "PrintSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
