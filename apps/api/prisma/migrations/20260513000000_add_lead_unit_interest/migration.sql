-- Add unitInterestId to Lead for unit-specific CRM opportunity matching
ALTER TABLE "Lead" ADD COLUMN "unitInterestId" UUID;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_unitInterestId_fkey"
  FOREIGN KEY ("unitInterestId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_unitInterestId_idx" ON "Lead"("unitInterestId");
