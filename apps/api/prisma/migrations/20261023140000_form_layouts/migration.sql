-- The company's own paper form: its pages (images) and where each value goes
-- on them, for the booking form and the payment receipt.
CREATE TABLE "FormLayout" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "paperSize" VARCHAR(10) NOT NULL DEFAULT 'A4',
    "pages" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormLayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormLayout_companyId_documentType_idx" ON "FormLayout"("companyId", "documentType");

ALTER TABLE "FormLayout" ADD CONSTRAINT "FormLayout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
