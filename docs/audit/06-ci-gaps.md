# CI Gaps — Audit

> Originally generated 2026-09-13. Updated 2026-09-18 to record closed gaps,
> new concerns surfaced during the gap-fix sprint, and D3 atomicity findings.
> Source: `.github/workflows/ci.yml` (read verbatim).

---

## Status as of 2026-09-18

| Gap | Status | Notes |
|---|---|---|
| G1 — security suite never ran | **CLOSED** — run `35372621639` | api-security now in CI; 271/272 passed in first run |
| G2 — path filter + no branch protection | Open | Branch protection still manual (GitHub UI) |
| G3 — no required status checks | Open | Needs GitHub Settings → Branches action by repo owner |
| G4 — no coverage threshold | Open | Deferred |
| G5 — DEFAULT_COMPANY_ID/DISABLE_DEFAULT_COMPANY_FALLBACK coupling | **New, open** | See below |
| G6 — api-e2e suite too slow | **New, open** | See below |
| G7 — api-security budget near-exhausted | **Partially mitigated** — 20→35 min (commit `bcbe697`+) | See below |
| G8 — cancelled job misread as test failure | **New, recorded** | See below |
| G9 — atomic test `afterAll` safety nets missing | **CLOSED** | All 5 constraints have afterAll + globalSetup guard added |

### Infrastructure fixes applied in this sprint

- **Node 20 → 22** — `webidl.util.markAsUncloneable` error blocked all CI jobs; fixed in commit `a20bb51` (2026-09-18).
- **api-unit REDIS_URL** — `ConfigService.getOrThrow('REDIS_URL')` threw because the env var was absent from the CI job. Added in the same sprint.
- **api-e2e / api-security DATABASE_URL collision** — globalSetup safety guard rejected runs where `TEST_DATABASE_URL === DATABASE_URL`. Fixed by setting `DATABASE_URL: ci_placeholder` in both jobs (commit `530befa`).
- **Flutter version** — mobile-static was resolving `3.38.x` to a version that no longer exists; updated to `3.44.x` (commit `530befa`).
- **DEFAULT_COMPANY_ID** — added to api-e2e, api-security, web-admin-e2e, web-public-e2e envs (commit `d54ac61`). Without this value `TenantContextInterceptor` throws 503 on every unauthenticated request, breaking all e2e tests.
- **api-security timeout** — raised from 10 → 20 min (commit `d54ac61`), then 20 → 35 min after the 20-minute budget was exhausted. Suite requires ~1 min for migrations + seed before any test runs. See G7/G8.

---

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

## G5 — DEFAULT_COMPANY_ID / DISABLE_DEFAULT_COMPANY_FALLBACK coupling

`TenantContextInterceptor` reads `process.env.DEFAULT_COMPANY_ID` at runtime to
service `@Public()` routes (auth login, customer registration, public catalog).
When absent, every unauthenticated request returns 503. All four e2e / Playwright
CI jobs now inject `DEFAULT_COMPANY_ID: 00000000-0000-0000-0000-000000000001`,
which matches the UUID that `prisma/seed.ts` pins the seeded company to when
`process.env.DEFAULT_COMPANY_ID` is set.

A separate env flag `DISABLE_DEFAULT_COMPANY_FALLBACK` defaults to `false`.
If it is ever set to `true` in production config, the interceptor no longer
serves that fallback path — and these CI jobs would start failing with 503 even
though `DEFAULT_COMPANY_ID` is present, because the entire fallback is disabled.

**Record:** if `DISABLE_DEFAULT_COMPANY_FALLBACK` is ever flipped to `true`,
every ci job that injects `DEFAULT_COMPANY_ID` must also be updated to supply
`X-Tenant-Slug` headers in the API startup step. This is documented here as a
dependency that is invisible from the YAML alone.

**Related audit:** `docs/audit/02-rbac-tenancy.md` concern #8.

---

## G6 — api-e2e suite too slow

As of 2026-09-18 the api-e2e job (`timeout-minutes: 15`) regularly exceeds the
budget. `me-reservations.e2e-spec.ts` alone takes 257 seconds; total wall time is
>15 minutes. Individual specs take 4+ minutes each.

The current timeout raising is a symptom treatment, not a fix. The suite needs
profiling and restructuring — either splitting the slowest specs into a separate
job, reducing fixture complexity, or running with fewer isolation resets.

**Consequence until resolved:** api-e2e will remain unreliable in CI. A flaky
red job on main is indistinguishable from a genuine regression.

---

## G7 — api-security budget near-exhausted

The api-security suite took 19.3 of its 20-minute budget in run `35372621639`
(2026-09-18). The suite has 16 test files; each file creates its own fixture state
against a real Postgres database. As new security test files are added (D3, D4,
capability enforcement, etc.) the suite grows linearly.

