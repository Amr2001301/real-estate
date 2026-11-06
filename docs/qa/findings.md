# QA findings log

One row per finding. Severity: Blocker (cannot work / data loss / money wrong /
leak), Critical (core flow broken), High (feature broken, workaround exists),
Medium (wrong but harmless), Low (polish). Status: open, fixed (PR), accepted
(reason), wontfix (reason). Plan: `docs/QA_PLAN.md`.

Run 1 — commit 4b81e561 (+ docs/seed-platform) — started 2026-11-06 from an empty database (platform super admin only).

| Id | Run | Role | Surface | Phase / step | Steps to reproduce | Expected | Actual | Severity | Status | PR |
|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | 1 | Guest | Public site | 0 smoke | Open the website while the database has no company (or an unknown host) | A clear "this site is not available" page | The home shows the generic «404 — لم نتمكن من العثور على هذه الصفحة» page with the platform's brand, navigation and a "browse projects" button | Low | open | |
| F-002 | 1 | Super admin | Onboarding | 0 smoke | After a wipe, create the first company in the UI | The company is usable right away | `DEFAULT_COMPANY_ID` (env) still names the deleted company; public endpoints depend on it, so the first company needs an env change and restart (check in phase 1 whether it affects the site/app) | Medium | open (verify) | |
