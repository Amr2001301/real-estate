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
| G10 | Medium | Node version drift CI vs local — **MITIGATED** 2026-10-01: `.nvmrc` + `node-version-file` pin + drift-guard step |
| G11 | Process | Dependency overrides applied without confirmed CI failure — see incident record; TypeError subsequently confirmed in run `36907374243` with correct root-cause and fix |
| G12 | ~~High~~ | ~~e2e spec files silently omitted from CI~~ — **CLOSED** 2026-10-02: `e2e-data-import` + `e2e-schema-constraints` added to e2e-1; orphan guard added to build job |
| G13 | Low (accepted) | `E2E_TENANT_BYPASS_SLUG` has no deploy-time enforcement — see below |
| G15 | Critical | A failed path filter skipped every job and the gate reported green — **FIX PUSHED** 2026-10-06, verified by the PR run — see below |
| G14 | Medium (dated) | `ubuntu-latest` → 26.04 from 2026-10-19; Node 20 action runtimes — **MITIGATED** 2026-10-06: runners pinned to 24.04, actions on Node 24 majors; the 26.04 move itself still open — see below |

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

---

## G10 — Node version drift between CI and local

**Discovered 2026-09-30** during the MT-rollout / data-import sprint.

CI used `node-version: 22` in `setup-node@v4`, which resolves to the latest
available 22.x patch at run time. On 2026-09-30 that resolved to **22.23.2**.
Local development ran **22.12.0**. Neither side knew the other had drifted.

**Fix applied 2026-10-01 (structural pin only):**

Node version pinned structurally — no dependency overrides:
- `.nvmrc` added at repo root: `22.23.2`
- `ci.yml` all `node-version: 22` replaced with `node-version-file: .nvmrc`
- `package.json` `engines.node` changed from `>=22.0.0` to `22.23.2`
- Drift-guard step added in the `build` job: fails if `node --version` does
  not equal the `.nvmrc` value, so any future drift announces itself immediately.

**Local action required:** `nvm use` at the repo root will now auto-select
22.23.2. Developers on 22.12.0 will see the `.nvmrc` and know to upgrade.

---

## G11 — Dependency changes made without a confirmed CI failure (incident record)

**Date:** 2026-09-30 / 2026-10-01 / resolved 2026-10-02

Three `pnpm.overrides` were applied to fix DI security test failures (DI-3,
DI-3b, DI-5, DI-6) that were described as a `TypeError: Right-hand side of
'instanceof' is not callable` in `readable-stream@3.6.2` under Node 22.23.2.

**What was claimed at the time:** Run `36761406261` showed the DI tests failing
with that TypeError; the fix was needed.

**What the run logs actually showed (first audit, 2026-10-01):**

| Run | Commit | Security job outcome | DI test result |
|---|---|---|---|
| `36752365206` | `e476c2e` | **skipped** (path filter) | never ran |
| `36752925728` | `35f6059` | **skipped** (path filter) | never ran |
| `36754196032` | `17e8d18` | **skipped** (path filter) | never ran |
| `36754698350` | `e60abf8` | **failed at MinIO startup** | never ran |
| `36761406261` | `2875b75` | **cancelled** (no test output) | never ran |
| `36765795868` | `acbc792` | **skipped** (path filter) | never ran |
| `36769596349` | `ee9853a` | failed — DI-3/DI-3b got 400 | **caused by multer 2.4.0 override itself** |

No CI run with `multer@2.0.2` had run the DI security tests at that point.
The diagnosis was inferred from the dependency chain, not from a run ID or log
excerpt — hence the premature overrides.

**Subsequent confirmation (run `36907374243`, 2026-10-01):**

After reverting all overrides and pinning Node to 22.23.2 via `.nvmrc`, the
security suite ran cleanly for the first time. DI-3, DI-3b, DI-5, DI-6 failed
with the TypeError. The confirmed stack trace:

```
TypeError: Right-hand side of 'instanceof' is not callable
  at ConcatStream.Writable (_stream_writable.js:244:23)     ← lazy require fires here
  at new ConcatStream (concat-stream@2.0.0/index.js:32:12)
  at MemoryStorage._handleFile (multer@2.0.2/storage/memory.js:6:20)
```

**Root cause (confirmed mechanism):**

