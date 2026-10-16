-- Commission and payout numbers run per company (like contract and
-- reservation numbers). The global unique index made a second company's first
-- commission collide with the first company's COM-<year>-0001, so
-- materialization failed forever and payout creation returned 500.
DROP INDEX "BrokerCommission_commissionNumber_key";
CREATE UNIQUE INDEX "BrokerCommission_companyId_commissionNumber_key" ON "BrokerCommission"("companyId", "commissionNumber");

DROP INDEX "BrokerPayout_payoutNumber_key";
CREATE UNIQUE INDEX "BrokerPayout_companyId_payoutNumber_key" ON "BrokerPayout"("companyId", "payoutNumber");
