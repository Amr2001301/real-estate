-- A project's page content beyond its description: titled sections, its own
-- FAQ, amenities with an icon and a group, and construction progress by stage.
ALTER TABLE "Project"
  ADD COLUMN "sections" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "faqs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "amenities" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "progressStages" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "progressUpdatedAt" TIMESTAMP(3);

-- The existing names-only services become amenities: a plain tick, inside the project.
UPDATE "Project"
SET "amenities" = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s, 'icon', 'check', 'group', 'INSIDE') ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements("services") WITH ORDINALITY AS t(s, ord)
)
WHERE jsonb_typeof("services") = 'array' AND jsonb_array_length("services") > 0;
