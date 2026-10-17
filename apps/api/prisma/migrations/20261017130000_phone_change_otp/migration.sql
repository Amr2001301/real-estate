-- U1: a customer's phone changes only with a code sent to the new number.
--  * User.pendingPhone holds the new number until the code is entered.
--  * OtpCode.purpose keeps sign-in codes and phone-change codes apart: a code
--    is accepted only for what it was sent for. Existing codes are sign-in.

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "purpose" VARCHAR(20) NOT NULL DEFAULT 'LOGIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingPhone" TEXT;

