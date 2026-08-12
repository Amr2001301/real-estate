# Disaster Recovery Guide

## Critical Data Stores

| Store | Durable? | Backup Required? | Current Protection |
|-------|----------|-----------------|-------------------|
| PostgreSQL | YES — all business state | YES | Operator must configure managed snapshots + `db:backup` script |
| Object Storage (R2/MinIO) | YES — uploaded files | YES — Bucket Locks (WORM) recommended; R2 does NOT support object versioning | Infrastructure-dependent; see Object Storage section |
| Redis | NO — ephemeral only | NO | Cron locks + in-memory rate limits only; auto-rebuilt on start |

---

## What PostgreSQL Contains

All critical business state lives in PostgreSQL:

- Users, roles, auth tokens, password reset records
- Projects, phases, buildings, units
- Leads, visit requests, info requests
- Reservations, contracts, installment plans, installments
- Deposits, payment proof references
- Broker records, commissions, payouts
- Maintenance requests
- Documents metadata (object keys, not file contents)
- Audit logs, notifications, CMS content

**Loss of PostgreSQL = loss of all business data.** Backup is mandatory.

---

## What Object Storage Contains

R2 (production) / MinIO (local dev) stores uploaded files referenced by the database:

| Folder | Content |
|--------|---------|
| `projects/` | Property images, project media |
| `units/` | Unit-level photos |
| `contracts/` | Signed contract PDFs |
| `receipts/` | Payment proof uploads |
| `maintenance/` | Maintenance photos and attachments |
| `banners/` | CMS banner images |
| `documents/` | Customer/admin documents |
| `avatars/` | User profile photos |

DB records store **full public URLs** (e.g. `https://media.example.com/contracts/2026-08-12/uuid.pdf`). The `R2_PUBLIC_URL` prefix is baked into stored values at upload time. The API extracts the object key from the URL via `R2Service.keyFromPublicUrl()` when generating presigned downloads. This means:

- A restored DB pointing at the same R2 bucket and the same `R2_PUBLIC_URL` works immediately.
- A restored DB pointed at a different `R2_PUBLIC_URL` will have broken file references across all stored URLs — a bulk SQL update to all URL columns is required before service can resume.

### Object Key Pattern

```
<folder>/<YYYY-MM-DD>/<uuid><ext>
```

Keys are **immutable** — the API never mutates keys, only inserts and deletes. DB/storage divergence after a point-in-time restore produces orphaned files (files in R2 with no DB record) or missing files (DB records with no file). See DB/File Consistency section.

---

## Redis Recovery

Redis is used exclusively for:

1. **Distributed cron locks** (`cron-lock:*` keys with TTL) — ephemeral by design
2. **In-memory rate limiting** (`ThrottlerModule` with default in-memory store — NOT Redis-backed)

**DOES REDIS REQUIRE BACKUP FOR BUSINESS RECOVERY? NO.**

Redis holds no durable business data. After a complete Redis loss:

- Cron locks clear immediately — all scheduled jobs resume on the next tick
- Rate limit counters reset — brief window of relaxed rate limiting until rebuilt
- No business transactions, no financial state, no user data affected
- Application starts normally against an empty Redis instance

**CAN THE PLATFORM RECOVER FROM AN EMPTY REDIS INSTANCE WITHOUT BUSINESS DATA LOSS? YES.**

---

## RPO / RTO Recommendations

> **These are recommendations, not existing guarantees.** Actual RPO/RTO depends on infrastructure configuration.

| Store | Recommended RPO | Recommended RTO |
|-------|----------------|----------------|
| PostgreSQL | 1 hour | 1–4 hours |
| Object Storage (R2) | 24 hours | 4–8 hours |
| Redis | N/A (ephemeral) | < 5 minutes (container restart) |

For PostgreSQL, achieving 1-hour RPO requires either:
- A managed provider with automated snapshots + PITR (preferred), or
- A scheduled `db:backup` cron every 60 minutes writing to durable storage

---

## Database Backup Strategy

### Recommended approach (tiered)

