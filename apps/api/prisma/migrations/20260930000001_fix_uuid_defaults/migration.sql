-- ContractCancellation.id and Refund.id were created with DEFAULT gen_random_uuid()
-- but schema.prisma uses @default(uuid()) (application-generated UUID4).
-- Prisma migrate diff detects this as drift. Remove the redundant DB defaults
-- to bring the DB in line with the schema declaration.
ALTER TABLE "ContractCancellation" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Refund" ALTER COLUMN "id" DROP DEFAULT;