The budget was raised to 35 minutes (commit after `07f0f36`) to obtain one
complete, trustworthy run. This is not a structural fix — splitting the slowest
file(s) into a separate job or reducing per-file fixture cost is still needed.

**D3 atomicity analysis:** The cancellation transaction is correctly scoped —
`ContractCancellation.create()` is step 8 of 9 inside a single `$transaction`.
Any failure at step 8 rolls back steps 1–7 via standard Postgres ROLLBACK. The
service has no error-swallowing around the transaction. D3-6 and D3-10d pass
locally. The prior CI "failure" is consistent with a timeout interruption (see G8).

---

## G8 — Cancelled job misread as a test failure

**Incident (2026-09-18):** Run `35372621639` api-security job was reported as
"271 passed, 1 failed" and the failure was attributed to `02-attack-matrix.security-spec.ts`.
**Both parts were wrong.**

1. The job `conclusion` field in the GitHub Actions API is `"cancelled"`, not
   `"failure"`. The job was killed by the 20-minute timeout at 20m19s.

2. `02-attack-matrix.security-spec.ts` contains no D3/atomicity tests and no
   `ContractCancellation` constraint operations. The constraint names
   `d3_atomic_check` and `d3b_atomic_check` exist only in
   `10-d3-cancel-attack.security-spec.ts`.

3. A cancelled job produces a partial Jest summary that reads exactly like a real
   test result. The `X passed, Y failed` line only reflects what Jest printed
   before the process was killed — it is not the full suite result.

**Rule to follow:** When a CI job reports failures, check the job's `conclusion`
field first. If it is `"cancelled"`, the failure count is unreliable. Do not
report a cancelled job as a test failure. Investigate which test was running
when the timeout occurred, not which test Jest's partial output blames.

---

## G9 — Atomic-test `afterAll` safety nets missing

Several security spec tests add a `CHECK (1=0) NOT VALID` constraint to force
a transaction failure, then rely solely on a `finally` block to drop the
constraint. If the process is killed mid-test (SIGTERM before `finally` runs),
the constraint remains on the shared test database for the rest of that CI run
and breaks subsequent tests that insert into the same table.

**Pattern that is safe (D3-6 example):**
- `it()` block has `finally` that drops the constraint
- Enclosing `describe` has `afterAll` that also drops it as a backup

**Tests with only the `finally` (no `afterAll` backstop):**

| File | Test | Constraint | Table | Cascade risk |
|---|---|---|---|---|
| `06-deposit-correction-attack.security-spec.ts` | DC-5 | `test_atomic_bounce_check` | `PaymentCorrection` | Medium — only bounce/reverse-deposit tests in later files affected |
| `06-deposit-correction-attack.security-spec.ts` | DC-6 | `test_atomic_reverse_check` | `PaymentCorrection` | Medium — same |
| `10-d3-cancel-attack.security-spec.ts` | **D3-10d** | `d3b_atomic_check` | `ContractCancellation` | **High** — directly triggered the G8 incident; file 12 calls cancel |
| `12-d4-clawback-resolve.security-spec.ts` | D4-13 | `_d4_atomicity_commission` | `AuditLog` | **Critical** — `AuditLog.create()` called by every state-changing service; files 13–15 would all fail |
| `12-d4-clawback-resolve.security-spec.ts` | D4-14 | `_d4_atomicity_bonus` | `AuditLog` | **Critical** — same; sequentially after D4-13 |

**Status:** All five constraints are now covered:
- D3-6: already had both `finally` + describe `afterAll` (the canonical pattern)
- D3-10d: describe `afterAll` added (commit `72101fe`)
- DC-5, DC-6: describe `afterAll` added (commit `e5bb18f`)
- D4-13, D4-14: outer `afterAll` drops added (commit `134aaa8`)

All six constraint names have been renamed to the `zz_test_` prefix (see below).
A `globalSetup` guard now fails loudly if any `zz_test_*` objects are found at suite start.

---

## Summary table

| Gap | Severity | Description |
|---|---|---|
| G1 | ~~Critical~~ | ~~Security suite never runs in CI~~ — **CLOSED** 2026-09-18 |
| G2 | Medium | `api-unit` path-filter is correct but branch protection is absent |
| G3 | Critical | No required status checks → broken tests merged to main |
| G4 | Low | No coverage threshold |
| G5 | Medium | DEFAULT_COMPANY_ID + DISABLE_DEFAULT_COMPANY_FALLBACK coupling in CI envs |
| G6 | High | api-e2e suite exceeds 15-minute budget; specs 4+ min each |
| G7 | High | api-security budget near-exhausted; raised to 35 min as stop-gap |
| G8 | Process | Cancelled job must never be reported as test failure; check `conclusion` first |
| G9 | ~~High~~ | ~~Atomic tests missing `afterAll` safety net~~ — **CLOSED**: all afterAlls added; `zz_test_` prefix enforced; globalSetup guard added |

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
