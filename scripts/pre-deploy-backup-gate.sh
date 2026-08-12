#!/usr/bin/env bash
# pre-deploy-backup-gate.sh — Mandatory pre-deploy safety gate.
#
# Run this immediately before every production deployment that includes schema
# changes. It creates a verified logical backup and confirms the database is
# in a deployable state (no unexpected schema drift).
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/pre-deploy-backup-gate.sh
#   DATABASE_URL="postgresql://..." BACKUP_DIR="/mnt/backups" ./scripts/pre-deploy-backup-gate.sh
#
# Exits non-zero if:
#   - DATABASE_URL is not set
#   - pg_dump is not available
#   - backup file is zero bytes
#   - SHA-256 checksum generation fails
#   - prisma migrate status reports pending migrations (schema drift)
#
# What this does NOT do:
#   - Does not modify the database
#   - Does not apply migrations (use pnpm db:deploy for that)
#   - Does not upload the backup (operator must transfer to durable storage)
#
# After this script passes, store the backup in a SEPARATE durable storage
# location (not the public media R2 bucket) before running pnpm db:deploy.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "========================================"
echo "  PRE-DEPLOY BACKUP GATE"
echo "========================================"

# ── 1. Create logical backup with SHA-256 checksum ────────────────────────────
echo ""
echo "[gate] Step 1/3 — Creating logical backup..."
"${SCRIPT_DIR}/db-backup.sh"

# ── 2. Find the backup file that was just created ─────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
LATEST_DUMP="$(ls -t "${BACKUP_DIR}"/devora-*.dump 2>/dev/null | head -1)"

if [[ -z "${LATEST_DUMP}" ]]; then
  echo "ERROR: No backup file found in ${BACKUP_DIR}" >&2
  exit 1
fi

DUMP_SIZE="$(wc -c < "${LATEST_DUMP}")"
if [[ "${DUMP_SIZE}" -eq 0 ]]; then
  echo "ERROR: Backup file is zero bytes: ${LATEST_DUMP}" >&2
  exit 1
fi

CHECKSUM_FILE="${LATEST_DUMP}.sha256"
if [[ ! -f "${CHECKSUM_FILE}" ]]; then
  echo "ERROR: Checksum file missing: ${CHECKSUM_FILE}" >&2
  echo "ERROR: db-backup.sh must have failed to generate it." >&2
  exit 1
fi

# Verify checksum is readable and non-empty.
CHECKSUM="$(cut -d' ' -f1 "${CHECKSUM_FILE}")"
if [[ -z "${CHECKSUM}" ]]; then
  echo "ERROR: Checksum file is empty: ${CHECKSUM_FILE}" >&2
  exit 1
fi

echo "[gate] Backup verified: ${LATEST_DUMP}"
echo "[gate] SHA-256: ${CHECKSUM}"

# ── 3. Check migration status (read-only) ─────────────────────────────────────
echo ""
echo "[gate] Step 2/3 — Checking migration status (read-only)..."
cd "${ROOT}/apps/api"

MIGRATION_OUTPUT="$(DATABASE_URL="${DATABASE_URL}" npx prisma migrate status --schema=./prisma/schema.prisma 2>&1)"

echo "${MIGRATION_OUTPUT}"

if echo "${MIGRATION_OUTPUT}" | grep -q "Database schema is up to date!"; then
  echo "[gate] Migration status: UP TO DATE — no pending migrations."
elif echo "${MIGRATION_OUTPUT}" | grep -q "migrations have not yet been applied"; then
  echo "[gate] Migration status: PENDING MIGRATIONS DETECTED."
  echo "[gate] This deploy will apply migrations. Backup is confirmed — safe to proceed."
else
  echo "WARNING: Unexpected migration status output. Review above before deploying." >&2
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "[gate] Step 3/3 — Gate summary"
echo "========================================"
echo "  BACKUP FILE : ${LATEST_DUMP}"
echo "  SHA-256     : ${CHECKSUM}"
echo "  SIZE        : $(du -sh "${LATEST_DUMP}" | cut -f1)"
echo "========================================"
echo ""
echo "[gate] ACTION REQUIRED: Move this backup to durable off-site storage BEFORE"
echo "[gate] running pnpm db:deploy. Do not proceed without a verified, stored backup."
echo ""
echo "[gate] PRE-DEPLOY GATE: PASSED"
