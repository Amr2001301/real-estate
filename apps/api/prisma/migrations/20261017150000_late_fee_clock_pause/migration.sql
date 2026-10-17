-- U3b: the late-fee clock stops while the company is blocked or a payment for
-- the installment is waiting (decision 7).
ALTER TABLE "Installment" ADD COLUMN "lateFeePausedSince" TIMESTAMP(3);
ALTER TABLE "Installment" ADD COLUMN "lateFeePausedSeconds" INTEGER NOT NULL DEFAULT 0;