1. **Managed provider automated snapshots** — daily or more frequent, with PITR if available. This is the primary safety net. Examples:
   - AWS RDS: automated daily snapshots + PITR to minute precision
   - Supabase Pro: daily backups + PITR
   - DigitalOcean Managed DB: daily automated backups

2. **Logical backup via `db:backup`** — the `scripts/db-backup.sh` script uses `pg_dump --format=custom`. Run this before every deployment and store the output in durable object storage (separate from the main application bucket).

The two approaches complement each other: managed snapshots provide PITR; logical backups provide portability and pre-deploy safety.

**Never rely solely on `pg_dump` without managed snapshots in production.**

### Backup script

```bash
# Usage
DATABASE_URL="postgresql://..." ./scripts/db-backup.sh

# Output: backups/devora-YYYYMMDD-HHMMSS.dump
# Format: pg_dump custom (compressed, supports parallel restore)
# Credentials: never printed to stdout/stderr
# Destructive operations: none
```

The `backups/` directory and `*.dump` files are in `.gitignore` — backup files are never committed.

---

## Restore Procedure

### Step 1 — Identify the backup

Confirm the backup file and its timestamp. Assess the data loss window (source timestamp vs current time = RPO).

### Step 2 — Create a disposable target database

```bash
psql "$ADMIN_URL" -c "CREATE DATABASE realestate_restore_$(date +%Y%m%d);"
```

### Step 3 — Run the restore script

```bash
DUMP_FILE="./backups/devora-20260812-104809.dump" \
TARGET_DATABASE_URL="postgresql://user:pass@host:5432/realestate_restore_20260812" \
./scripts/db-restore-test.sh
```

The script enforces a safety guard: `TARGET_DATABASE_URL` database name must contain `test`, `restore`, `disposable`, `dr`, or `staging`. It refuses to run against any other name.

### Step 4 — Verify migration state

```bash
DATABASE_URL="$TARGET_DATABASE_URL" pnpm db:status
# Expected: "Database schema is up to date!"
```

### Step 5 — Verify data integrity

Run the row count check from the Verification Checklist section.

### Step 6 — Cut over

Point the API's `DATABASE_URL` at the restored database and restart the application.

---

## Verification Checklist (Post-Restore)

```bash
# 1. Migration state
DATABASE_URL="$TARGET_DATABASE_URL" pnpm db:status

# 2. Health check (once API is running against restored DB)
curl -fs http://localhost:4000/health/ready

# 3. Row counts
psql "$TARGET_DATABASE_URL" -c "
SELECT
  (SELECT count(*) FROM \"User\")            AS users,
  (SELECT count(*) FROM \"Project\")         AS projects,
  (SELECT count(*) FROM \"Reservation\")     AS reservations,
  (SELECT count(*) FROM \"Contract\")        AS contracts,
  (SELECT count(*) FROM \"Installment\")     AS installments,
  (SELECT count(*) FROM \"Deposit\")         AS deposits,
  (SELECT count(*) FROM \"AuditLog\")        AS audit_logs;"

# 4. Spot-check a financial value
psql "$TARGET_DATABASE_URL" -c "SELECT id, amount FROM \"Installment\" LIMIT 5;"

# 5. Verify API serves traffic (manual)
# - Login with a known staff account
# - Check /health/ready returns 200 with database:ok and redis:ok
# - Spot-check one reservation or contract in admin panel
```

---

## Object Storage Disaster Recovery

### Current state (verified from repository)

**Two-bucket architecture — implemented in code, requires operator bucket creation**

