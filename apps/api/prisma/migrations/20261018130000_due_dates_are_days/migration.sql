-- Due dates are days (UTC midnight of the day, in the company's time zone),
-- as every scheduled row already is. Down payments made on conversion,
-- transfer fees, late fees and price-change rows were written with the time
-- of day: they fell out of "due by today" on their own day (a 100% collection
-- rate on a signing day) and were chased a day late. Move them to their day.
UPDATE "Installment" i
SET "dueDate" = ((i."dueDate" AT TIME ZONE 'UTC') AT TIME ZONE z.tz)::date
FROM (
  SELECT i2.id,
         COALESCE(
           (SELECT s.value #>> '{}'
              FROM "Setting" s
             WHERE s."companyId" = i2."companyId"
               AND s.key = 'company.timezone'
               AND EXISTS (SELECT 1 FROM pg_timezone_names n WHERE n.name = s.value #>> '{}')
             LIMIT 1),
           'Africa/Cairo'
         ) AS tz
    FROM "Installment" i2
   WHERE i2."dueDate" <> date_trunc('day', i2."dueDate")
) z
WHERE i.id = z.id;
