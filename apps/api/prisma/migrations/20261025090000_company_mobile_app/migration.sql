-- The company's own customer app in the stores.
CREATE TABLE "CompanyMobileApp" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "appNameAr" VARCHAR(30) NOT NULL,
    "appNameEn" VARCHAR(30) NOT NULL,
    "packageId" VARCHAR(150) NOT NULL,
    "iconUrl" VARCHAR(2048),
    "splashUrl" VARCHAR(2048),
    "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    "playStoreUrl" VARCHAR(2048),
    "appStoreUrl" VARCHAR(2048),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMobileApp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyMobileApp_companyId_key" ON "CompanyMobileApp"("companyId");
CREATE UNIQUE INDEX "CompanyMobileApp_packageId_key" ON "CompanyMobileApp"("packageId");

ALTER TABLE "CompanyMobileApp" ADD CONSTRAINT "CompanyMobileApp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