The NestJS app is compiled inside the **first** security spec file's Jest
vm-context via `createSecurityTestApp()`. All of multer → concat-stream →
`readable-stream@3.6.2` load with that vm-context's `require` function captured
in their closures. `_stream_writable.js` has a lazy
`Duplex = Duplex || require('./_stream_duplex')` at line 244 that fires on the
first `new ConcatStream()` call. DI-1/DI-2 pass because auth guards reject before
multer processes the file. DI-3 is the first actual file upload in the suite — by
then, the first spec file's vm-context has been torn down. `require('./_stream_duplex')`
fires from that torn-down context → returns `undefined` → `this instanceof undefined`
→ TypeError. This does not reproduce locally when running spec 20 in isolation
because the vm-context is not torn down before the test runs.

**Fix (commit after run `36907374243`):**

Replaced multer's default `MemoryStorage` (which depends on `concat-stream` →
`readable-stream@3`) with `NativeMemoryStorage` — a custom storage engine that
collects file data using only Node.js built-in stream events (`data`, `end`,
`error`, `limit`) and `Buffer.concat()`. No npm readable-stream, no lazy requires,
no vm-context dependency. Tested with 7 unit tests covering: normal file, zero
bytes, stream error, limit-before-end, no double-callback, concurrent uploads.
No dependency changes required. Files: `src/common/utils/multer-native-memory.ts`,
`src/modules/data-import/data-import.controller.ts`.

**What the three overrides that preceded the fix actually did:**

1. `pnpm.overrides.multer = "2.4.0"` (commit `ee9853a`): DI-3/DI-3b/DI-5/DI-6
   began failing with HTTP 400 "No file uploaded". multer 2.4.0's new
   `req.on('close', ...)` handler aborted requests early under Node 22.23.2.

2. `pnpm.overrides.readable-stream = "4.7.0"` (commit `0705f61`): crashed the
   API on startup. `exceljs → archiver → lazystream` requires
   `readable-stream/passthrough` which v4 dropped as a subpath export. Reverted.

3. Local repro on Node 22.23.2 with `multer@2.0.2`: tests passed in isolation
   (spec 20 alone) but failed in the full suite — the vm-context teardown only
   happens when other spec files have run and been torn down first.

**Rule this incident produces:**

> A failure gets a run ID and a raw log excerpt before it gets a fix.
> "The dependency chain suggests it could fail" is not evidence.
> Verify locally on the same Node version before touching any dependency.
> A global `pnpm.overrides` touches every package in the tree — check the
> lockfile for all packages that resolve that dependency first.
> When a test passes in isolation but fails in the full suite, the failure
> is about suite-level state (vm-context lifecycle, shared singletons, etc.),
> not about the test's own logic.

---

## G12 — e2e spec files silently omitted from testPathPattern

**Date:** 2026-10-02 (discovered while chasing DI-E2E-1 through DI-E2E-5)

Two `test/e2e/*.e2e-spec.ts` files existed on disk but were not listed in any
e2e job's `--testPathPattern`, so they had **never run in CI**:

| File | Missing since | Tests never run |
|---|---|---|
| `e2e-data-import.e2e-spec.ts` | File creation | DI-E2E-1 through DI-E2E-5 |
| `e2e-schema-constraints.e2e-spec.ts` | File creation | B4 per-tenant unique constraint tests |

The `testPathPattern` approach uses a hand-maintained list of spec file names.
A new spec file silently never runs unless the author also updates the CI yaml —
there was no gate to catch the omission.

**Fix applied 2026-10-02:**

1. Both files added to e2e-1's `testPathPattern`.
2. Orphan guard step added to the `build` job (always runs, even when e2e jobs
   are skipped by path filter). It greps the workflow file for all
   `--testPathPattern=` values and fails if any `test/e2e/*.e2e-spec.ts` file
   on disk is not covered. Same check for security (testRegex must match all
   `*.security-spec.ts` files).

The security suite is not at risk because `jest-security.json` uses
`testRegex: "test/security/.*\.security-spec\.ts$"` — a glob over the full
directory, not a hand-maintained list.

**Rule:** Any test runner configuration that uses explicit file lists (not glob
patterns) must be paired with a CI check that verifies coverage. The orphan guard
runs before any path filter can skip it.

---

**Security suite timing trend (record here so drift is visible next time):**

| Date | Run | Wall time | Budget | Longest file |
|---|---|---|---|---|
| 2026-09-18 | `35372621639` | ~19 min (cancelled at 20 min) | 20 min | `02-attack-matrix` |
| 2026-09-18 | (after budget raise) | budget raised to 35 min | 35 min | `02-attack-matrix` |
| 2026-09-30 | `36761406261` | **30 min 4 sec** | 35 min | `02-attack-matrix` 464 s |

