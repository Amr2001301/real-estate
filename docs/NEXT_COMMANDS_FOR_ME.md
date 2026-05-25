# Next Commands For Me

> **Date:** 2026-05-25 · Exact, small, safe prompts to send Claude Code next.
> Send **one at a time**, top to bottom. Each is scoped to a single task or small group and respects `CLAUDE_EXECUTION_PROTOCOL.md`. Do **not** paste them all at once.
> **Do not run these now — this was a planning step only.**

---

## Recommended first prompt (start here)
```
Execute REP-001 only: add the API Jest suite (pnpm -r test) to .github/workflows/ci.yml so the 54 specs run on push and PR. Restate the change first, don't touch anything else, then run lint/typecheck/build and report results.
```

## Then, in order — Phase 0 (stabilize)
```
Execute REP-002 only: add a CI job that boots Postgres + Redis, runs db:migrate and db:seed, starts the apps, and runs the Playwright smoke suites. Keep it isolated from the build job. Report the workflow diff and explain how to run it.
```
```
Execute REP-003 only: replace the hardcoded Admin dashboard home KPIs/alerts/lead-source data with real /reports/* data, removing the TODO(phase-5) demo arrays. Do not change any other dashboard behavior. Show before/after and run typecheck/build.
```
```
Execute REP-004 only: guard prisma:seed so it refuses to run when NODE_ENV=production unless an explicit override flag is set. This touches data tooling — restate the approach and wait for my approval before editing.
```
```
Execute REP-006 only: write docs/ROLE_PERMISSION_MATRIX.md documenting the 7 roles and permission codes, cross-checked against the *-permissions.spec.ts tests. Docs only.
```

## Phase 1 (backend foundation) — review-heavy, go carefully
```
Do a backend schema and RBAC review only (no code changes): confirm installment-plan Sales-only visibility end-to-end (REP-108), list every endpoint missing ownership scoping for REP-104, and report findings with file paths.
```
```
Execute REP-101: wire notification delivery (FCM push + email). This adds outbound integrations — restate the plan, list required env/secrets, and wait for my approval before editing. Add unit tests with mocked FCM/SMTP.
```
```
Execute REP-104: add a centralized ownership guard/decorator and apply it to me/* and scoped endpoints, with tests. This changes authorization behavior — restate and wait for approval first.
```

## Phase 4 (mobile foundation) — unlocks the apps
```
Prepare the mobile API foundation: execute REP-401 only — export openapi.json from Swagger and set up Dio client codegen. Don't scaffold the apps yet. Show the generated client compiling against the API.
```
```
Execute REP-403: scaffold apps/mobile-client and apps/mobile-sales (Flutter, Riverpod, GoRouter, Dio, RTL theming, shared API client). App shells only, authenticating against the live API.
```

## When ready to build apps / surfaces
```
Start the Sales Mobile App foundation: execute REP-501 only (auth + dashboard + clients list/details + CRM pipeline) against the live API. Widget/integration smoke tests included.
```
```
Build the customer/client web portal: execute REP-303 then REP-304. Treat session security and ownership scoping as critical — restate the auth change and wait for approval before editing.
```

## Useful "safe checkpoint" prompts you can send anytime
```
Fix P0 risks only: from EXECUTION_BACKLOG.md, do the P0 items (REP-001, REP-002, REP-101) in order, one at a time, pausing for my approval on anything flagged Approval: Yes.
```
```
Show me current status: run lint, typecheck, build, and all available tests across the monorepo and report what passes/fails with output. No code changes.
```
```
Re-audit one module: deep-dive <module name> only and tell me what's real vs stubbed, with file paths. No changes.
```

---

### Reminder
- I (the user) approve auth/RBAC/DB-destructive/business-rule/file-deletion changes before they happen.
- Read `PROJECT_CURRENT_STATE.md` first, then `GAP_ANALYSIS.md`, then `IMPLEMENTATION_ROADMAP.md`.
