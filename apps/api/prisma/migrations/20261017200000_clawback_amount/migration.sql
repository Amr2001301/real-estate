-- What a cancellation clawback recovers: what was actually paid, price-change
-- adjustments included. Null on older rows (the amount is used then).
ALTER TABLE "BrokerCommission" ADD COLUMN "clawbackAmount" DECIMAL(14,2);
ALTER TABLE "BonusEntry" ADD COLUMN "clawbackAmount" DECIMAL(14,2);