At the 2026-09-30 run rate the suite has **4 min 56 sec of remaining budget**.
`02-attack-matrix.security-spec.ts` alone ran 464 seconds (7 min 44 sec) — it is
the split candidate when the suite next exceeds budget.

**e2e tests do not run on push events:** `api-e2e-1` and `api-e2e-2` require
`pull_request`, `schedule`, or `workflow_dispatch`. They are always skipped on
direct pushes to `main`. Use `workflow_dispatch` or open a PR to run them against
a specific branch.
| Broken suites can survive 3+ weeks | Caught on the next PR that touches `apps/api/**` |

---

## G13 — `E2E_TENANT_BYPASS_SLUG` has no deploy-time enforcement

**Date recorded:** 2026-10-04

`apps/web-public/src/middleware.ts` reads `process.env.E2E_TENANT_BYPASS_SLUG` at
module load and, when set, skips the backend tenant-resolution API call entirely
for requests arriving on localhost:

```typescript
const E2E_TENANT_BYPASS_SLUG = process.env.E2E_TENANT_BYPASS_SLUG;
// ...
if (E2E_TENANT_BYPASS_SLUG && LOCAL_HOSTS.has(hostname)) {
  return { slug: E2E_TENANT_BYPASS_SLUG, websiteEnabled: true };
}
```

### Exposure

If `E2E_TENANT_BYPASS_SLUG` were ever set in a production environment, a request
arriving with `Host: localhost` — a health check, an internal SSR fetch, a
reverse proxy that does not rewrite the `Host` header — would be served the bypass
tenant without any backend domain check. The `LOCAL_HOSTS` guard (`localhost`,
`127.0.0.1`, `[::1]`) is the real protection; the `E2E_` prefix is a naming
convention, not a runtime control.

### Why this is accepted

- Deployed traffic arrives on real registered domain names. A production edge
  node never sees `Host: localhost`.
- `E2E_TENANT_BYPASS_SLUG` has no reason to exist in a production environment.
  The variable is injected exclusively in CI `env:` blocks (`.github/workflows/ci.yml`).
- The obvious alternative — a `NODE_ENV !== 'production'` guard around the const —
  is the exact mechanism that caused the 14 Playwright failures fixed in commit
  `a36f7c2`. `next build` sets `process.env.NODE_ENV = 'production'` before
  bundling Edge middleware, so that guard bakes as `false` at build time regardless
  of what the CI job's `NODE_ENV:` block says, silently making the bypass inert and
  rendering all tenant-dependent pages as the not-found shell.

### TODO — the real control does not exist yet

When `deploy.yml` is re-armed, add a step that fails the deployment if any
`E2E_*` variable is present in the production environment:

```yaml
- name: Reject E2E variables in production
  run: |
    E2E_VARS=$(env | grep '^E2E_' || true)
    if [ -n "$E2E_VARS" ]; then
      echo "ERROR: E2E_ variables must not be set in production:"
      echo "$E2E_VARS"
      exit 1
    fi
```

Do not describe this gap as mitigated or enforced until that step exists and the
deploy pipeline is active. The `E2E_` prefix is documentation of intent, not a
technical control.

---

## G14 — Runner image and action runtimes drift underneath the pipeline

> Recorded 2026-10-06. Fixed in this session for the dated part; the 26.04
> move itself is deliberately left as its own change.

### What was wrong

Two changes GitHub makes on its own schedule, neither visible in a diff:

