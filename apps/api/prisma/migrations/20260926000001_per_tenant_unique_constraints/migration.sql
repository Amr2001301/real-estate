-- Migration: 20260926000001_per_tenant_unique_constraints
--
-- Replaces four global @unique constraints with per-tenant @@unique composites:
--   Contract.contractNumber, Broker.code, Broker.taxId
--
-- Adds import-idempotency key columns to Project and Phase:
--   Project.code  (String?, @@unique([companyId, code]))
--   Phase.code    (String?, @@unique([projectId, code]))
--
-- Adds per-phase uniqueness for Building names:
--   Building.name (@@unique([phaseId, name]))
--
-- NULL semantics: Postgres treats NULLs as distinct in unique indexes, so
-- nullable columns (contractNumber, taxId, code) allow multiple NULLs per
-- company without violating the constraint. No partial indexes needed.

-- ── Contract.contractNumber ──────────────────────────────────────────────────
DROP INDEX IF EXISTS "Contract_contractNumber_key";
CREATE UNIQUE INDEX "Contract_companyId_contractNumber_key"
  ON "Contract" ("companyId", "contractNumber");

-- ── Broker.code ──────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "Broker_code_key";
CREATE UNIQUE INDEX "Broker_companyId_code_key"
  ON "Broker" ("companyId", "code");

-- ── Broker.taxId ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "Broker_taxId_key";
CREATE UNIQUE INDEX "Broker_companyId_taxId_key"
  ON "Broker" ("companyId", "taxId");

-- ── Project.code ─────────────────────────────────────────────────────────────
ALTER TABLE "Project" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "Project_companyId_code_key"
  ON "Project" ("companyId", "code");

-- ── Phase.code ───────────────────────────────────────────────────────────────
ALTER TABLE "Phase" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "Phase_projectId_code_key"
  ON "Phase" ("projectId", "code");

-- ── Building.name (per-phase uniqueness) ─────────────────────────────────────
CREATE UNIQUE INDEX "Building_phaseId_name_key"
  ON "Building" ("phaseId", "name");
