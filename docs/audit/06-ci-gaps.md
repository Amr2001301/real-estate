# CI Gaps — Audit

> Generated 2026-09-13. Source: `.github/workflows/ci.yml` (read verbatim).
> This document records exact gaps in CI coverage and proposes a minimal fix.
> The proposed diff is shown but NOT applied.

---

## Gap 1 — Security suite is never run in CI

**File:** `.github/workflows/ci.yml`
**Finding:** No job in the workflow references `jest -c test/jest-security.json`
or `test/jest-security.json` in any form. The 82-test security suite
(`test/security/`) is completely invisible to CI.

**Consequence:** The 17 body-supplied FK vulnerabilities (V-01..V-17), the
`$queryRaw` cross-tenant guard, the `LeadScopeGuard` row-level enforcement, and
all cross-tenant regression tests could regress silently on every PR. The entire
`apps/api/test/security/` directory is dead code from CI's perspective.

**Evidence:** `grep -r "jest-security" .github/` returns no matches.

---

## Gap 2 — `api-unit` is path-filtered; skipped on non-API PRs

**File:** `.github/workflows/ci.yml`, lines 136-137 and 34-39
```yaml
api-unit:
  name: api · jest (unit)
  needs: [changes, build]
  if: needs.changes.outputs.api == 'true'
  ...
  - name: Run unit tests
    working-directory: apps/api
    run: pnpm test                        # line 152
```

```yaml
# lines 34-39 — api filter definition
api:
  - 'apps/api/**'
  - 'packages/shared-types/**'
  - 'packages/tsconfig/**'
  - 'pnpm-lock.yaml'
  - '.github/workflows/ci.yml'
```

**Consequence:** A PR that only changes `docs/`, `apps/web-admin/`, or
`apps/web-public/` skips `api-unit` entirely. This is the intended behaviour for
the heavier jobs, but it means a docs-only PR can be merged even if the unit
suite is already broken on main. The two broken suites (`notifications-permissions`,
`reservation-conversion-workflow`) persisted for 3+ weeks precisely because the
API changed without the CI gate catching it — the commits that broke the suites
(`06a6172`, `d489400`) DID touch `apps/api/**`, so the filter fired. The deeper
issue is the next gap.

---

## Gap 3 — No branch protection rules enforcing status checks

**Finding (inferred):** The two broken test suites failed for ≥3 weeks on `main`
(commits `06a6172` 2026-08-20 and `d489400` 2026-08-18). If branch protection
required `api-unit` to pass before merging, those PRs could not have been merged.

The workflow has no `continue-on-error: true` on the `api-unit` job (lines
134-157) — a failing unit suite would mark the job red. But a red job only blocks
merge if it is listed as a required status check in the repository's branch
protection settings.

**Consequence:** CI can fail (red `api-unit`) while PRs are still merged.
Broken tests accumulate silently.

---

## Gap 4 — No coverage threshold

**File:** `.github/workflows/ci.yml` line 152; `apps/api/jest.config.js`
```yaml
- name: Run unit tests
  working-directory: apps/api
  run: pnpm test      # no --coverage flag, no coverageThreshold
```

`apps/api/jest.config.js` has no `collectCoverage` or `coverageThreshold` key.

**Consequence:** Test coverage can degrade arbitrarily across PRs. A developer
who deletes a test file will not see a CI failure.

---

## Summary table

| Gap | Severity | Description |
|---|---|---|
| G1 | Critical | Security suite never runs in CI |
| G2 | Medium | `api-unit` path-filter is correct but branch protection is absent |
| G3 | Critical | No required status checks → broken tests merged to main |
| G4 | Low | No coverage threshold |

---

## Proposed minimal fix

The fix addresses G1 (security suite in CI) and G3 (make the security job a
merge requirement). G2 and G4 are left as-is: the path-filter is intentional
(avoids expensive DB setup for unrelated PRs), and coverage thresholds are a
separate conversation.

### Diff (DO NOT apply — for review only)

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -155,6 +155,61 @@ jobs:
           JWT_ACCESS_SECRET: ci-access-secret-placeholder-1234567890
           JWT_REFRESH_SECRET: ci-refresh-secret-placeholder-1234567890
 
+  # ─────────────────────────────────────────────────────────────────────────────
+  # Security test suite (real Postgres, real Nest app). Tests V-01..V-17 body-
+  # supplied FK cross-tenant checks, $queryRaw guard, LeadScopeGuard, and the
+  # full attack matrix. Runs whenever API code changes (same path filter as
+  # api-unit). A failing security suite must block merge.
+  # ─────────────────────────────────────────────────────────────────────────────
+  api-security:
+    name: api · jest (security, real Postgres)
+    needs: [changes, build]
+    if: needs.changes.outputs.api == 'true'
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    services:
+      postgres:
+        image: postgres:16-alpine
+        env:
+          POSTGRES_USER: postgres
+          POSTGRES_PASSWORD: postgres
+          POSTGRES_DB: realestate_e2e
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -U postgres"
+          --health-interval 5s
+          --health-timeout 5s
+          --health-retries 10
+    env:
+      NODE_ENV: test
+      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/realestate_e2e?schema=public
+      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/realestate_e2e?schema=public
+      JWT_ACCESS_SECRET: ci-access-secret-placeholder-1234567890
+      JWT_REFRESH_SECRET: ci-refresh-secret-placeholder-1234567890
+      # Security tests use globalSetup (same as e2e) which applies migrations +
+      # seeds the Permission table. SEED_ADMIN_EMAIL must match the seed default.
+      SEED_ADMIN_EMAIL: admin@example.com
+      SEED_ADMIN_PASSWORD: ChangeMe123!
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v4
+        with: { version: 9.15.9, run_install: false }
+      - uses: actions/setup-node@v4
+        with: { node-version: 20, cache: pnpm }
+      - run: pnpm install --frozen-lockfile
+      - name: Generate Prisma client
+        working-directory: apps/api
+        run: pnpm prisma:generate
+      - name: Run security tests
+        working-directory: apps/api
+        run: pnpm exec jest -c test/jest-security.json --runInBand
+
   # ─────────────────────────────────────────────────────────────────────────────
   # Mobile static analysis + unit/widget tests across all 3 packages.
```

### Required GitHub repository setting (not in YAML)

In **Settings → Branches → Branch protection rules → main**:
- Enable "Require status checks to pass before merging"
- Add `api · jest (unit)` and `api · jest (security, real Postgres)` as required checks

Without this setting, the CI jobs are advisory only — a red job does not block merge.

### What this achieves

| Before | After |
|---|---|
| Security suite: never runs | Runs on every API PR, blocks merge on failure |
| Unit suite: runs but not required | Runs (unchanged); adding it as a required check blocks failure from merging |
| V-01..V-17 regression: undetected | Caught in CI before PR is merged |
| Broken suites can survive 3+ weeks | Caught on the next PR that touches `apps/api/**` |
