# Claude Execution Protocol

> **Date:** 2026-05-25 · How Claude Code must execute this roadmap. These rules are binding for every future task in this repository. The standard is **enterprise quality**: secure, scalable, maintainable, honest.

---

## 1. Pace and scope
- **Never execute the full roadmap (or a whole phase) in one uncontrolled run.** Work one task — or one tightly-related small group — at a time.
- Pull tasks from `EXECUTION_BACKLOG.md` in the documented order: stabilize → backend/data → APIs → admin/public → Sales app → Client/Customer app → QA/security/deploy/handover.
- If a task turns out larger than expected, **stop and split it**; don't silently expand scope.

## 2. Before each task
- **Restate** what will change: the task ID, the goal, the files you expect to touch, and the user-visible/behavioral effect.
- Confirm dependencies are satisfied. If a prerequisite task isn't done, say so and propose the correct order.
- If the task's "Approval required" flag is **Yes**, get explicit approval before writing code.

## 3. During each task
- Match the surrounding code's conventions, naming, and patterns. Don't introduce a new framework/lib without calling it out and getting agreement.
- Keep changes minimal and focused on the task. No opportunistic refactors mixed into a feature change.
- **Do not introduce fake/static/demo data** into product code. Seed/demo data is allowed **only** in clearly-marked seed scripts or behind an explicit `demo` flag — never presented as real (this is why `TODO(phase-5)` hardcoded KPIs are a Phase 0 fix, not a pattern to copy).

## 4. After each task
- **Report the changed files** (path list) and a short summary of what each change does.
- **Run available checks:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, and the relevant `pnpm test` / Playwright suite. Report results honestly — if something fails or was skipped, say so with the output. Never claim done/verified without evidence.
- State explicitly whether existing Admin Dashboard and Public Website behavior is unaffected.

## 5. Hard guardrails — do NOT do these without asking
- **Do not break** the existing Admin Dashboard or Public Website. If a change risks them, flag it first.
- **Do not change business rules** without asking. The non-negotiable rules are: no online payment; Admin manually records deposits; Admin uploads contract PDFs; installment plans are Admin-created and Sales-only visible; Google Maps lives in project details; customers get post-purchase maintenance; Sales has commission/bonus; the dashboard has a financial module.
- **Ask before any destructive database change** (drops, column removal, data migration, soft-delete semantics, seed against non-dev). Propose the migration + rollback first.
- **Ask before deleting files.** Look at the target first; if it contradicts how it was described or you didn't create it, surface that instead of deleting.
- **Ask before changing authentication or authorization behavior** (session storage, guards, RBAC, ownership scoping, token handling). These changes require approval and tests.
- **Never persist secrets/tokens to files.** Keep them in env/secret stores only.

## 6. Quality bar
- New endpoints must inherit RBAC + ownership scoping and have permission tests.
- New forms must validate (prefer shared Zod schemas) and render field-level errors.
- New mutations must be covered by the audit interceptor.
- New list endpoints must be bounded (default + max page size).
- New UI must include loading, empty, error, and permission-denied states.

## 7. Version control discipline (if git is available)
- Use small, task-scoped commits at task boundaries with clear messages referencing the task ID (e.g., `REP-101: wire FCM + email notification delivery`).
- Work on a branch off `main`; do not commit/push unless the user asks. If on `main`, branch first.
- Don't bundle unrelated changes into one commit.

## 8. Honesty and reporting
- Report outcomes faithfully: failing tests get shown with output; skipped steps get stated; "done" is said only when proven.
- If the code contradicts a document or the README, trust the code and flag the doc for update.
- Surface newly-discovered risks immediately and add them to `EXECUTION_BACKLOG.md` rather than working around them silently.

## 9. Definition of Done (per task)
A task is done when: code matches conventions; acceptance criteria met; lint + typecheck + build + relevant tests pass (with output shown); no fake data introduced; existing surfaces unbroken; changed files reported; and any required approval was obtained.
