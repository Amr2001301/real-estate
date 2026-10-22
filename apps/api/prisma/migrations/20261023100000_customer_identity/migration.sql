-- P4: the buyer's national ID and address, printed on contracts.
ALTER TABLE "User" ADD COLUMN "nationalId" VARCHAR(20);
ALTER TABLE "User" ADD COLUMN "address" VARCHAR(300);
