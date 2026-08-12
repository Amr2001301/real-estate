# Production Deployment Guide

## Overview

This guide defines the safe deployment sequence for the Devora platform. The critical constraint is:
**migrations must be applied and confirmed before the new API version starts serving traffic.**

---

## Migration Architecture

| Phase | Mechanism | Notes |
|-------|-----------|-------|
| Local creation | `pnpm db:migrate` (`prisma migrate dev`) | Generates SQL migration + updates Prisma client |
| Local testing | `pnpm test:e2e` | `globalSetup` resets and redeploys all migrations against `realestate_e2e` |
| CI: migration integrity | `prisma migrate deploy` + `prisma migrate status` in `build` job | Proves all 35 migrations apply cleanly to a fresh DB; fails on error or schema drift |
| CI: E2E (Jest) | `prisma migrate deploy` inside `globalSetup` | Full deployment cycle against ephemeral Postgres |
| CI: E2E (Playwright) | `npx prisma migrate deploy` step before API starts | Same — migrations applied before app boots |
| Production | `pnpm db:deploy` or `docker-entrypoint.sh` with `RUN_MIGRATIONS=true` | See deploy sequence below |

**Never use `prisma db push` or `prisma migrate dev` against production.**

---

## Pre-Deploy Checklist

Before starting a production deploy, verify all of these:

- [ ] CI pipeline is fully green (lint, typecheck, build, unit tests, e2e tests)
- [ ] `pnpm -r typecheck` passes locally on the release commit
- [ ] `pnpm --filter api build` passes on the release commit
- [ ] All pending migrations have been reviewed (see Migration Review below)
- [ ] **Database backup / managed snapshot taken** (see Backup section)
- [ ] Rollback plan confirmed (application image of previous version available)
- [ ] Team notified if the deploy involves schema changes that affect running replicas

---

## Deployment Sequence

Execute in this exact order. Stop if any step fails.

### 1. Validate environment

```bash
# Confirm DATABASE_URL points at production (not staging/dev)
pnpm db:status
# Expected: "Database schema is up to date!" (or N migrations pending)
```

### 2. Take database backup / snapshot

> **This step is infrastructure-dependent.** The backup mechanism must be configured in your hosting environment (e.g. AWS RDS automated snapshot, pg_dump to S3, managed Supabase backup). This repository does not contain backup tooling.
>
> Do not proceed without a verified, restorable backup.

```bash
# Example for pg_dump (adapt to your infrastructure):
pg_dump "$DATABASE_URL" --no-owner --format=custom -f "backup-$(date +%Y%m%d-%H%M%S).dump"
```

### 3. Apply migrations

```bash
pnpm db:deploy
# Equivalent: pnpm --filter @rep/api prisma:deploy
# Equivalent inside Docker: docker exec <api-container> ./node_modules/.bin/prisma migrate deploy
```

**Expected output:** `All migrations have been successfully applied.` or `No pending migrations to apply.`

If this exits non-zero: **stop the deployment immediately.** Do not start the new API version. See Failure section.

### 4. Verify migration success

```bash
pnpm db:status
# Must report: "Database schema is up to date!"
```

### 5. Deploy the new API version

Deploy the new API container/image. The API is safe to start once migrations have succeeded.

If using Docker with the bundled entrypoint and `RUN_MIGRATIONS=false` (recommended for production):

```bash
docker pull <registry>/devora-api:<new-tag>
docker stop devora-api && docker rm devora-api
docker run -d --name devora-api \
  -e DATABASE_URL="$DATABASE_URL" \
  -e RUN_MIGRATIONS=false \
  ... \
  <registry>/devora-api:<new-tag>
```

> Setting `RUN_MIGRATIONS=true` on the API container is acceptable for single-instance deployments. For multi-replica deployments, run migrations once from a dedicated migration step (not per-replica) to avoid concurrent `prisma migrate deploy` calls.

### 6. Health check

```bash
# Wait for API to become ready
until curl -fs http://localhost:4000/health; do sleep 2; done
curl -s http://localhost:4000/health | jq .
```

**Expected:** `{ "status": "ok" }` (or equivalent). If health check fails, see Failure section.

### 7. Deploy web applications

Deploy `web-admin` and `web-public` after the API is healthy. These are Next.js apps with no direct DB access; they follow the API's availability.

### 8. Post-deploy verification

- [ ] `GET /health` returns 200
- [ ] Login with a known staff account succeeds (auth + DB round-trip)
- [ ] `pnpm db:status` still reports "up to date"
- [ ] Check application logs / Sentry for unexpected errors in the first 5 minutes
- [ ] Spot-check one reservation or contract record in the database

---

## Failure Handling

### Migration fails (Step 3)

1. **Do not start the new API version.**
2. Check Prisma output for the specific migration and SQL error.
3. Restore from backup if the migration partially applied and left the schema in an inconsistent state.
4. Fix the migration SQL (as a new forward migration — **never edit a committed migration that has been applied to production**) and re-deploy.