| Property | Status |
|----------|--------|
| Public bucket | `R2_BUCKET` env var — marketing media (projects, units, banners, avatars) |
| Private bucket | `R2_PRIVATE_BUCKET` env var — sensitive objects (contracts, receipts, documents, maintenance) |
| Public bucket access | Public CDN domain (`R2_PUBLIC_URL`). Objects are served directly without auth. |
| Private bucket access | **No CDN domain**. Downloads require authenticated API request → presigned GET only. |
| Object key pattern | `{folder}/{YYYY-MM-DD}/{uuid}{ext}` — UUID-based, collision-proof, immutable |
| DB storage — public | Full CDN URL stored (e.g. `https://cdn.example.com/projects/.../img.jpg`) |
| DB storage — private | Bare object key stored (e.g. `documents/2026-08-12/<uuid>.pdf`) |
| R2 object versioning | **NOT SUPPORTED** — `GetBucketVersioning`/`PutBucketVersioning` are explicitly unsupported by Cloudflare R2 (S3 compatibility ❌). Do not attempt to enable. |
| R2 Bucket Locks (WORM) | **SUPPORTED** — prefix-based retention rules, up to 1,000 rules; prevents deletion for a specified duration or indefinitely. **This is the correct mechanism for contract/document retention.** |
| R2 Lifecycle Rules | **SUPPORTED** — expiration, Standard→Infrequent Access transitions, multipart abort |
| Bucket Locks configured | **OPERATOR ACTION REQUIRED** — not configured via repository; must be enabled in Cloudflare R2 dashboard |
| Application hard deletes | **Avatars only** — `R2Service.delete()` is called ONLY during avatar replacement (`users.service.ts`). Contracts, documents, and receipts are NEVER hard-deleted from R2 by application code. |

### Production recommendations

- [ ] Create two separate Cloudflare R2 buckets: one public (`R2_BUCKET`) + one private (`R2_PRIVATE_BUCKET`)
- [ ] Attach a public CDN custom domain to the **public** bucket only — the private bucket must NOT have a public custom domain or `r2.dev` access enabled
- [ ] Enable **Bucket Locks (WORM)** on the `contracts/` and `receipts/` prefixes in the **private** bucket
- [ ] Enable **Bucket Locks** on the `documents/` prefix in the private bucket (7-year regulatory retention)
- [ ] Configure **Lifecycle Rules** on the public bucket to transition `projects/` and `units/` objects > 90 days to Infrequent Access (cost reduction)
- [ ] For critical private documents, evaluate periodic cross-bucket export to cold storage for additional redundancy
- [ ] Env validation enforces `R2_BUCKET ≠ R2_PRIVATE_BUCKET` in production — same bucket defeats isolation and will prevent boot

### DB/File Consistency After Point-in-Time Restore

**Scenario:** DB restored to 10:00 AM; R2 reflects 10:20 AM.

Result:
- Files uploaded between 10:00–10:20 AM have no DB records → **orphaned files** (harmless but wasteful)
- Files deleted between 10:00–10:20 AM may be gone → **broken DB references** possible (R2 versioning is not supported; Bucket Locks prevent deletion but do not provide a recovery path if no lock was in place)

**Scenario:** DB reflects 10:20 AM; R2 restored to 10:00 AM.

Result:
- DB records for files uploaded 10:00–10:20 AM point to missing objects → **broken references**

**Minimum operational strategy:**

After any restore, perform a reference audit before returning to traffic:

```sql
-- Files the DB expects to exist (sample query):
SELECT "fileUrl" FROM "Document" WHERE "deletedAt" IS NULL
UNION ALL SELECT "pdfUrl" FROM "Contract" WHERE "pdfUrl" IS NOT NULL
UNION ALL SELECT "receiptUrl" FROM "Deposit" WHERE "receiptUrl" IS NOT NULL;
```

Pipe those keys through an S3 `HeadObject` check to identify missing objects. Accept orphaned files (safe to purge later); treat missing files as a data loss event requiring investigation.

---

## Disaster Recovery Matrix

### Scenario A — API container crashes

**Recovery:** Container orchestrator restarts the API automatically. Redis and PostgreSQL are unaffected. No data loss. RTO: seconds to < 2 minutes.

### Scenario B — Redis is lost

**Recovery:** Start a new Redis instance. Point `REDIS_URL` at it. Restart the API. Cron locks reset; all jobs resume on next tick. Rate limit counters reset (brief relaxed window). No business data loss. RTO: < 10 minutes.

### Scenario C — PostgreSQL database corrupted or deleted

**Recovery:**
1. Stop the API immediately (prevent writes to corrupted state).
2. Restore from the latest managed snapshot or `pg_dump` backup.
3. Run `prisma migrate status` — confirm schema is current.
4. Point `DATABASE_URL` at the restored database.
5. Restart the API.
6. Run the post-restore verification checklist.

