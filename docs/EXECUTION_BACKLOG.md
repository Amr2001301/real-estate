# Execution Backlog

> **Date:** 2026-05-25 · Actionable, ordered task list for phased execution.
> **Order:** stabilize → backend/data → APIs → admin/public production → Sales app → Client/Customer app → QA/security/deploy/handover.
> **Priority:** P0 (blocker) · P1 (must-have) · P2 (should-have) · P3 (nice-to-have).
> **Approval column:** "Yes" = restate + get explicit approval before executing (per `CLAUDE_EXECUTION_PROTOCOL.md`), because it touches auth, RBAC, DB destructive ops, business rules, money, or deletes.
> "Files likely affected" are starting points, not exhaustive.

---

## Phase 0 — Audit, Stabilization, Safety

### REP-001 — Gate API tests in CI
- **Module:** CI/Infra · **Priority:** P0 · **Phase:** 0
- **Description:** Add `pnpm -r test` to `.github/workflows/ci.yml` so the 54 API specs run on push/PR.
- **Files:** `.github/workflows/ci.yml`
- **Dependencies:** none
- **Acceptance:** CI fails when any API spec fails; passes on current main.
- **Test requirements:** the suite itself is the test; verify a deliberately broken test fails CI locally via `act` or a throwaway branch.
- **Risk:** Low · **Approval:** No

### REP-002 — Add E2E smoke job (seeded services) to CI
- **Module:** CI/Infra · **Priority:** P0 · **Phase:** 0
- **Description:** CI job that boots Postgres + Redis, runs `db:migrate` + `db:seed`, starts API + web apps, runs Playwright smoke.
- **Files:** `.github/workflows/ci.yml`, `apps/web-admin/playwright.config.ts`, `apps/web-public/playwright.config.ts`
- **Dependencies:** REP-001
- **Acceptance:** smoke suites run green in CI; failures block merge.
- **Test requirements:** existing Playwright smoke specs pass in CI.
- **Risk:** Medium (orchestration/flakiness) · **Approval:** No

### REP-003 — Replace hardcoded Admin home KPIs with real data
- **Module:** web-admin / reports · **Priority:** P1 · **Phase:** 0
- **Description:** Wire dashboard home trend/alerts/lead-source to `/reports/*`; remove `TODO(phase-5)` demo arrays, or gate them behind an explicit `demo` flag.
- **Files:** `apps/web-admin/src/app/dashboard/page.tsx`, `apps/web-admin/src/app/dashboard/_components/*`
- **Dependencies:** none (reports endpoints exist)
- **Acceptance:** no fabricated financial numbers render; values reconcile with API.
- **Test requirements:** unit/E2E asserting KPI values come from API; visual check.
- **Risk:** Medium (may expose report bugs) · **Approval:** No

### REP-004 — Guard seed against production
- **Module:** api / prisma · **Priority:** P1 · **Phase:** 0
- **Description:** Make `prisma:seed` refuse to run when `NODE_ENV=production` unless an explicit override flag is set.
- **Files:** `apps/api/prisma/seed.ts`, `package.json` scripts
- **Dependencies:** none
- **Acceptance:** seed aborts in prod-like env without override; works in dev.
- **Test requirements:** unit test for the guard.
- **Risk:** Low · **Approval:** Yes (touches data tooling)

### REP-005 — Make CI fail on schema drift
- **Module:** CI/Infra · **Priority:** P2 · **Phase:** 0
- **Description:** Remove `continue-on-error` on `prisma migrate status` once main is drift-free.
- **Files:** `.github/workflows/ci.yml`
- **Dependencies:** REP-001
- **Acceptance:** drift fails CI.
- **Test requirements:** verify on a branch with intentional drift.
- **Risk:** Low · **Approval:** No

### REP-006 — Document role/permission matrix
- **Module:** docs · **Priority:** P2 · **Phase:** 0
- **Description:** Write the 7-role + permission-code matrix (who can do what per module).
- **Files:** `docs/ROLE_PERMISSION_MATRIX.md`
- **Dependencies:** none
- **Acceptance:** matrix reviewed; matches guard usage in code.
- **Test requirements:** N/A (doc) — cross-check against `*-permissions.spec.ts`.
- **Risk:** Low · **Approval:** No

---

