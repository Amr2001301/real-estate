-- F10: units for any use (shops, offices, clinics, garages) and a list of
-- unit types each company manages. Unit.type keeps holding a code; the
-- company's UnitType rows give it a name and a usage.

-- CreateEnum
CREATE TYPE "UnitUsage" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'ADMINISTRATIVE', 'MEDICAL', 'PARKING');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "usage" "UnitUsage" NOT NULL DEFAULT 'RESIDENTIAL';

-- CreateTable
CREATE TABLE "UnitType" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "usage" "UnitUsage" NOT NULL DEFAULT 'RESIDENTIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitType_companyId_idx" ON "UnitType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_companyId_code_key" ON "UnitType"("companyId", "code");

-- AddForeignKey
ALTER TABLE "UnitType" ADD CONSTRAINT "UnitType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: every company gets the default types (unit-type-defaults.ts).
INSERT INTO "UnitType" ("id", "code", "name", "usage", "order", "companyId")
SELECT gen_random_uuid(), d.code, d.name, d.usage::"UnitUsage", d.ord, c."id"
FROM "Company" c
CROSS JOIN (VALUES
  ('Studio',     '{"ar":"استوديو","en":"Studio"}'::jsonb,                     'RESIDENTIAL',    0),
  ('1BR',        '{"ar":"شقة غرفة نوم","en":"1-bedroom apartment"}'::jsonb,   'RESIDENTIAL',    1),
  ('2BR',        '{"ar":"شقة غرفتين نوم","en":"2-bedroom apartment"}'::jsonb, 'RESIDENTIAL',    2),
  ('3BR',        '{"ar":"شقة 3 غرف نوم","en":"3-bedroom apartment"}'::jsonb,  'RESIDENTIAL',    3),
  ('4BR',        '{"ar":"شقة 4 غرف نوم","en":"4-bedroom apartment"}'::jsonb,  'RESIDENTIAL',    4),
  ('Duplex',     '{"ar":"دوبلكس","en":"Duplex"}'::jsonb,                      'RESIDENTIAL',    5),
  ('Penthouse',  '{"ar":"بنتهاوس","en":"Penthouse"}'::jsonb,                  'RESIDENTIAL',    6),
  ('Villa',      '{"ar":"فيلا","en":"Villa"}'::jsonb,                         'RESIDENTIAL',    7),
  ('Townhouse',  '{"ar":"تاون هاوس","en":"Townhouse"}'::jsonb,                'RESIDENTIAL',    8),
  ('Twin house', '{"ar":"توين هاوس","en":"Twin house"}'::jsonb,               'RESIDENTIAL',    9),
  ('Chalet',     '{"ar":"شاليه","en":"Chalet"}'::jsonb,                       'RESIDENTIAL',   10),
  ('Shop',       '{"ar":"محل تجاري","en":"Shop"}'::jsonb,                     'COMMERCIAL',    11),
  ('Office',     '{"ar":"مكتب إداري","en":"Office"}'::jsonb,                  'ADMINISTRATIVE',12),
  ('Clinic',     '{"ar":"عيادة","en":"Clinic"}'::jsonb,                       'MEDICAL',       13),
  ('Garage',     '{"ar":"جراج","en":"Garage"}'::jsonb,                        'PARKING',       14)
) AS d(code, name, usage, ord)
ON CONFLICT ("companyId", "code") DO NOTHING;

-- Existing units: their free-text type is matched to a default code, any
-- case ("villa" → "Villa", "retail" → "Shop").
UPDATE "Unit" u SET "type" = a.code
FROM (VALUES
  ('studio','Studio'), ('1br','1BR'), ('2br','2BR'), ('3br','3BR'), ('4br','4BR'),
  ('duplex','Duplex'), ('penthouse','Penthouse'), ('villa','Villa'),
  ('townhouse','Townhouse'), ('town house','Townhouse'),
  ('twin house','Twin house'), ('twinhouse','Twin house'), ('chalet','Chalet'),
  ('shop','Shop'), ('retail','Shop'), ('office','Office'), ('clinic','Clinic'),
  ('garage','Garage'), ('parking','Garage')
) AS a(alias, code)
WHERE lower(trim(u."type")) = a.alias AND u."type" <> a.code;

-- Any other type a company already uses becomes one of its types, named as
-- written; its usage is guessed from the word (residential otherwise).
INSERT INTO "UnitType" ("id", "code", "name", "usage", "order", "companyId")
SELECT gen_random_uuid(), x."type", jsonb_build_object('ar', x."type", 'en', x."type"),
  (CASE
     WHEN lower(x."type") ~ '(office|admin)' THEN 'ADMINISTRATIVE'
     WHEN lower(x."type") ~ '(shop|retail|commercial|store|mall)' THEN 'COMMERCIAL'
     WHEN lower(x."type") ~ '(clinic|medical|pharmacy)' THEN 'MEDICAL'
     WHEN lower(x."type") ~ '(garage|parking)' THEN 'PARKING'
     ELSE 'RESIDENTIAL'
   END)::"UnitUsage",
  100, x."companyId"
FROM (SELECT DISTINCT "companyId", "type" FROM "Unit" WHERE "companyId" IS NOT NULL) x
ON CONFLICT ("companyId", "code") DO NOTHING;

-- Every unit takes its usage from its type.
UPDATE "Unit" u SET "usage" = t."usage"
FROM "UnitType" t
WHERE t."companyId" = u."companyId" AND t."code" = u."type" AND u."usage" <> t."usage";
