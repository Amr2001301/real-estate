# QA findings log

One row per finding. Severity: Blocker (cannot work / data loss / money wrong /
leak), Critical (core flow broken), High (feature broken, workaround exists),
Medium (wrong but harmless), Low (polish). Status: open, fixed (PR), accepted
(reason), wontfix (reason). Plan: `docs/QA_PLAN.md`.

Run 1 — commit 4b81e561 (+ docs/seed-platform) — started 2026-11-06 from an empty database (platform super admin only).

| Id | Run | Role | Surface | Phase / step | Steps to reproduce | Expected | Actual | Severity | Status | PR |
|---|---|---|---|---|---|---|---|---|---|---|
| F-001 | 1 | Guest | Public site | 0 smoke | Open the website while the database has no company (or an unknown host) | A clear "this site is not available" page | The home shows the generic «404 — لم نتمكن من العثور على هذه الصفحة» page with the platform's brand, navigation and a "browse projects" button | Low | open | |
| F-002 | 1 | Super admin | Onboarding | 1 company | After a wipe, create the first company in the UI | The company is usable right away | Checked: not a problem. The site and apps find the company by host / slug (a platform sub-domain `<slug>.<base-domain>` is created with the company); `DEFAULT_COMPANY_ID` is only a legacy fallback | — | not a defect | |
| F-003 | 1 | Guest | Public site (local dev) | 1 company | Open `http://default.localhost:3002` in `next dev` | The company's site, found by its host | The proxy read `req.nextUrl.hostname`, which is always `localhost` in `next dev`, so a company host never resolved locally (the home 404'd) and per-company sites could not be tried on one machine | Medium | fixed (proxy reads the Host header) | |
| F-004 | 1 | Super admin | Company page → domain | 1 company | Add the domain `elite.localhost` | Added, or a clear reason | Refused with the English text «Custom domains under localhost are reserved for platform use» in an Arabic screen | Low | open | |
| F-005 | 1 | Guest | Public site | 1 company | Open the site of a company with no logo yet | The company's name/initials, never the platform's mark | The header shows the company name next to the platform (Devora) logo | Medium | open (check phase 4: identity) | |
| F-006 | 1 | Super admin | New company form | 1 company | Submit the form with the country left on «اختر الدولة» | A message in the page's language | The browser's English native message «Please select an item in the list.» | Low | open | |