## Phase 1 — Backend & Data Model Completion

### REP-101 — Wire notification delivery (push + email)
- **Module:** api / notifications · **Priority:** P0 · **Phase:** 1
- **Description:** Implement FCM push (`firebase-admin`) + email (nodemailer) senders; render `NotificationTemplate` placeholders.
- **Files:** `apps/api/src/modules/notifications/*`, new `firebase`/`email` providers, `env.validation.ts`
- **Dependencies:** Firebase + SMTP credentials
- **Acceptance:** sending a notification delivers in-app + push + email in tests/staging.
- **Test requirements:** unit tests with mocked FCM/SMTP; staging device test.
- **Risk:** High · **Approval:** Yes (external integrations, new outbound comms)

### REP-102 — Domain-event notification triggers
- **Module:** api · **Priority:** P1 · **Phase:** 1
- **Description:** Emit notifications on reservation/contract/deposit/maintenance/visit status changes.
- **Files:** respective module services, notifications service
- **Dependencies:** REP-101
- **Acceptance:** each event produces the correct templated notification.
- **Test requirements:** unit tests per trigger.
- **Risk:** Medium · **Approval:** No

### REP-103 — BullMQ processors for async sends/jobs
- **Module:** api · **Priority:** P2 · **Phase:** 1
- **Description:** Add queue processors for email/SMS/push and heavy exports/PDF.
- **Files:** new `apps/api/src/modules/*/queue/*`, app.module
- **Dependencies:** REP-101
- **Acceptance:** sends run via queue with retry/backoff.
- **Test requirements:** processor unit tests.
- **Risk:** Medium · **Approval:** No

### REP-104 — Centralized ownership guard + tests
- **Module:** api / common · **Priority:** P1 · **Phase:** 1
- **Description:** Add an ownership guard/decorator enforcing customer/broker/sales data scoping; apply to `me/*` and scoped endpoints.
- **Files:** `apps/api/src/common/guards/*`, affected controllers, `__tests__`
- **Dependencies:** none
- **Acceptance:** unauthorized cross-user access returns 403; tests cover customer/broker/sales.
- **Test requirements:** permission/ownership specs.
- **Risk:** High · **Approval:** Yes (authorization behavior change)

### REP-105 — Enforce pagination bounds + decimal caps
- **Module:** api · **Priority:** P2 · **Phase:** 1
- **Description:** Default + max page size on list endpoints; cap commission `Decimal(5,2)` to valid 0–100.
- **Files:** list DTOs/services, schema validation
- **Dependencies:** none
- **Acceptance:** oversized page requests clamped; invalid commission rejected.
- **Test requirements:** validation unit tests.
- **Risk:** Medium · **Approval:** No

### REP-106 — Standardize soft-delete for sensitive entities
- **Module:** api / prisma · **Priority:** P2 · **Phase:** 1
- **Description:** Recoverable deletes for contracts/deposits/users.
- **Files:** `schema.prisma`, migration, services
- **Dependencies:** none
- **Acceptance:** deletes set flags; queries exclude soft-deleted; restore possible.
- **Test requirements:** unit tests.
- **Risk:** Medium · **Approval:** Yes (DB migration + delete semantics)

### REP-107 — Migration/rollback + backup/restore runbooks
- **Module:** docs/ops · **Priority:** P1 · **Phase:** 1
- **Description:** Document forward/rollback migration steps and backup/restore with RTO/RPO.
- **Files:** `docs/OPS_MIGRATIONS.md`, `docs/OPS_BACKUP_DR.md`
- **Dependencies:** none
- **Acceptance:** a rollback + a restore are executed in staging per the docs.
- **Test requirements:** staging drill.
- **Risk:** Medium · **Approval:** Yes (prod-data procedures)

### REP-108 — Verify installment-plan Sales-only visibility
- **Module:** api/web-admin · **Priority:** P1 · **Phase:** 1
- **Description:** Confirm plans are not exposed to customers/guests anywhere; add tests.
- **Files:** installments module, admin UI, `__tests__`
- **Dependencies:** none
- **Acceptance:** customer/guest requests for plans return 403/empty; sales/admin see them.
- **Test requirements:** permission specs.
- **Risk:** Medium · **Approval:** No

---

## Phase 2 — Admin Dashboard Production Readiness

