-- Option B (backlog #3, docs/audit/13-user-tenancy.md) — User.email and
-- User.phone become unique per company instead of platform-wide.
--
-- The same person can now be a customer of two developers: one account per
-- company, each holding only that company's leads, contracts, installments and
-- maintenance, each signed into through that company's login. Before this, the
-- second developer could not create the account at all, and lead paths that
-- looked the phone up platform-wide attached the second developer's records to
-- the first developer's account.
--
-- NULL semantics: Postgres treats NULL as distinct in a unique index, so users
-- with no company (SUPER_ADMIN) are no longer unique by email at the DB level.
-- No API path creates a SUPER_ADMIN — only the seed does, by upsert on email —
-- and login-super-admin looks one up by email + role + companyId IS NULL.
-- Users with no email or no phone are unaffected, as before.
--
-- Safe on existing data: rows unique platform-wide are unique per company.

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_phone_key" ON "User"("companyId", "phone");
