-- Decision after a MANUAL cancellation: what the admin chose for the
-- commission and the bonus (CLAWBACK or RETAIN), when, and by whom.
ALTER TABLE "ContractCancellation"
  ADD COLUMN "commissionDecision" VARCHAR(20),
  ADD COLUMN "commissionDecidedAt" TIMESTAMP(3),
  ADD COLUMN "commissionDecidedById" UUID,
  ADD COLUMN "bonusDecision" VARCHAR(20),
  ADD COLUMN "bonusDecidedAt" TIMESTAMP(3),
  ADD COLUMN "bonusDecidedById" UUID;
