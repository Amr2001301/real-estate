-- CMS1: a page or article address is unique per company, not across the
-- platform — two companies can each have their own /about.
DROP INDEX "CmsPage_slug_key";
CREATE UNIQUE INDEX "CmsPage_companyId_slug_key" ON "CmsPage"("companyId", "slug");

DROP INDEX "Article_slug_key";
CREATE UNIQUE INDEX "Article_companyId_slug_key" ON "Article"("companyId", "slug");
