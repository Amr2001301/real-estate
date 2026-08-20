-- P3-005: Add deletedAt soft-delete column to User.
--
-- Context: User.active is a separate "account enabled" flag used by the auth
-- layer to block logins. This column is the canonical soft-delete timestamp
-- that excludes users from list endpoints and marks them as permanently removed.
-- The two concepts are distinct: an inactive user can be re-activated; a
-- soft-deleted user must be explicitly restored.

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
