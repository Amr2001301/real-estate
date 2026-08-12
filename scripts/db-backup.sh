#!/usr/bin/env bash
# db-backup.sh — Create a portable logical backup of the PostgreSQL database.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/db-backup.sh
#   DATABASE_URL="postgresql://..." BACKUP_DIR="/mnt/backups" ./scripts/db-backup.sh
#
# Output:
#   <BACKUP_DIR>/devora-YYYYMMDD-HHMMSS.dump       (pg_dump custom format)
#   <BACKUP_DIR>/devora-YYYYMMDD-HHMMSS.dump.sha256 (SHA-256 checksum)
#
# Verification:
#   sha256sum --check devora-YYYYMMDD-HHMMSS.dump.sha256
#   shasum -a 256 --check devora-YYYYMMDD-HHMMSS.dump.sha256  # macOS
#
# The custom format is compressed, supports parallel restore, and allows
# selective table/schema restores. It is NOT human-readable SQL.
#
# Safety:
#   - Never prints DATABASE_URL or credentials.
#   - Fails immediately on any error (set -euo pipefail).
#   - Does not DROP, TRUNCATE, or modify any database.
#   - Backup files contain sensitive customer data — store encrypted at rest
#     and restrict access to operators only.

set -euo pipefail

# ── configuration ─────────────────────────────────────────────────────────────
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="${BACKUP_DIR}/devora-${TIMESTAMP}.dump"
CHECKSUMFILE="${OUTFILE}.sha256"

# ── verify pg_dump is available ───────────────────────────────────────────────
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

# ── create output directory ───────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── run backup ────────────────────────────────────────────────────────────────
echo "[backup] Starting backup at ${TIMESTAMP}"
echo "[backup] Output: ${OUTFILE}"

# PGPASSWORD is set from the URL by pg_dump automatically when using a connection
# string. We do not echo the URL. --no-password prevents interactive prompt.
pg_dump \
  "${DB_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --no-password \
  --file="${OUTFILE}"

# ── verify output ─────────────────────────────────────────────────────────────
SIZE="$(du -sh "${OUTFILE}" 2>/dev/null | cut -f1)"
echo "[backup] Completed. Size: ${SIZE}"
echo "[backup] File: ${OUTFILE}"

# ── generate SHA-256 checksum ─────────────────────────────────────────────────
# Detect available checksum tool (Linux vs macOS).
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${OUTFILE}" > "${CHECKSUMFILE}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${OUTFILE}" > "${CHECKSUMFILE}"
else
  echo "WARNING: No SHA-256 tool found (sha256sum or shasum). Checksum skipped." >&2
  echo "WARNING: Install coreutils or shasum for integrity verification." >&2
  exit 0
fi

CHECKSUM="$(cut -d' ' -f1 "${CHECKSUMFILE}")"
echo "[backup] SHA-256: ${CHECKSUM}"
echo "[backup] Checksum file: ${CHECKSUMFILE}"
echo "[backup] Verify with: sha256sum --check ${CHECKSUMFILE}"

# ── security reminder ─────────────────────────────────────────────────────────
echo "[backup] SECURITY: This file contains all customer PII and financial data."
echo "[backup] SECURITY: Encrypt at rest and restrict access immediately."
