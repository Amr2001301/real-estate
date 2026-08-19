-- DB-level constraints for commission and bonus fields.
-- These enforce invariants the application should already maintain;
-- the CHECK constraints are a last-resort safety net.

-- BonusRule.percentage must be in [0, 100]
ALTER TABLE "BonusRule"
  ADD CONSTRAINT "bonus_rule_percentage_range"
  CHECK ("percentage" >= 0 AND "percentage" <= 100);

-- BonusEntry.amount must be positive (commissions can't be zero or negative)
ALTER TABLE "BonusEntry"
  ADD CONSTRAINT "bonus_entry_amount_positive"
  CHECK ("amount" > 0);

-- BonusEntry.commissionPct must be in [0, 100] when set
ALTER TABLE "BonusEntry"
  ADD CONSTRAINT "bonus_entry_commission_pct_range"
  CHECK ("commissionPct" IS NULL OR ("commissionPct" >= 0 AND "commissionPct" <= 100));

-- BrokerCommission.commissionPct must be in [0, 100] when set
ALTER TABLE "BrokerCommission"
  ADD CONSTRAINT "broker_commission_pct_range"
  CHECK ("commissionPct" IS NULL OR ("commissionPct" >= 0 AND "commissionPct" <= 100));

-- BrokerCommission.grossAmount and netAmount must be non-negative
ALTER TABLE "BrokerCommission"
  ADD CONSTRAINT "broker_commission_gross_non_negative"
  CHECK ("grossAmount" >= 0);

ALTER TABLE "BrokerCommission"
  ADD CONSTRAINT "broker_commission_net_non_negative"
  CHECK ("netAmount" >= 0);
