# Manual QA checklists

Per-platform manual QA checklists. The **mobile** checklists already
live in [`mobile-release-guide.md`](mobile-release-guide.md) §6 — this
doc covers the **web admin**, **public website**, and the
**cross-platform** runs. Use these alongside the automated suites
described in [`system-qa-strategy.md`](system-qa-strategy.md).

Each section is a copy-pasteable block for a release ticket.

---

## 1. Admin Dashboard (per role)

Run against staging or production-readiness. ar-only RTL.

### As ADMIN

- [ ] `/login` accepts the admin credentials and lands on `/dashboard`.
- [ ] Side nav shows: Dashboard, Leads, Projects, Units, Customers,
      Inventory, Reports, Brokers, Bonus, Settings.
- [ ] `/dashboard` shows KPI cards with non-error values (or a friendly
      empty state, not a stack trace).
- [ ] `/dashboard/projects` lists the seeded projects.
- [ ] Create-project flow lands without 500.
- [ ] `/dashboard/units` lists units; status filter works.
- [ ] `/dashboard/brokers` lists broker firms; the e2e seed's two firms
      (`E2E-BROKER-1`, `E2E-BROKER-2`) are visible.
- [ ] `/dashboard/reports` opens; CSV exports download.
- [ ] `/dashboard/settings` opens; admin-only toggles editable.

### As SALES

- [ ] Login lands on `/dashboard`.
- [ ] Side nav does NOT show: Reports, Brokers, Bonus, Settings (admin-only).
- [ ] `/dashboard/leads` lists leads; create-lead works; stage update works.
- [ ] `/dashboard/customers` lists clients (derived from leads).
- [ ] Direct nav to `/dashboard/bonus` → bounce or 403 (backend rejects).
- [ ] Direct nav to `/dashboard/settings` → bounce or 403.

### As SALES_MANAGER

- [ ] Login lands on `/dashboard`.
- [ ] Side nav shows the SALES set plus Reports.
- [ ] Team view in `/dashboard/leads` shows the sales rep's leads.
- [ ] Admin-only routes (`/dashboard/settings`, `/dashboard/brokers`) still
      bounce or 403.

### As BROKER

- [ ] Login redirects to `/portal` (not `/dashboard`).
- [ ] `/portal` shows broker-scoped KPIs.
- [ ] `/portal/projects` lists only the broker's granted projects.
- [ ] Direct nav to `/dashboard` bounces (BROKER ≠ ADMIN).

### As MAINTENANCE_SUPERVISOR

- [ ] (No web dashboard — direct nav to `/dashboard` bounces. Maintenance
      supervisor is mobile-only.)

---

## 2. Public Website

Run against staging or production-readiness. Arabic-only RTL.

### Guest browsing

- [ ] `/` renders hero + featured projects.
- [ ] `/projects` lists projects (≥1 after seeding); search + filter work
      or degrade to friendly empty.
- [ ] `/projects/:id` opens with map, amenities, units preview.
- [ ] `/units` lists units; filters (status, rooms, price) work.
- [ ] `/units/:id` opens with full detail; "Add to compare" toggles.
- [ ] `/compare` shows selected units side-by-side; "Schedule a visit"
      CTA opens the visit request form.
- [ ] `/contact` form submits; success state appears.

### Register + login

- [ ] `/register` creates a customer account; lands on `/account` on
      success.
- [ ] `/login` accepts customer credentials.
- [ ] Wrong-password shows a localized error (no stack trace).
- [ ] Login as a STAFF account (e.g. `sales@example.com`) is rejected
      with "Email login is for staff and brokers only" or equivalent —
      `/auth/customer/login` is customer-only by design.

### `/account` (customer only)

- [ ] After login, `/account` lands without 403.
- [ ] `/account/profile` shows the customer's name + phone + email.
- [ ] `/account/favorites` lists favorited units.
- [ ] `/account/requests` lists submitted requests.
- [ ] `/account/visits` lists upcoming + past visits.
- [ ] `/account/contracts` (CUSTOMER only) lists contracts.
- [ ] `/account/deposits` lists deposits.
- [ ] `/account/maintenance` lists requests; `/account/maintenance/new`
      submits with photos.
- [ ] Document downloads open a fresh signed URL (URL query contains
      `X-Amz-Signature` or similar; URL is single-use, ~5 min TTL).
- [ ] Logout clears cookies; revisiting `/account` bounces to `/login`.

### Cross-role negatives (web-public)

- [ ] Logged in as a STAFF user (e.g. ADMIN) → `/account` bounces to `/`
      (server-component `isPortalRole` gate).
- [ ] Logged out → direct nav to any `/account/*` bounces to
      `/login?from=/account/...`.

---

## 3. Cross-platform (Flow A walk-through)

A QA engineer with one browser + one phone (or emulator) runs this
end-to-end. ~10 minutes.

- [ ] Stand up the API pointed at a seeded DB
      (`prisma:seed:e2e` or `prisma:seed` with `SEED_PUBLIC_DEMO=true`).
- [ ] Open the public website `/projects` — first seeded project
      ("نايل كريست ريزيدنس") is visible.
- [ ] Open the admin dashboard `/dashboard/projects` — same project
      visible in the list.
- [ ] Open the Customer App on the same backend → guest landing → "Browse
      projects" → the same project's Arabic name appears.
- [ ] Open the Staff App on the same backend → login as
      `broker1@example.com` → `/broker/projects` lists exactly the two
      broker1-granted projects.
- [ ] Logout broker1; login as `broker2@example.com` → `/broker/projects`
      shows only the one broker2-granted project — broker1's projects
      are NOT visible.
- [ ] Logout broker2; login as `sales@example.com` (Staff App) →
      `/sales` Projects screen lists all four catalog projects.

If any row fails: catalog sync is broken across the surface that failed.
Diagnostic order: check `/v1/public/projects` returns the row →
re-run Flow A e2e (`pnpm --filter @rep/api test:e2e`) → diff against the
web/mobile layer.

---

## 4. Privacy + data-handling spot-checks (every release)

Run after the platform-specific checklists. ~5 minutes.

- [ ] Inspect `chrome://net-export` on the public website during a
      maintenance document download — the response Location header
      contains a signed URL with `X-Amz-Signature` and the URL is
      different on each click.
- [ ] In Charles / Wireshark on the mobile apps: no `Authorization:
      Bearer …` header reaches the R2 host (only the app's API host).
- [ ] Open the admin Network panel: no permanent file URL appears in any
      `/v1/me/*` document response (only the document metadata; the URL
      is minted on tap).
- [ ] `flutter logs` on a debug build of either app: no token, no
      password, no signed URL appears for an entire login + browse +
      download cycle.
- [ ] `pnpm --filter @rep/api dev` console: no OTP code logged when
      `OTP_PROVIDER=twilio` (only `console` provider echoes it).

---

## 5. Cross-platform Flows B–H (PLACEHOLDERS — Phase 7B)

These checklists will be added in Phase 7B alongside the matching e2e
suites. Until then, the relevant per-platform checks above + the
`mobile-release-guide.md` §6 mobile checklist cover the surface area.
