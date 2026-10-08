-- FG-27 — contract sign() set "signedAt" but never "status", so every contract
-- signed since the Step D1 backfill (20260915200000) still reads UNSIGNED.
-- sign() now sets ACTIVE; this repairs the rows written before that.
--
-- Data only, idempotent. CANCELLED contracts are left alone: a cancelled deal
-- keeps its cancellation even if it had been signed.
UPDATE "Contract"
SET "status" = 'ACTIVE'::"ContractStatus"
WHERE "signedAt" IS NOT NULL
  AND "status" = 'UNSIGNED'::"ContractStatus";
