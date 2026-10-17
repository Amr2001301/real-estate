-- U5 lead card: "days in stage". When a lead last changed stage.
ALTER TABLE "Lead" ADD COLUMN "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: the last recorded stage change, else when the lead was created.
UPDATE "Lead" l
SET "stageChangedAt" = COALESCE(
  (SELECT max(a."createdAt") FROM "LeadActivity" a
    WHERE a."leadId" = l."id" AND a."type" = 'status_change'),
  l."createdAt"
);

-- The stage is changed from several places (pipeline, reservations,
-- contracts, imports, raw SQL). A trigger keeps the timestamp right for all
-- of them: it moves only when the stage really changes.
CREATE OR REPLACE FUNCTION lead_stage_changed_at() RETURNS trigger AS $$
BEGIN
  IF NEW."stage" IS DISTINCT FROM OLD."stage" THEN
    NEW."stageChangedAt" := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_stage_changed_at
BEFORE UPDATE OF "stage" ON "Lead"
FOR EACH ROW EXECUTE FUNCTION lead_stage_changed_at();
