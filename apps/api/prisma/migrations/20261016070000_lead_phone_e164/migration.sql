-- Leads imported by the data importer kept the local 01XXXXXXXXX form while
-- every other write stores E.164; exact-match lookups missed them and opened
-- duplicate leads. Egyptian mobile numbers only (010/011/012/015).
UPDATE "Lead"
SET "phone" = '+20' || substring("phone" from 2)
WHERE "phone" ~ '^01[0125][0-9]{8}$';
