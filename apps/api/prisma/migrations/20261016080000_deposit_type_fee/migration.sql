-- A payment of a fee or penalty row gets its own deposit type.
ALTER TYPE "DepositType" ADD VALUE IF NOT EXISTS 'FEE';
