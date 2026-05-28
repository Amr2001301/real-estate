#!/usr/bin/env bash
# release-verify.sh — Phase 7F local release verification.
#
# One command that walks every gate the platform has set up so far. Each
# section runs independently, prints PASS/FAIL/SKIP with a one-line reason,
# and the script exits non-zero if any required section failed.
#
# Sections:
#   1. Backend Jest unit tests
#   2. Backend Jest e2e tests (requires TEST_DATABASE_URL pointing at a
#      DEDICATED e2e DB whose name contains "test" or "e2e")
#   3. Web Admin Playwright (requires services on http://localhost:3001
#      pointed at the e2e backend; the script will skip if they are not up)
#   4. Web Public Playwright (requires services on http://localhost:3002)
#   5. Mobile flutter analyze + flutter test for core + customer + staff
#   6. Zero Riverpod (mobile lib + pubspecs)
#   7. Clean Architecture boundary checks
#   8. No-secrets grep across the mobile tree + new docs
#
# This script is intentionally NON-DESTRUCTIVE unless TEST_DATABASE_URL is
# explicitly set. Section 2 will reset + seed `$TEST_DATABASE_URL` ONLY if
# the existing jest globalSetup safety guards accept it (must not equal
# DATABASE_URL; DB name must contain `e2e`/`test`).
#
# Usage:
#   scripts/release-verify.sh                # run all sections; skip ones whose
#                                            # prereqs aren't met (services down,
#                                            # TEST_DATABASE_URL unset, etc.)
#   TEST_DATABASE_URL=postgresql://… scripts/release-verify.sh
#                                            # exercises section 2 too
#
# Exits non-zero if any non-SKIPPED section failed.

set -u
set -o pipefail

# Find repo root (this script may be invoked from anywhere).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# Reporting helpers — print a one-line status per section + collect a summary.
# ─────────────────────────────────────────────────────────────────────────────
declare -a STATUS_LINES=()
EXIT_CODE=0

