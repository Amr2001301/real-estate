-- A contract carries its own late-fee clause: late fees are charged only on a
-- contract that has one (decided 2026-10-18). Until now the company setting
-- lateFee.enabled charged every contract of the company, so the contracts of
-- a company with it on start with the clause; all others start without.
ALTER TABLE "Contract" ADD COLUMN "lateFeesApply" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Contract" c
SET "lateFeesApply" = true
FROM "Setting" s
WHERE s."companyId" = c."companyId"
  AND s.key = 'lateFee.enabled'
  AND s.value = 'true'::jsonb;