### REP-201 — Shared Zod validation + per-field errors in admin forms
- **Module:** web-admin · **Priority:** P1 · **Phase:** 2
- **Description:** Adopt `@rep/shared-types` Zod schemas in server actions + render field-level errors.
- **Files:** `apps/web-admin/src/app/dashboard/**/_form.tsx`, actions, `packages/shared-types`
- **Dependencies:** none
- **Acceptance:** invalid input shows field errors; server rejects with structured errors.
- **Test requirements:** E2E form-validation flows.
- **Risk:** Medium · **Approval:** No

### REP-202 — Admin token refresh on 401
- **Module:** web-admin · **Priority:** P2 · **Phase:** 2
- **Description:** Refresh access token via refresh cookie on 401; retry once.
- **Files:** `apps/web-admin/src/lib/api.ts`, `middleware.ts`
- **Dependencies:** none
- **Acceptance:** expired access token auto-refreshes without re-login.
- **Test requirements:** integration test simulating 401.
- **Risk:** Medium · **Approval:** Yes (auth/session behavior)

### REP-203 — Finish stub/partial admin modules
- **Module:** web-admin · **Priority:** P1 · **Phase:** 2
- **Description:** Complete permissions UI, notifications + templates UI, documents center, targets edit, operations, inventory server-side pagination.
- **Files:** `apps/web-admin/src/app/dashboard/{permissions,notifications,documents,targets,operations,inventory}/*`
- **Dependencies:** REP-101 (notifications), REP-105 (pagination)
- **Acceptance:** no route is a placeholder; each is real CRUD or intentionally read-only.
- **Test requirements:** E2E per module.
- **Risk:** Medium · **Approval:** No

### REP-204 — Complete CMS (articles, RTE, image upload, public wiring)
- **Module:** web-admin / cms · **Priority:** P2 · **Phase:** 2
- **Description:** Article editing, rich-text, banner image upload via presign, connect to public site.
- **Files:** `apps/web-admin/src/app/dashboard/cms/*`, media uploader
- **Dependencies:** none
- **Acceptance:** content created in admin appears on public site.
- **Test requirements:** E2E publish→render.
- **Risk:** Medium · **Approval:** No

### REP-205 — Report exports (PDF/Excel) + a11y/responsive pass
- **Module:** web-admin / reports · **Priority:** P2 · **Phase:** 2
- **Description:** Add PDF/Excel export; axe pass on key pages; responsive verification.
- **Files:** reports pages, export utils
- **Dependencies:** REP-003
- **Acceptance:** exports download with correct data; axe has no critical violations.
- **Test requirements:** export unit tests + axe checks.
- **Risk:** Low · **Approval:** No

---

## Phase 3 — Public Website Production Readiness

### REP-301 — Project filters (city/price/type) + sort
- **Module:** web-public / api · **Priority:** P1 · **Phase:** 3
- **Description:** End-to-end filters + sort on projects (and sort on units).
- **Files:** `apps/web-public/src/app/projects/*`, `units/*`, API query params
- **Dependencies:** none
- **Acceptance:** filtering/sorting returns correct API-backed results.
- **Test requirements:** E2E filter flows.
- **Risk:** Low · **Approval:** No

### REP-302 — next/image + on-demand revalidation
- **Module:** web-public · **Priority:** P2 · **Phase:** 3
- **Description:** Configure `remotePatterns` for R2; migrate `<img>`→`next/image`; revalidate on admin publish.
- **Files:** `next.config.ts`, image components, revalidation route
- **Dependencies:** none
- **Acceptance:** Lighthouse LCP improves; publishing updates public within seconds.
- **Test requirements:** Lighthouse/manual.
- **Risk:** Medium · **Approval:** No

### REP-303 — Secure web-public session (httpOnly) + refresh
- **Module:** web-public · **Priority:** P1 · **Phase:** 3
- **Description:** Move customer tokens out of localStorage into httpOnly cookies; add route protection + refresh.
- **Files:** auth components, new server actions, `middleware.ts`
- **Dependencies:** none
- **Acceptance:** no tokens in localStorage; protected pages enforce auth.
- **Test requirements:** E2E auth + protected-route tests.
- **Risk:** High · **Approval:** Yes (authentication behavior change)

