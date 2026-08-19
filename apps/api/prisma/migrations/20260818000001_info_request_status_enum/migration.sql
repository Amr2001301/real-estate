-- CreateEnum
CREATE TYPE "InfoRequestStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- AlterTable: cast existing String values to the new enum type.
-- All existing rows default to 'OPEN' so this cast is always safe.
ALTER TABLE "InfoRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "InfoRequestStatus"
    USING ("status"::"InfoRequestStatus"),
  ALTER COLUMN "status" SET DEFAULT 'OPEN'::"InfoRequestStatus";