> Prisma migrations generally require forward-fix strategies. Do not attempt to manually reverse applied migrations with hand-written SQL unless you have expert DBA review. Prefer restoring from backup for catastrophic failures.

### API health check fails (Step 6)

1. Roll back to the previous API image/container (migrations remain applied — the old API version must be compatible with the new schema — see Rolling Deployment below).
2. Investigate logs: `docker logs devora-api` or equivalent.
3. If the issue is schema-related (column missing, wrong type), the old binary may not run against the new schema. Restore the database from backup.

### Frontend deploy fails

Web apps are stateless and do not affect the database. Revert to the previous frontend image. No database action needed.

---

## Rolling Deployment Compatibility

**Question: Can the old and new API versions run simultaneously against the migrated schema?**

**Answer: PARTIALLY SAFE** — for purely additive migrations only.

Analysis of all 35 current migrations:

- **34 migrations** add new tables, nullable columns, new enum values, or indexes. Old API versions ignore unknown columns and tables. These are backward-compatible.
- **Migration `20260510164835_link_leads_to_clients`** promotes `Lead.clientId` to `NOT NULL`. An old API that inserts a Lead without `clientId` would fail. However, this migration has already been applied long before the current release and is not a concern for the current deploy.
- **Migration `20260515213232_add_payment_types_and_snapshots`** changes `Deposit.contractId` from `NOT NULL` to nullable and changes the FK delete behavior. Similarly applied well before the current release.
- **Migration `20260811214042_add_password_reset_token`** (most recent): purely additive — new table, no changes to existing tables. Old API versions are unaffected. **Safe for rolling deploy.**

**Conclusion for current release:** Adding `PasswordResetToken` is purely additive. The old API version has no knowledge of this table and will not be harmed by its presence. A brief period where old and new API replicas co-exist is safe.

For future migrations involving destructive or non-nullable changes, apply the expand/contract pattern: expand first (add nullable), deploy both old+new, then contract (remove/make NOT NULL) in a subsequent release.

---

## Backup Strategy

### What this repository handles

- The `docker-entrypoint.sh` never runs destructive commands.
- `prisma migrate deploy` is idempotent and non-destructive; it only applies pending committed migrations.
- The `RUN_MIGRATIONS=false` default prevents accidental migration-on-start.

### What must be configured in infrastructure

> **Backup mechanism is infrastructure-dependent and must be configured outside this repository.**

Recommended approaches (choose based on your hosting provider):

| Provider | Backup Mechanism |
|----------|-----------------|
| AWS RDS | Automated daily snapshots + PITR (Point-in-Time Recovery) |
| Supabase | Daily backups + PITR (Pro plan) |
| Self-hosted | `pg_dump` to S3/R2 before each deploy via CI/CD pipeline |
| DigitalOcean Managed DB | Automated daily backups |

**Minimum requirement:** A backup must exist and be verified restorable before any schema-changing migration is applied to production.

---

## Rollback Strategy

### Application rollback (backward-compatible migration)

If the migration is additive (no columns removed, no NOT NULL promotions on existing rows), the old API version can run against the migrated schema:

1. Stop the new API container.
2. Start the previous API image.
3. The new table/column remains in the DB but is ignored by the old code.
4. No database action needed.

### Database rollback (destructive or failed migration)

Prisma does **not** support automatic migration rollback. For failed or destructive migrations:

1. Restore the database from the pre-deploy backup snapshot.
2. Deploy the previous API image against the restored database.
3. Root-cause the migration failure.
4. Write a forward-fix migration and go through the full deploy process again.

**Do not attempt to manually reverse migrations with hand-written SQL.** The risk of introducing additional inconsistency is high.

---

## Migration Locking

Prisma uses an advisory lock (`migration_lock.toml` provider: `postgresql`) to prevent concurrent `prisma migrate deploy` executions from colliding. The lock is held for the duration of the migration transaction.

For multi-replica deployments where each replica might run migrations on start (via `RUN_MIGRATIONS=true`), Prisma's lock prevents double-application. However, it is still preferable to run migrations once from a dedicated step (CI/CD release job or init container) rather than per-replica, to:
- Avoid startup delays on every replica
- Keep migration execution explicit and observable
- Prevent race conditions with health checks

**Recommendation:** Set `RUN_MIGRATIONS=false` on API replicas. Run `pnpm db:deploy` as a pre-deploy step in your CI/CD pipeline.

---

## Useful Commands

```bash
# Check migration status (production-safe, read-only)
pnpm db:status

# Apply pending migrations (production deploy command)
pnpm db:deploy

# Create a new migration (dev only — never run in production)
pnpm db:migrate

# Open Prisma Studio (dev only)
pnpm db:studio
```

Equivalent `apps/api`-scoped commands:
```bash
pnpm --filter @rep/api prisma:deploy   # = pnpm db:deploy
pnpm --filter @rep/api exec prisma migrate status  # = pnpm db:status
```

Inside the API container:
```bash
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
./node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma
```