### REP-304 — Build customer/client web portal
- **Module:** web-public · **Priority:** P1 · **Phase:** 3
- **Description:** Dashboard, Favorites, Visit Requests, My Requests, Profile; Customer: My Property, Contracts (download), Deposits (view), Maintenance (request/track), Notifications — on `me/*` endpoints.
- **Files:** new `apps/web-public/src/app/(portal)/*`, components
- **Dependencies:** REP-303, REP-104 (ownership guard), REP-101 (notifications)
- **Acceptance:** customer sees only their own data across all portal pages.
- **Test requirements:** E2E per page + ownership checks.
- **Risk:** High · **Approval:** Yes (exposes contracts/deposits — RBAC critical)

### REP-305 — Real floor-plan media + explicit Request-Visit form
- **Module:** web-public · **Priority:** P2 · **Phase:** 3
- **Description:** Replace placeholder floor-plan with real media; add dedicated visit-request form posting to `requests`.
- **Files:** unit detail, project detail, requests integration
- **Dependencies:** media exists
- **Acceptance:** real plans render when present; visit form creates a request.
- **Test requirements:** E2E.
- **Risk:** Low · **Approval:** No

---

## Phase 4 — Mobile API Foundation

### REP-401 — Export OpenAPI + generate Dio client
- **Module:** api / mobile · **Priority:** P1 · **Phase:** 4
- **Description:** Emit `openapi.json` from Swagger; add codegen for Dio client.
- **Files:** `apps/api/src/main.ts` (doc export script), codegen config
- **Dependencies:** none
- **Acceptance:** generated client compiles and calls the API.
- **Test requirements:** smoke call via generated client.
- **Risk:** Medium · **Approval:** No

### REP-402 — End-to-end push to a real device
- **Module:** api / mobile · **Priority:** P1 · **Phase:** 4
- **Description:** Verify device-token registration + FCM delivery (APNs/Play) on a real device.
- **Files:** notifications module, mobile scaffold
- **Dependencies:** REP-101
- **Acceptance:** push arrives on device.
- **Test requirements:** manual device test.
- **Risk:** Medium · **Approval:** No

### REP-403 — Scaffold Flutter apps (client + sales)
- **Module:** mobile · **Priority:** P1 · **Phase:** 4
- **Description:** Create `apps/mobile-client` + `apps/mobile-sales` (Riverpod, GoRouter, Dio, RTL theming, shared client).
- **Files:** new app directories
- **Dependencies:** REP-401
- **Acceptance:** both shells run + authenticate against live API.
- **Test requirements:** widget smoke tests.
- **Risk:** Medium · **Approval:** No

### REP-404 — Define API versioning policy
- **Module:** api/docs · **Priority:** P3 · **Phase:** 4
- **Description:** Document versioning/deprecation before mobile GA.
- **Files:** `docs/API_VERSIONING.md`
- **Dependencies:** none
- **Acceptance:** policy reviewed.
- **Test requirements:** N/A · **Risk:** Low · **Approval:** No

---

## Phase 5 — Sales Mobile App

### REP-501 — Sales app: auth + dashboard + clients/CRM pipeline
- **Module:** mobile-sales · **Priority:** P1 · **Phase:** 5
- **Description:** Login, dashboard (leads/visits/bonus/targets), clients list+details (timeline/notes/status), kanban pipeline.
- **Files:** `apps/mobile-sales/*`
- **Dependencies:** REP-403, REP-104
- **Acceptance:** lead moves across pipeline against live API.
- **Test requirements:** widget/integration tests.
- **Risk:** High · **Approval:** No

### REP-502 — Sales app: projects/units + installment calculator + reservations/visits
- **Module:** mobile-sales · **Priority:** P1 · **Phase:** 5
- **Description:** Project/unit browse + share, installment calculator, reservation request, visit schedule/track.
- **Files:** `apps/mobile-sales/*`
- **Dependencies:** REP-501, REP-108
- **Acceptance:** calculator matches backend; reservation/visit created.
- **Test requirements:** calc parity tests + integration.
- **Risk:** High · **Approval:** No

### REP-503 — Sales app: bonus page + notifications + profile
- **Module:** mobile-sales · **Priority:** P1 · **Phase:** 5
- **Description:** Commission/target/paid-pending, push notifications, profile.
- **Files:** `apps/mobile-sales/*`
- **Dependencies:** REP-501, REP-402
- **Acceptance:** bonus data + push verified.
- **Test requirements:** integration.
- **Risk:** Medium · **Approval:** No

