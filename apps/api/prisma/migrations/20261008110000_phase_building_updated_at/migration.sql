-- FG-15 (docs/audit/08-functional-gaps.md): Phase and Building had only
-- createdAt, so nothing recorded when one last changed. Prisma's @updatedAt
-- sets the column on every write; existing rows start at their createdAt.
ALTER TABLE "Phase" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Phase" SET "updatedAt" = "createdAt";
ALTER TABLE "Phase" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Building" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Building" SET "updatedAt" = "createdAt";
ALTER TABLE "Building" ALTER COLUMN "updatedAt" SET NOT NULL;
