-- A contract carries its own late-fee clause: the sweep charges a fee only on
-- a contract that has one. Existing contracts keep what they had — the
-- company setting decided for all of them — so they start with the clause.
ALTER TABLE "Contract" ADD COLUMN "lateFeesApply" BOOLEAN NOT NULL DEFAULT true;
