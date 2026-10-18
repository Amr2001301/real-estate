-- Instalment markup waived on early settlement: off the total and the markup
-- alike, so the sale price and the commission on it stay.
ALTER TABLE "Contract" ADD COLUMN "markupWaived" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TYPE "ContractAmendmentType" ADD VALUE 'MARKUP_WAIVER';