---

## Phase 6 — Client / Customer Mobile App

### REP-601 — Client app: onboarding/auth + home + projects/units + favorites
- **Module:** mobile-client · **Priority:** P1 · **Phase:** 6
- **Description:** Splash/onboarding, OTP login/register, home (featured+search), projects/units (+Map), favorites.
- **Files:** `apps/mobile-client/*`
- **Dependencies:** REP-403
- **Acceptance:** client browses + favorites against live API.
- **Test requirements:** widget/integration.
- **Risk:** High · **Approval:** No

### REP-602 — Client app: visits + requests + notifications + profile
- **Module:** mobile-client · **Priority:** P1 · **Phase:** 6
- **Description:** Book/track visits, info requests, notifications, profile.
- **Files:** `apps/mobile-client/*`
- **Dependencies:** REP-601, REP-402
- **Acceptance:** visit booked; push received.
- **Test requirements:** integration.
- **Risk:** Medium · **Approval:** No

### REP-603 — Customer-only: My Property, Deposits, Contracts, Maintenance
- **Module:** mobile-client · **Priority:** P1 · **Phase:** 6
- **Description:** My Property, view deposits, download contracts (PDF), request/track maintenance.
- **Files:** `apps/mobile-client/*`
- **Dependencies:** REP-601, REP-104
- **Acceptance:** customer sees only own property/contracts/deposits; maintenance request created.
- **Test requirements:** integration + access-control checks.
- **Risk:** High · **Approval:** Yes (exposes contracts/deposits/financials on device)

---

## Phase 7 — QA, Security, Deployment, Handover

### REP-701 — Coverage thresholds + CRUD E2E + mobile tests in CI
- **Module:** all/CI · **Priority:** P1 · **Phase:** 7
- **Description:** Add coverage gates, deepen web E2E to CRUD flows, add mobile widget/integration tests; gate all in CI.
- **Files:** CI, test suites across apps
- **Dependencies:** prior phases
- **Acceptance:** CI enforces coverage + flows.
- **Test requirements:** the suites themselves.
- **Risk:** Medium · **Approval:** No

### REP-702 — Security review + dependency/secret scanning + AV on uploads
- **Module:** all · **Priority:** P1 · **Phase:** 7
- **Description:** Auth/RBAC/ownership review, Dependabot/Snyk, secret scanning, antivirus on uploads, pen-test checklist.
- **Files:** CI, upload pipeline, security docs
- **Dependencies:** REP-104
- **Acceptance:** security checklist passed; scanners active.
- **Test requirements:** scanner runs; review sign-off.
- **Risk:** High · **Approval:** Yes (security posture changes)

### REP-703 — CD pipelines + rollback + web-public deploy config
- **Module:** CI/Infra · **Priority:** P1 · **Phase:** 7
- **Description:** Automate Railway/Vercel/app-store deploys with rollback; add web-public deploy config.
- **Files:** `.github/workflows/*`, deploy configs
- **Dependencies:** REP-701
- **Acceptance:** all four surfaces deploy via pipeline; rollback tested.
- **Test requirements:** staging deploy + rollback.
- **Risk:** High · **Approval:** Yes (production deployment)

### REP-704 — APM/metrics + alerting
- **Module:** Infra/observability · **Priority:** P2 · **Phase:** 7
- **Description:** Add metrics/tracing + alerts on error rate/latency/health.
- **Files:** api observability, dashboards
- **Dependencies:** none
- **Acceptance:** alerts fire on induced failure.
- **Test requirements:** induced-failure test.
- **Risk:** Medium · **Approval:** No

### REP-705 — Backup/DR drill + handover pack
- **Module:** docs/ops · **Priority:** P1 · **Phase:** 7
- **Description:** Execute restore drill; finalize deployment runbook, secrets inventory+owners, role matrix, known-issues, support/SLA.
- **Files:** `docs/*`
- **Dependencies:** REP-107
- **Acceptance:** restore demonstrated; company can operate from docs alone.
- **Test requirements:** drill report.
- **Risk:** Medium · **Approval:** Yes (prod-data drill)
