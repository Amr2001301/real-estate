-- The company app's signing-key fingerprints, for Android App Links.
ALTER TABLE "CompanyMobileApp" ADD COLUMN "androidSha256" VARCHAR(1000);
