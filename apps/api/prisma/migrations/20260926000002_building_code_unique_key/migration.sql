-- Migration: 20260926000002_building_code_unique_key
--
-- Replaces the (phaseId, name) unique index on Building with a stable import
-- key: (phaseId, code). Building names are mutable (marketing renames happen);
-- an import key that changes causes re-imports to create duplicate rows. The
-- new nullable `code` column is the import-stable identifier, matching the
-- convention already used on Project and Phase.
--
-- The old (phaseId, name) constraint is dropped. Building.name remains a plain
-- non-unique column — duplicates within a phase are now allowed (intentional:
-- two towers can share a display name before codes are assigned).
--
-- NULL semantics: Postgres treats NULLs as distinct in unique indexes, so
-- rows without a code (NULL) do not conflict with each other. The constraint
-- only fires when two rows in the same phase are assigned the same non-null code.

-- ── Building.code ─────────────────────────────────────────────────────────────
ALTER TABLE "Building" ADD COLUMN "code" TEXT;

DROP INDEX IF EXISTS "Building_phaseId_name_key";
CREATE UNIQUE INDEX "Building_phaseId_code_key"
  ON "Building" ("phaseId", "code");
