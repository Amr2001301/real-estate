-- Admin hold on a broker's payouts (dispute, investigation).
ALTER TABLE "Broker" ADD COLUMN     "payoutHold" BOOLEAN NOT NULL DEFAULT false;
