-- P5: a customer's electronic signature on a document (booking forms first).
CREATE TABLE "SignatureRequest" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentType" VARCHAR(20) NOT NULL,
    "documentId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "sourceHash" VARCHAR(64) NOT NULL,
    "createdById" UUID NOT NULL,
    "otpHash" VARCHAR(64),
    "otpExpiresAt" TIMESTAMP(3),
    "otpSentAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "signerName" VARCHAR(120),
    "signatureImage" BYTEA,
    "signedAt" TIMESTAMP(3),
    "signerIp" VARCHAR(64),
    "signerUserAgent" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignatureRequest_tokenHash_key" ON "SignatureRequest"("tokenHash");
CREATE INDEX "SignatureRequest_companyId_documentType_documentId_idx" ON "SignatureRequest"("companyId", "documentType", "documentId");

ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
