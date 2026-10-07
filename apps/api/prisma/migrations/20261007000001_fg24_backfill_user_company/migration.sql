-- FG-24 — backfill User.companyId for rows the broker paths created without one.
--
-- User is TENANT_CONTROLLED: the Prisma middleware does not inject companyId,
-- and three create paths (admin broker users, broker-portal team members,
-- broker-portal lead clients) never set it. Such a user is invisible to every
-- tenant-scoped query, cannot use the tenant staff login, and escapes the
-- company lifecycle check on token refresh. The code fix is in the same change;
-- this repairs rows already written.
--
-- Data only — no schema change. Only unambiguous rows are touched; anything
-- left NULL afterwards needs a human decision (see the audit doc, FG-24).

-- 1) BROKER users take the company of the broker they are attached to.
--    BrokerUser.userId is unique, so each user has at most one broker.
UPDATE "User" u
SET    "companyId" = b."companyId"
FROM   "BrokerUser" bu
JOIN   "Broker" b ON b.id = bu."brokerId"
WHERE  bu."userId" = u.id
  AND  u."companyId" IS NULL
  AND  u.role = 'BROKER'
  AND  b."companyId" IS NOT NULL;

-- 2) CLIENT / CUSTOMER users that hold at least one broker-submitted lead take
--    the company of their leads — but only when every lead they hold sits in
--    exactly one company. A client whose leads span companies is left NULL.
UPDATE "User" u
SET    "companyId" = x.cid
FROM (
  SELECT l."clientId"                     AS uid,
         MIN(l."companyId"::text)::uuid   AS cid
  FROM   "Lead" l
  WHERE  l."companyId" IS NOT NULL
  GROUP  BY l."clientId"
  HAVING COUNT(DISTINCT l."companyId") = 1
     AND BOOL_OR(l."brokerId" IS NOT NULL)
) x
WHERE  u.id = x.uid
  AND  u."companyId" IS NULL
  AND  u.role IN ('CLIENT', 'CUSTOMER');
