#!/usr/bin/env bash
# db-restore-test.sh — Restore a pg_dump backup into a DISPOSABLE test database.
#
# Usage:
#   TARGET_DATABASE_URL="postgresql://..." DUMP_FILE="./backups/devora-20260812.dump" \
#     ./scripts/db-restore-test.sh
#
# CRITICAL SAFETY RULE:
#   TARGET_DATABASE_URL MUST contain one of these strings in the database name:
#     test | restore | disposable | dr | staging
#   The script refuses to run against any other database name.
#   This prevents accidental restoration into production.
#
# The target database must already exist (CREATE DATABASE was run externally).
# The script drops and recreates all schemas inside the target database,
# then restores the backup. It does NOT drop the database itself.
#
# Never run this script with your production DATABASE_URL.

set -euo pipefail

# ── required inputs ───────────────────────────────────────────────────────────
DUMP_FILE="${DUMP_FILE:?DUMP_FILE must be set to the .dump file path}"
TARGET_URL="${TARGET_DATABASE_URL:?TARGET_DATABASE_URL must be set}"

# ── safety guard ──────────────────────────────────────────────────────────────
# Extract the database name from the URL: last path segment before any ?params
DB_NAME="$(echo "${TARGET_URL}" | sed 's|.*\/||' | sed 's|?.*||')"

ALLOWED_PATTERN="test|restore|disposable|dr|staging"
if ! echo "${DB_NAME}" | grep -qE "(${ALLOWED_PATTERN})"; then
  echo "ERROR: Refusing to restore into database '${DB_NAME}'." >&2
  echo "ERROR: TARGET_DATABASE_URL database name must contain one of:" >&2
  echo "ERROR:   test | restore | disposable | dr | staging" >&2
  echo "ERROR: This guard prevents accidental production overwrites." >&2
  exit 1
fi

echo "[restore] Safety check passed: target database is '${DB_NAME}'"

# ── verify tools ──────────────────────────────────────────────────────────────
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore not found. Install postgresql-client." >&2
  exit 1
fi

# ── verify dump file ──────────────────────────────────────────────────────────
if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERROR: Dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

SIZE="$(du -sh "${DUMP_FILE}" | cut -f1)"
echo "[restore] Dump file: ${DUMP_FILE} (${SIZE})"
echo "[restore] Target database: ${DB_NAME}"

# ── restore ───────────────────────────────────────────────────────────────────
# --clean: drop objects before recreating them (clean slate in target)
# --if-exists: don't error if objects don't exist yet (first restore)
# --no-owner: don't restore ownership (target DB user owns everything)
# --no-acl: don't restore GRANT/REVOKE (target permissions differ)
# --single-transaction: wrap restore in a transaction — all or nothing
# --exit-on-error: abort on first restore error
echo "[restore] Starting restore..."

pg_restore \
  --dbname="${TARGET_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --single-transaction \
  --exit-on-error \
  "${DUMP_FILE}"

echo "[restore] Restore completed successfully."
echo "[restore] Target: ${DB_NAME}"
echo "[restore] Next step: run 'prisma migrate status' against TARGET_DATABASE_URL to verify schema."
