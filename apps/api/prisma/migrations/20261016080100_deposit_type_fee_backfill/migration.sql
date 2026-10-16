-- Payments already recorded against a fee or penalty row were stored as
-- INSTALLMENT. (A new enum value can't be used in the transaction that adds
-- it, hence a separate migration.)
UPDATE "Deposit" d
SET "type" = 'FEE'
FROM "Installment" i
WHERE d."installmentId" = i."id"
  AND i."type" IN ('LATE_FEE', 'BOUNCE_PENALTY', 'TRANSFER_FEE')
  AND d."type" <> 'FEE';