section() {
  printf '\n\033[1m==> %s\033[0m\n' "$1"
}
pass() {
  STATUS_LINES+=("✓ PASS  $1")
  printf '\033[32m✓ PASS\033[0m  %s\n' "$1"
}
fail() {
  STATUS_LINES+=("✗ FAIL  $1")
  printf '\033[31m✗ FAIL\033[0m  %s\n' "$1"
  EXIT_CODE=1
}
skip() {
  STATUS_LINES+=("◌ SKIP  $1 — $2")
  printf '\033[33m◌ SKIP\033[0m  %s — %s\n' "$1" "$2"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. Backend Jest unit tests (mocked Prisma)
# ─────────────────────────────────────────────────────────────────────────────
section '1/8 — Backend Jest unit tests'
if pnpm --filter @rep/api test 2>&1 | tail -6 | tee /tmp/release-1.log | grep -qE "passed.*total"; then
  pass 'backend unit'
else
  fail 'backend unit — see /tmp/release-1.log'
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Backend Jest e2e (real Postgres)
# Requires TEST_DATABASE_URL. The existing jest globalSetup validates it
# refuses to run if TEST_DATABASE_URL is unset, equals DATABASE_URL, or names
# a DB without "e2e"/"test". So we just propagate it and let jest fail loud.
# ─────────────────────────────────────────────────────────────────────────────
section '2/8 — Backend Jest e2e (real ephemeral Postgres)'
if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  skip 'backend e2e' 'TEST_DATABASE_URL is unset (see docs/system-qa-strategy.md §0.1)'
else
  if pnpm --filter @rep/api test:e2e 2>&1 | tail -6 | tee /tmp/release-2.log | grep -qE "passed.*total"; then
    pass 'backend e2e'
  else
    fail 'backend e2e — see /tmp/release-2.log'
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Web Admin Playwright suite
# Probes :3001 first; if the admin web isn't running we skip (rather than
# burning ~30s trying to spin one up — the script is meant to be fast).
# ─────────────────────────────────────────────────────────────────────────────
section '3/8 — Web Admin Playwright suite'
if ! curl -fs -o /dev/null http://localhost:3001/login 2>/dev/null; then
  skip 'web-admin playwright' 'no server on http://localhost:3001 (start with `pnpm --filter @rep/web-admin dev`)'
else
  if ( cd apps/web-admin && E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3001 pnpm exec playwright test 2>&1 ) | tail -6 | tee /tmp/release-3.log | grep -qE "passed|skipped"; then
    if grep -qE "[0-9]+ failed" /tmp/release-3.log; then
      fail 'web-admin playwright — failures in /tmp/release-3.log'
    else
      pass 'web-admin playwright'
    fi
  else
    fail 'web-admin playwright — see /tmp/release-3.log'
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Web Public Playwright suite
# ─────────────────────────────────────────────────────────────────────────────
section '4/8 — Web Public Playwright suite'
if ! curl -fs -o /dev/null http://localhost:3002/ 2>/dev/null; then
  skip 'web-public playwright' 'no server on http://localhost:3002 (start with `pnpm --filter @rep/web-public dev`)'
else
  if ( cd apps/web-public && E2E_NO_WEBSERVER=1 E2E_BASE_URL=http://localhost:3002 pnpm exec playwright test 2>&1 ) | tail -6 | tee /tmp/release-4.log | grep -qE "passed|skipped"; then
    if grep -qE "[0-9]+ failed" /tmp/release-4.log; then
      fail 'web-public playwright — failures in /tmp/release-4.log'
    else
      pass 'web-public playwright'
    fi
  else
    fail 'web-public playwright — see /tmp/release-4.log'
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Mobile flutter analyze + flutter test ×3
# ─────────────────────────────────────────────────────────────────────────────
section '5/8 — Mobile flutter analyze + flutter test'
mobile_ok=1
for pkg in packages/core mobile_customer mobile_staff; do
  if ! ( cd "apps/mobile/$pkg" && flutter analyze 2>&1 | tail -1 | grep -qE "No issues found" ); then
    fail "mobile analyze: $pkg"; mobile_ok=0
  fi
  if ! ( cd "apps/mobile/$pkg" && flutter test 2>&1 | tr '\r' '\n' | grep -qE "All tests passed" ); then
    fail "mobile test: $pkg"; mobile_ok=0
  fi
done
[[ $mobile_ok -eq 1 ]] && pass 'mobile analyze + test (core + customer + staff)'

# ─────────────────────────────────────────────────────────────────────────────
# 6. Zero Riverpod (lib + pubspec)
# ─────────────────────────────────────────────────────────────────────────────
section '6/8 — Zero Riverpod'
if grep -rEqn "riverpod|hooks_riverpod" \
     apps/mobile/packages/core/lib \
     apps/mobile/mobile_customer/lib \
     apps/mobile/mobile_staff/lib \
     apps/mobile/packages/core/pubspec.yaml \
     apps/mobile/mobile_customer/pubspec.yaml \
     apps/mobile/mobile_staff/pubspec.yaml 2>/dev/null; then
  fail 'zero-riverpod (Riverpod references found above)'
else
  pass 'zero-riverpod'
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. Clean Architecture boundary checks
# ─────────────────────────────────────────────────────────────────────────────
section '7/8 — Clean Architecture boundaries'
viol=$( {
  find apps/mobile/packages/core/lib apps/mobile/mobile_customer/lib apps/mobile/mobile_staff/lib \
       -path '*/presentation/*' -name '*.dart' \
       -exec grep -lE "import.*/data/" {} \;
  find apps/mobile/packages/core/lib apps/mobile/mobile_customer/lib apps/mobile/mobile_staff/lib \
       -path '*/domain/*' -name '*.dart' \
       -exec grep -lE "import.*/data/|package:flutter/material" {} \;
} 2>/dev/null )
if [[ -z "$viol" ]]; then
  pass 'clean-architecture boundaries (no domain→data, no domain→flutter, no presentation→data)'
else
  fail "clean-architecture boundaries — violations:\n$viol"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. No-secrets grep
# ─────────────────────────────────────────────────────────────────────────────
section '8/8 — No-secrets grep'
if grep -rE 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]+PRIVATE KEY-----|AC[a-f0-9]{32}|SK[a-f0-9]{32}' \
     apps/api/test apps/api/prisma/SEED_USERS.md apps/api/prisma/seed-e2e.ts \
     apps/web-public/e2e apps/web-public/src/components/account \
     apps/web-admin/e2e \
     apps/mobile/mobile_customer/integration_test apps/mobile/mobile_staff/integration_test \
     docs/system-qa-strategy.md docs/manual-qa-checklists.md \
     .github/workflows/ci.yml scripts/release-verify.sh \
     2>/dev/null >/dev/null; then
  fail 'secret-shaped strings found (see grep output above)'
else
  pass 'no-secrets'
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf '\n\033[1m──────────────────────────────────────────\nRELEASE VERIFY SUMMARY\n──────────────────────────────────────────\033[0m\n'
for line in "${STATUS_LINES[@]}"; do printf '%s\n' "$line"; done
if [[ $EXIT_CODE -eq 0 ]]; then
  printf '\n\033[32m✓ release-verify: all required gates passed\033[0m\n'
else
  printf '\n\033[31m✗ release-verify: one or more gates failed (see above)\033[0m\n'
fi
exit $EXIT_CODE
