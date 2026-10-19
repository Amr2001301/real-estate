-- A contract signed before the company used the system.
ALTER TABLE "Contract" ADD COLUMN "preSystem" BOOLEAN NOT NULL DEFAULT false;