RPO = time since last backup. RTO = restore time + verification (1–4 hours depending on DB size and infrastructure).

### Scenario D — Bad application deployment (no schema changes)

**Recovery:** Stop new API containers. Start previous image tag. No database action required — old code reads the same schema. RTO: < 5 minutes.

### Scenario E — Bad database migration (partially applied or broken)

**Recovery:**
1. Stop the deployment immediately — do not start the new API version.
2. Prisma does not support automatic rollback. Assess whether the migration partially applied:
   - If the schema is in a consistent (though possibly wrong) state → write a corrective forward migration.
   - If the schema is inconsistent → restore from the pre-deploy snapshot.
3. After restore: verify `prisma migrate status` is clean, then deploy the old API version.
4. Never edit a committed migration that has been applied to any environment.

### Scenario F — R2 object accidentally deleted

**Important:** Cloudflare R2 does NOT support object versioning (`GetBucketVersioning`/`PutBucketVersioning` are unsupported). There is no "restore from deleted version" capability. The correct protection mechanism is **Bucket Locks (WORM)**, which prevents deletion entirely.

**Recovery (Bucket Lock on prefix):** The `DeleteObject` call will be rejected by R2 — the object cannot be deleted while a retention rule is active. No recovery action needed; operator should investigate why a deletion was attempted.

**Recovery (no Bucket Lock, object permanently lost):** Object is gone. If the object was a document or contract, the DB record still exists but the download link is broken. Operator must:
- Source the file from an alternative (customer email attachment, local copy)
- Re-upload using the admin media presign endpoint and update the DB record (`fileUrl`, `pdfUrl`, `receiptUrl`, etc.)
- Consider this a data loss event and document it in the audit log

**This underscores why Bucket Locks must be enabled on `contracts/` and `receipts/` prefixes before production traffic.**

---

## Backup Retention Recommendation

> These are recommendations. Current infrastructure may not enforce them.

| Tier | Retention |
|------|-----------|
| Daily logical backups (`db:backup`) | 14 days |
| Weekly managed snapshots | 8 weeks |
| Monthly managed snapshots | 12 months |
| PITR window (if managed provider supports) | 7 days minimum, 30 days preferred |

For contract PDFs and payment proofs in object storage: **never delete** (regulatory and audit requirement).

---

## Backup Security

- Backup files contain all customer PII, financial data, and hashed passwords.
- Store backup files **encrypted at rest** in a separate storage location from the application bucket.
- Restrict backup access to operators only — no application role should be able to read backup files.
- Backup credentials (storage bucket access keys) must not be committed to this repository.
- `DATABASE_URL` is never printed by the backup or restore scripts.
- The `backups/` directory and `*.dump` / `*.pgdump` files are in `.gitignore`.
- Restore script requires explicit `TARGET_DATABASE_URL` — not inherited from `DATABASE_URL`.
- Restore safety guard refuses execution against database names that do not contain `test`, `restore`, `disposable`, `dr`, or `staging`.

---

## Operator Checklist (Pre-Deploy)

- [ ] Take a logical backup: `DATABASE_URL="$PROD_URL" ./scripts/db-backup.sh`
- [ ] Confirm the backup file is non-zero and the timestamp is current
- [ ] Confirm managed provider snapshot is recent (or trigger one manually)
- [ ] Store the backup in durable off-site storage immediately
- [ ] Confirm rollback image tag is available
- [ ] Proceed with `pnpm db:deploy` only after backup is verified

## Operator Checklist (Post-Restore)

- [ ] `DATABASE_URL=<restored> pnpm db:status` → "Database schema is up to date!"
- [ ] `GET /health/ready` returns 200 with `{ database: "ok", redis: "ok" }`
- [ ] Login with a known staff account succeeds
- [ ] User, Project, Reservation, Contract counts are reasonable
- [ ] At least one financial value (Installment.amount) spot-checked for accuracy
- [ ] Object storage accessible (spot-check one document download link)
- [ ] Sentry/logging active — no unexpected errors in first 5 minutes
- [ ] Team notified of the restore event and RPO window