1. **`ubuntu-latest` → 26.04.** Every job used `ubuntu-latest`. GitHub migrates
   that label to Ubuntu 26.04 between **2026-10-19 and 2026-11-19**
   ([changelog](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration),
   [runner-images#14226](https://github.com/actions/runner-images/issues/14226)).
   Jobs would have changed OS mid-rollout, some runs on 24.04 and some on 26.04,
   with no commit to point at when one goes red.
2. **Node 20 action runtime.** Every run warned that `actions/checkout@v4`,
   `actions/setup-node@v4`, `pnpm/action-setup@v4` and `dorny/paths-filter@v3`
   target Node 20 and were being forced onto Node 24 (verified in the run 165 job
   logs). The other node-based actions in use — `upload-artifact@v4` and the three
   `docker/*` actions in `deploy.yml` — target Node 20 too (verified from each
   tag's `action.yml`); they only did not warn because those steps did not run.

### What in this repo the 26.04 image would change

Read from the runner-images breaking-changes issue against what the workflows
actually use:

| Change on 26.04 | Where it hits us |
|---|---|
| `postgresql-client` from apt becomes 18 (was 16) | `db-backup.yml` installs it from apt. A `pg_dump` 18 archive is not readable by an older `pg_restore`, and `scripts/db-restore-test.sh` uses whatever `pg_restore` the operator has installed — production runs Postgres 16. |
| Playwright system deps on a new OS | `playwright install --with-deps chromium` in both Playwright jobs |
| Docker 28 → 29, Compose 2 → 5 | `services:` containers in every DB-backed job; the MinIO steps |
| Python: only 3.14 cached | `db-backup.yml` runs `pip install awscli` |
| Java 17 → 25 default | Not used today (the mobile job runs analyze + test, no Android build) |

Node itself is unaffected: every job pins it via `setup-node` + `.nvmrc`.

### Fix

- All 17 jobs across the four workflows pin `runs-on: ubuntu-24.04`.
- Each node-based action moved to the **lowest** major that runs on Node 24, to
  keep the behaviour change to the runtime and nothing else:

| Action | From | To | Breaking notes checked against our usage |
|---|---|---|---|
| `actions/checkout` | v4 | v5 | Runtime only; needs runner ≥ 2.327.1 (hosted runners are) |
| `actions/setup-node` | v4 | v5 | Auto-caches when `packageManager` is set — every call already passes `cache: pnpm`, so no change |
| `pnpm/action-setup` | v4 | v5 | Same inputs; we pass `version` + `run_install` only |
| `actions/upload-artifact` | v4 | v6 | v5 still defaulted to Node 20; v6 is runtime only |
| `dorny/paths-filter` | v3 | v4 | Runtime; our filters are plain `dir/**` globs |
| `docker/setup-buildx-action` | v3 | v4 | Removed deprecated inputs — we pass none |
| `docker/login-action` | v3 | v4 | Runtime only |
| `docker/build-push-action` | v6 | v7 | Removed `DOCKER_BUILD_NO_SUMMARY` / `DOCKER_BUILD_EXPORT_RETENTION_DAYS` — we set neither |

`subosito/flutter-action@v2` is a composite action (it uses `actions/cache@v5`
internally) and needs no change.

### What is verified and what is not

- `ci.yml` is verified by a green run of this change.
- `deploy.yml`, `db-backup.yml` and `mt017-production-identity-audit.yml` are
  manual or scheduled jobs that touch production. They were **not** run to test
  this change. The `db-backup` change is runner and action versions only; its
  first scheduled run after merge is the proof, and it should be checked.

### Still to do — moving to 26.04 on purpose

Pinning buys time; it does not move us. 24.04 stays supported, but the move
should be one deliberate change: switch `ci.yml` to `ubuntu-26.04` on a branch,
run it via `workflow_dispatch`, and fix what breaks. Do `db-backup.yml` last,
and pin the Postgres client major explicitly (PGDG `postgresql-client-16`) rather
than taking whatever apt ships.

---

## G15 — A failed path filter turned the whole run green

> Recorded and fixed 2026-10-06, on the first pull request this repository
> has had (Amr2001301/real-estate#1, run 167).

### What happened

`detect changed areas` failed with `Resource not accessible by integration`.
On `pull_request` events `dorny/paths-filter` lists the PR's files through the
GitHub API; the default token here is read-only on contents and cannot read
pull requests. `push`, `schedule` and `workflow_dispatch` use git instead,
which is why no run before the first PR ever hit it. It is not caused by the
v3 → v4 bump in G14 — every version takes the API path on `pull_request`.

Every filtered job `needs: changes`, so all of them were **skipped**. The
gate checks its `needs` for `failure` or `cancelled`; `changes` was not in
that list and a skip is neither, so **`all checks passed` went green on a run
where no test executed.** That is the serious half: with branch protection
pointed at the gate (G3), this would have let any PR merge untested.

### Fix

- `changes` gets `permissions: { contents: read, pull-requests: read }`.
- `changes` is added to the gate's `needs`, so a failure there is a failure of
  the gate. This holds for any future reason the filter breaks, not just this
  one.

### Verification

The PR run after the fix must show `detect changed areas` green, the
filtered jobs actually running, and the gate green on their results.
