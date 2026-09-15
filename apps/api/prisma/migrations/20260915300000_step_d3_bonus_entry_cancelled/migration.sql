-- Step D3: add CANCELLED to BonusEntryStatus so that PENDING/APPROVED bonus
-- obligations can be cancelled when a contract is cancelled (Hard Rule 2 applies
-- only to PAID bonuses, which instead receive a clawback overlay).
-- Purely additive — no existing rows are touched.

ALTER TYPE "BonusEntryStatus" ADD VALUE 'CANCELLED';
