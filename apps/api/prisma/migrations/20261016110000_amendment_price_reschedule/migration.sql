-- Price amendments and reschedules are recorded with the contract's other amendments.
ALTER TYPE "ContractAmendmentType" ADD VALUE IF NOT EXISTS 'PRICE_CHANGE';
ALTER TYPE "ContractAmendmentType" ADD VALUE IF NOT EXISTS 'RESCHEDULE';
