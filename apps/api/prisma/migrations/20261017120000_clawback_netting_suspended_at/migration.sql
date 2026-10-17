-- U2c (owner's decision, 2026-10-17):
--  1. A cancelled deal's paid commission (its clawback overlay) is netted
--     into the broker's next payout like a price-change clawback.
--  2. Broker.suspendedAt for brokers suspended before it existed: the
--     moment of the suspension, not the last edit.

ALTER TABLE "BrokerCommissionAdjustment" ADD COLUMN "settlesClawback" BOOLEAN NOT NULL DEFAULT false;

-- Outstanding cancellation clawbacks become CLAWBACK adjustments for what is
-- still owed, open for the next payout.
INSERT INTO "BrokerCommissionAdjustment"
  ("id", "brokerId", "commissionId", "kind", "amount", "reason", "createdAt", "settlesClawback", "companyId")
SELECT gen_random_uuid(), bc."brokerId", bc."id", 'CLAWBACK',
       bc."netAmount" - COALESCE(bc."clawbackCollectedAmount", 0),
       COALESCE(bc."clawbackReason", 'Contract cancelled'),
       COALESCE(bc."clawbackAt", CURRENT_TIMESTAMP), true, bc."companyId"
FROM "BrokerCommission" bc
WHERE bc."clawbackStatus" IN ('OUTSTANDING', 'PARTIALLY_COLLECTED')
  AND bc."netAmount" - COALESCE(bc."clawbackCollectedAmount", 0) > 0;

-- suspendedAt: the latest move from a working status into SUSPENDED or
-- TERMINATED. The status change writes "[<ISO time>] <FROM> → <TO>: <reason>"
-- into the broker's notes; failing that, the audit row of the status request
-- (its response carries the new status); failing that, the last edit (the
-- previous backfill) stays.
WITH moves AS (
  SELECT b."id", (m)[1]::timestamptz AT TIME ZONE 'UTC' AS at, (m)[2] AS from_s, (m)[3] AS to_s
  FROM "Broker" b,
       regexp_matches(b."notes", '\[([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z)\] ([A-Z]+) → ([A-Z]+)', 'g') AS m
  WHERE b."status" IN ('SUSPENDED', 'TERMINATED') AND b."notes" IS NOT NULL
), stopped AS (
  SELECT "id", max(at) AS at FROM moves
  WHERE to_s IN ('SUSPENDED', 'TERMINATED') AND from_s NOT IN ('SUSPENDED', 'TERMINATED')
  GROUP BY "id"
)
UPDATE "Broker" b SET "suspendedAt" = stopped.at FROM stopped WHERE stopped."id" = b."id";

WITH audited AS (
  SELECT a."entityId" AS id, a."createdAt", a."after"->>'status' AS status
  FROM "AuditLog" a
  WHERE a."entityType" = 'v1/brokers' AND a."after" ? 'status'
), last_active AS (
  SELECT id, max("createdAt") AS at FROM audited WHERE status NOT IN ('SUSPENDED', 'TERMINATED') GROUP BY id
), stopped AS (
  SELECT s.id, min(s."createdAt") AS at
  FROM audited s LEFT JOIN last_active l ON l.id = s.id
  WHERE s.status IN ('SUSPENDED', 'TERMINATED') AND (l.at IS NULL OR s."createdAt" > l.at)
  GROUP BY s.id
)
UPDATE "Broker" b SET "suspendedAt" = stopped.at
FROM stopped
WHERE stopped.id = b."id"::text
  AND b."status" IN ('SUSPENDED', 'TERMINATED')
  AND (b."notes" IS NULL OR b."notes" !~ '\] [A-Z]+ → (SUSPENDED|TERMINATED)');
