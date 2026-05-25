# Implementation Roadmap

> **Date:** 2026-05-25 · Phased, enterprise-grade plan to take the platform from strong MVP to full four-surface delivery.
> **Sequencing principle:** stabilize what exists → complete backend/data + APIs → harden the two web surfaces → build the mobile foundation → build the two apps → QA/security/deploy/handover.
> **Complexity scale:** S (≤2 days) · M (3–5 days) · L (1–2 weeks) · XL (3+ weeks). These are effort indicators, not commitments.
> Execute per `CLAUDE_EXECUTION_PROTOCOL.md` — one task/group at a time, never the whole roadmap in one run.

---

## Phase 0 — Audit, Stabilization, and Safety
**Goal:** Lock in a trustworthy baseline: tests gated in CI, no misleading data, safe migrations/seed, known-issues centralized. Change behavior as little as possible.

**Tasks:**
- Gate existing tests in CI: run API Jest (`pnpm -r test`) and (where feasible) Playwright smoke in `.github/workflows/ci.yml`.
- Add a CI job that boots Postgres + seeds + runs E2E smoke for web-admin/web-public.
- Replace hardcoded Admin home KPIs/alerts with real `/reports/*` data, or clearly label as demo behind a flag (remove `TODO(phase-5)` debt).
- Guard `prisma:seed` from running against production (env check).
- Make `migrate status` in CI fail on drift (remove `continue-on-error` once green).
- Centralize the known-issues/TODO register (link scattered TODOs into `EXECUTION_BACKLOG.md`).
- Document the role/permission matrix (7 roles, permission codes).

**Deliverables:** green CI that lints + typechecks + builds + tests; real (or flagged) admin KPIs; seed guard; role matrix doc; consolidated issue register.

**Acceptance Criteria:** CI fails on a broken test or schema drift; admin home shows no fabricated financial figures; running seed against a prod-like env is blocked; role matrix reviewed.

**Risks:** E2E in CI needs seeded services (flaky if mis-orchestrated); wiring real KPIs may surface report bugs.

**Dependencies:** none (foundational).

**Estimated Complexity:** M–L.

---

## Phase 1 — Backend and Data Model Completion
**Goal:** Make the backend a complete, secure, mobile-ready contract: notification delivery, centralized ownership, bounded queries, migration/backup runbooks.

**Tasks:**
- Implement **notification delivery**: FCM push (wire `firebase-admin`), email (nodemailer), and event triggers (reservation/contract/deposit/maintenance/visit status changes) using existing `NotificationTemplate`/`Notification` models.
- Add **BullMQ processors** for async sends (email/SMS/push) and heavy jobs (exports, PDF).
- Add a **centralized ownership guard/decorator** + tests for customer/broker/sales data scoping.
- Enforce **pagination defaults + max page size**; cap commission `Decimal` to valid range.
- Standardize **soft-delete** where deletes must be recoverable (contracts, deposits, users).
- Write **migration + rollback runbook** and a **backup/restore procedure** (RTO/RPO targets).
- Confirm installment-plan **Sales-only visibility** end-to-end.

**Deliverables:** working push + email with templates; queue processors; ownership guard + tests; bounded queries; ops runbooks.

**Acceptance Criteria:** a domain event produces an in-app + push + email notification in a test; new endpoints inherit ownership enforcement; list endpoints bounded; documented rollback executed in staging.

**Risks:** Firebase/SMTP credentials + deliverability; notification fan-out volume; soft-delete migration care.

**Dependencies:** Phase 0 (CI gate to protect changes); Firebase + SMTP secrets.

**Estimated Complexity:** L–XL.

---

## Phase 2 — Admin Dashboard Production Readiness
**Goal:** Bring Admin to enterprise quality: real data everywhere, robust validation, finished modules, exports.

**Tasks:**
- Adopt **shared Zod schemas** for admin forms + per-field error rendering.
- Add **token refresh** on 401.
- Finish stub/partial modules: permissions UI, notifications + templates UI, documents center, targets edit, operations, inventory server-side pagination.
- Complete **CMS** (articles editing, rich text, image upload, connect banners/pages to public).
- Add **report exports** (PDF/Excel) and ensure financial figures are 100% real.
- Verify **phases/buildings** UI depth; polish maintenance/bonus UI states.
- Accessibility pass on admin (landmarks, alt, contrast); responsive verification.

**Deliverables:** validated forms; complete module set; real financial dashboard; exports; a11y improvements.

**Acceptance Criteria:** every admin route is real CRUD or intentionally read-only (no stubs); forms show field-level errors; financial page reconciles with API; exports download; axe passes key pages.

**Risks:** CMS/RTE scope creep; export formatting; refactors must not break existing flows.

**Dependencies:** Phase 1 (reports/notifications real); Phase 0 (CI safety net).

**Estimated Complexity:** L.

---

## Phase 3 — Public Website Production Readiness
**Goal:** Complete guest experience + **build the customer/client web portal**, with secure sessions and performance.

**Tasks:**
- Add **project filters** (city/price/type) + **sort** on projects/units end-to-end.
- Switch to **next/image** with R2 `remotePatterns`; add on-demand revalidation when admin publishes.
- Move web-public auth to **secure session** (httpOnly cookie/route protection); add token refresh.
- Build **customer/client portal**: Dashboard, Favorites, Visit Requests, My Requests, Profile; **Customer:** My Property, Contracts (download PDF), Deposits (view/receipts), Maintenance (request/track), Notifications — all on existing `me/*` endpoints.
- Real **floor-plan media**; explicit Request-Visit form; confirm WhatsApp/Call CTAs.
- Public a11y (axe/pa11y) + responsive verification.

