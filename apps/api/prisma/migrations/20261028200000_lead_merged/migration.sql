-- DUP1: duplicate leads of one customer merged into the kept one.
ALTER TYPE "LeadActivityType" ADD VALUE IF NOT EXISTS 'merged';