**Deliverables:** filterable/sortable browsing; optimized images; secure auth; full customer portal; a11y/perf gains.

**Acceptance Criteria:** customer can log in and view their property, contracts, deposits, maintenance, notifications; filters/sort work; Lighthouse perf/SEO/a11y meet agreed thresholds; tokens not in localStorage.

**Risks:** auth migration regressions; portal RBAC correctness (depends on Phase 1 ownership guard).

**Dependencies:** Phase 1 (ownership guard, notifications), Phase 0.

**Estimated Complexity:** L–XL.

---

## Phase 4 — Mobile API Foundation
**Goal:** Provide a stable, generated contract and platform services both Flutter apps consume.

**Tasks:**
- Export **OpenAPI spec** from NestJS Swagger; add a codegen pipeline for the **Dio** client (per README).
- Confirm/standardize **mobile auth** (OTP for clients, email/password for sales) + refresh on device secure storage.
- Finalize **push registration** (device tokens) and end-to-end push delivery to a test device.
- Define mobile-shaped endpoints/pagination/filtering; document an **API versioning** policy before GA.
- Stand up Flutter monorepo apps scaffolding (`apps/mobile-client`, `apps/mobile-sales`) with Riverpod/GoRouter/Dio, shared API client, theming/RTL.

**Deliverables:** `openapi.json` + generated Dio client; verified push on a device; mobile auth flow; app scaffolds.

**Acceptance Criteria:** generated client compiles and calls the API; a push notification arrives on a real device; both app shells run and authenticate.

**Risks:** OpenAPI fidelity (translatable JSON, enums); FCM platform setup (APNs/Play); contract churn.

**Dependencies:** Phase 1 (notifications), Phase 0.

**Estimated Complexity:** L.

---

## Phase 5 — Sales Mobile App
**Goal:** Ship the Sales Flutter app per scope.

**Tasks:**
- Login; Dashboard (leads/visits/bonus/targets); Clients list + details (timeline/notes/status); **CRM pipeline** (kanban New→Interested→Visit→Negotiation→Won/Lost); Projects + details (+Map); Units + details (share); **Installment calculator**; Reservations (request); Visits (schedule/track); **Bonus page** (commission/target/paid-pending); Notifications; Profile.
- Wire to backend CRM/reservation/installment/bonus endpoints; offline-friendly basics; analytics/crash reporting.

**Deliverables:** installable Sales app (Android/iOS) covering all scope pages.

**Acceptance Criteria:** a sales rep can manage a lead through the pipeline, calculate installments, request a reservation, schedule a visit, and view bonuses — against the live API; push works.

**Risks:** CRM UX complexity; installment math parity with backend; store provisioning.

**Dependencies:** Phase 4 (API foundation, push, scaffolds); Phase 1.

**Estimated Complexity:** XL.

---

## Phase 6 — Client / Customer Mobile App
**Goal:** Ship the Client/Customer Flutter app per scope.

**Tasks:**
- Splash/onboarding; Login/Register (OTP); Home (featured + search); Projects + details (+Map, request visit); Units + details (save/contact); Favorites; Visits (book/track); Requests; Notifications; Profile.
- **Customer-only:** My Property, Deposits (view), Contracts (download PDF), Maintenance (request/track).
- Reuse generated client + push; secure token storage; deep links from web `/app`.

**Deliverables:** installable Client/Customer app covering all scope pages incl. post-purchase ownership.

**Acceptance Criteria:** a client can browse, favorite, request a visit; a customer can view their property/contracts/deposits and file maintenance — against the live API; push works.

**Risks:** OTP/store review; contract/deposit access-control correctness; parity with web portal.

**Dependencies:** Phase 4; Phase 1; ideally Phase 3 (shared portal logic/learnings).

**Estimated Complexity:** XL.

---

## Phase 7 — QA, Security, Deployment, and Handover
**Goal:** Production-grade quality, security, operability, and a clean handover to the company.

**Tasks:**
- Expand tests: API coverage thresholds, web CRUD E2E flows, mobile widget/integration tests; all gated in CI.
- Security review: auth/session, ownership/RBAC, file uploads (add AV scan), contract/deposit access, dependency + secret scanning (Dependabot/Snyk), pen-test checklist.
- Add **APM/metrics + alerting**; finalize **CD pipelines** (Railway/Vercel/app stores) with rollback; web-public deploy config.
- Backup/DR drill (restore test, RTO/RPO sign-off).
- Complete handover docs: deployment runbook, secrets inventory + owners, role/permission matrix, known-issues register, support/SLA notes.

**Deliverables:** CI-gated test suite + coverage; security sign-off; automated deploys + rollback; DR drill report; full handover pack.

**Acceptance Criteria:** all four surfaces deployed via pipeline; security checklist passed; DR restore demonstrated; company can operate/extend from docs alone.

**Risks:** late-found security issues; store release timelines; coordinating four-surface release.

**Dependencies:** all prior phases.

**Estimated Complexity:** L–XL.

---

## Critical path summary
Phase 0 (safety) → Phase 1 (notifications + ownership + ops) → Phase 4 (mobile foundation) unlocks Phases 5–6 (apps). Phases 2 (admin) and 3 (public + customer portal) can run in parallel with Phase 1/4 once Phase 0 is green. Phase 7 closes out delivery.
