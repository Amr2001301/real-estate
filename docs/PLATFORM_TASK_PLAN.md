# PLATFORM TASK PLAN — Road to 100/100
## Real Estate Platform — "Devora"

**Created:** 2026-08-19
**Based on:** `docs/PLATFORM_AUDIT_2026.md`
**Goal:** Fix all identified gaps and reach 100/100 platform readiness

---

## How to Use This Document

Each task has:
- **ID** — unique reference (e.g. `TASK-P0-001`)
- **Priority** — P0/P1/P2/P3
- **Effort** — S (< 2h) · M (half day) · L (1–2 days) · XL (3+ days)
- **Affects Score** — which component score improves
- **Depends On** — must complete these first
- **Status** — `[ ]` Not started · `[~]` In progress · `[x]` Done

Update status as you work. Do not begin P2/P3 tasks while any P0 remains open.

---

## Quick Summary

| Priority | Count | Estimated Total Effort |
|---|---|---|
| P0 — Blocker | 1 | ~L (1 day) |
| P1 — Critical | 4 | ~4–5 days |
| P2 — Important | 6 | ~6–8 days |
| P3 — Improvement | 7 | ~7–10 days |
| **Total** | **18 tasks** | **~18–24 days** |

---

## P0 — Blockers (Fix Before Anything Else)

---

### TASK-P0-001 — Fix Reports Cross-Tenant SQL Leak

- **Status**: `[x]`
- **Priority**: P0
- **Effort**: L
- **Affects Score**: Security (+15), Backend (+5), APIs (+4) → **+24 pts overall**
- **Depends On**: Nothing
- **Audit Ref**: P0-001 in `PLATFORM_AUDIT_2026.md`

**Problem:**
`$queryRawUnsafe()` in `apps/api/src/modules/reports/reports.module.ts` has zero `companyId` bindings. Raw SQL aggregates span ALL companies in a multi-tenant deployment.

**Affected functions:**
- `getByProject()` — unit/reservation breakdown per project
- `getBrokerLeaderboard()` — cross-company broker rankings
- `getSalesTrend()` — monthly sales trend
- `getTopPerformers()` — sales performance leaderboard

**Steps:**

1. Open `apps/api/src/modules/reports/reports.module.ts`

2. Inject `TenantContextService` into `ReportsService` constructor

3. For each raw SQL function, replace `$queryRawUnsafe(...)` with `$queryRaw` using `Prisma.sql` tagged templates:
   ```typescript
   // BEFORE (vulnerable):
   const rows = await this.prisma.$queryRawUnsafe<...[]>(
     `SELECT ... FROM "Project" WHERE ...`
   );

   // AFTER (safe):
   const companyId = this.tenantContext.getRequiredCompanyId();
   const rows = await this.prisma.$queryRaw<...[]>(
     Prisma.sql`SELECT ... FROM "Project" WHERE "companyId" = ${companyId} AND ...`
   );
   ```

4. Add `companyId` filter to every WHERE clause in every raw query in this file

5. Add an e2e test:
   - Create Company A and Company B with separate admins
   - Create projects/reservations/sales in both companies
   - Authenticate as ADMIN of Company A
   - Call `GET /v1/reports/*` and assert that results count/amounts match ONLY Company A data
   - Add to `apps/api/test/reports-mt-isolation.e2e-spec.ts`

6. Run existing e2e suite to confirm no regressions

**Acceptance Criteria:**
- `GET /v1/reports/by-project` returns only calling company's data
- `GET /v1/reports/broker-leaderboard` returns only calling company's brokers
- `GET /v1/reports/sales-trend` returns only calling company's sales
- New e2e test passes
- No raw `$queryRawUnsafe` remains in reports module

---

## P1 — Critical (Fix Before Staging Testing)

---

### TASK-P1-001 — Email Notifications on Domain Events

- **Status**: `[x]`
- **Priority**: P1
- **Effort**: L
- **Affects Score**: Backend (+3), APIs (+2), Testing Readiness (+2) → **+7 pts**
- **Depends On**: SMTP configured in staging env

**Problem:**
`EmailService` (nodemailer) works for auth emails but `NotificationsService.sendToUsers()` only creates in-app records + FCM push. Customers never receive email when their reservation is approved, contract is uploaded, deposit is verified, or maintenance is resolved.

**Steps:**

1. Open `apps/api/src/modules/notifications/notifications.service.ts`

2. Inject `EmailService` into `NotificationsService`

3. Add email sending to `sendToUsers()` after in-app record creation:
   ```typescript
   async sendToUsers(userIds: string[], templateCode: string, vars: Record<string, string>) {
     // existing: create Notification records + FCM push
     // ADD:
     const recipients = await this.prisma.user.findMany({
       where: { id: { in: userIds } },
       select: { email: true, fullName: true },
     });
     for (const r of recipients) {
       if (r.email) {
         await this.emailService.sendNotificationEmail(r.email, r.fullName, title, body);
       }
     }
   }
   ```

4. Add `sendNotificationEmail()` method to `EmailService` with Arabic HTML template

5. The following domain events should now trigger emails:
   - Reservation approved / rejected
   - Contract uploaded
   - Deposit verified / rejected
   - Maintenance status changed (resolved, in-progress)
   - Visit appointment confirmed

6. Add unit tests for `NotificationsService` email channel

**Acceptance Criteria:**
- Customer receives email when their reservation is approved
- Customer receives email when contract is available for download
- Customer receives email when deposit is verified
- Email contains Arabic content matching the notification template
- Emails not sent to users without email address (no crash)

---

### TASK-P1-002 — Add Production Guard to Seed Script

- **Status**: `[x]`
- **Priority**: P1
- **Effort**: S
- **Affects Score**: Security (+2), Backend (+1) → **+3 pts**
- **Depends On**: Nothing

**Problem:**
`apps/api/prisma/seed.ts` has no `NODE_ENV` check. Running `pnpm prisma:seed` against a production database is possible.

**Steps:**

1. Open `apps/api/prisma/seed.ts`

2. Add at the very top (before any imports take effect):
   ```typescript
   if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PROD !== 'true') {
     console.error('❌ Refusing to run seed in production. Set ALLOW_SEED_IN_PROD=true to override.');
     process.exit(1);
   }
   ```

3. Add a unit test:
   ```typescript
   // test: seed guard rejects when NODE_ENV=production
   ```

4. Document `ALLOW_SEED_IN_PROD` in `.env.example` with a warning comment

**Acceptance Criteria:**
- `NODE_ENV=production pnpm prisma:seed` exits with code 1 and clear error message
- `NODE_ENV=development pnpm prisma:seed` runs normally
- `NODE_ENV=production ALLOW_SEED_IN_PROD=true pnpm prisma:seed` runs normally (emergency override)

---

### TASK-P1-003 — Firebase Assets in Mobile Release Pipeline

- **Status**: `[x]`
- **Priority**: P1
- **Effort**: M
- **Affects Score**: Staff Mobile (+5), Customer Mobile (+5), Testing Readiness (+3) → **+13 pts**
- **Depends On**: Firebase project configured

**Problem:**
`firebase_options.dart` has FCM project config but release builds require `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) placed in platform directories. Push notifications are non-functional without these files.

**Steps:**

1. Remove the stale "TODO replace stub" comment from:
   - `apps/mobile/mobile_staff/lib/firebase_options.dart` line 1
   - `apps/mobile/mobile_customer/lib/firebase_options.dart` line 1

2. Add GitHub Actions secrets:
   - `FIREBASE_STAFF_GOOGLE_SERVICES_JSON`
   - `FIREBASE_CUSTOMER_GOOGLE_SERVICES_JSON`
   - `FIREBASE_STAFF_GOOGLE_SERVICE_INFO_PLIST`
   - `FIREBASE_CUSTOMER_GOOGLE_SERVICE_INFO_PLIST`

3. Add steps in `.github/workflows/ci.yml` (mobile-static job) to inject files before `flutter build`:
   ```yaml
   - name: Inject Firebase config (staff)
     run: |
       echo '${{ secrets.FIREBASE_STAFF_GOOGLE_SERVICES_JSON }}' > apps/mobile/mobile_staff/android/app/google-services.json
       echo '${{ secrets.FIREBASE_STAFF_GOOGLE_SERVICE_INFO_PLIST }}' > apps/mobile/mobile_staff/ios/Runner/GoogleService-Info.plist
   ```

4. Add Firebase Crashlytics dependency to `pubspec.yaml` in both mobile apps:
   ```yaml
   firebase_crashlytics: ^4.0.0
   ```

5. Initialize Crashlytics in `main.dart` of both apps:
   ```dart
   FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
   ```

6. Test push on real Android and iOS devices

**Acceptance Criteria:**
- `flutter build apk` and `flutter build ios` succeed with Firebase files injected
- Push notification received on real Android device
- Push notification received on real iOS device
- Crash reporting working (test with `FirebaseCrashlytics.instance.crash()`)

---

### TASK-P1-004 — CD Pipeline + web-public Dockerfile

- **Status**: `[x]`
- **Priority**: P1
- **Effort**: XL
- **Affects Score**: Web Public (+5), Testing Readiness (+3), Observability (+2) → **+10 pts**
- **Depends On**: Staging environment accessible

**Problem:**
No automated deployment pipeline exists. All Railway/Vercel deployments are manual. `web-public` has no Dockerfile or Vercel config committed.

**Steps:**

1. **Create `apps/web-public/Dockerfile`:**
   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY . .
   RUN pnpm install --frozen-lockfile
   RUN pnpm --filter web-public build

   FROM node:20-alpine AS runner
   WORKDIR /app
   ENV NODE_ENV=production
   COPY --from=builder /app/apps/web-public/.next/standalone ./
   COPY --from=builder /app/apps/web-public/.next/static ./.next/static
   COPY --from=builder /app/apps/web-public/public ./public
   EXPOSE 3001
   CMD ["node", "server.js"]
   ```

2. **Create `.github/workflows/deploy.yml`** with jobs:
   - `deploy-api` — on push to `main`, build Docker image → push to registry → Railway redeploy
   - `deploy-web-admin` — same pattern → Vercel or Railway
   - `deploy-web-public` — same pattern

3. **Add rollback step** in each deploy job:
   ```yaml
   - name: Rollback on failure
     if: failure()
     run: railway rollback --service api
   ```

4. Add `web-public` Vercel config (`vercel.json`) as alternative to Dockerfile

5. Document deployment runbook in `docs/production-deployment.md` (update existing file)

**Acceptance Criteria:**
- Push to `main` triggers automatic deploy of all 3 services
- Deploy failure triggers automatic rollback
- `web-public` builds and runs in Docker or deploys to Vercel automatically
- Rollback tested in staging environment

---

## P2 — Important (Fix Before Production)

---

### TASK-P2-001 — Migrate Reports SQL to Prisma.sql (Safety)

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: M
- **Affects Score**: Security (+3), Backend (+2) → **+5 pts**
- **Depends On**: TASK-P0-001 (fix MT first, then improve pattern)

**Problem:**
Even after adding `companyId` bindings in P0-001, the `$queryRawUnsafe` pattern is inherently risky — future edits may inadvertently bypass sanitization.

**Steps:**

1. After completing TASK-P0-001, convert all `$queryRawUnsafe` calls to `$queryRaw` with `Prisma.sql` tagged templates
2. Verify that `Prisma.sql` properly escapes all interpolated values
3. Add ESLint rule to prevent `$queryRawUnsafe` from being reintroduced:
   ```json
   // eslint rule: ban $queryRawUnsafe
   "no-restricted-properties": ["error", {
     "object": "prisma",
     "property": "$queryRawUnsafe",
     "message": "Use $queryRaw with Prisma.sql instead"
   }]
   ```

**Acceptance Criteria:**
- Zero `$queryRawUnsafe` in entire codebase
- ESLint fails CI if anyone reintroduces it
- Existing e2e tests still pass

---

### TASK-P2-002 — Inventory Matrix Server-Side Pagination

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: L
- **Affects Score**: Web Admin (+3), Performance (+4) → **+7 pts**
- **Depends On**: Nothing

**Problem:**
`apps/web-admin/src/app/dashboard/inventory/page.tsx:41` loads all units into memory for the matrix view. Self-flagged TODO. Will break with >1000 units.

**Steps:**

1. **Backend**: Add `GET /v1/units/inventory-matrix` endpoint in units module:
   - Accept `projectId`, `phaseId`, `buildingId`, `page`, `pageSize` params
   - Return units with their status, floor, type (only fields needed for matrix)
   - Use efficient Prisma query with select projection

2. **Web Admin**: Replace client-side all-units load with paginated API call:
   - Add project/phase/building filter dropdowns to inventory page
   - Implement virtual scrolling or page-based navigation for the matrix
   - Show unit count indicator

3. Add performance test: verify inventory endpoint handles 5000 units without timeout

**Acceptance Criteria:**
- Inventory matrix loads within 2 seconds for a project with 1000+ units
- Filters work correctly (project/phase/building/status)
- Pagination or virtual scroll implemented
- Old self-flagged TODO comment removed

---

### TASK-P2-003 — Mobile Units Filters via API

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: M
- **Affects Score**: Staff Mobile (+3), Customer Mobile (+3), APIs (+2) → **+8 pts**
- **Depends On**: Nothing

**Problem:**
Unit filters (bedrooms, bathrooms, price range, type) are applied client-side within the loaded page. Users can only filter within the current loaded dataset, not across all units.

**Steps:**

1. **Backend**: Confirm `GET /v1/units` and `GET /v1/public/units` already accept `bedrooms`, `bathrooms`, `minPrice`, `maxPrice`, `type` query params (audit shows they do).

2. **Staff Mobile** (`apps/mobile/mobile_staff/lib/features/catalog/`):
   - Add filter state to `UnitsQuery` class (already has `projectId`; add `minBeds`, `maxBeds`, `minPrice`, `maxPrice`, `type`)
   - Pass active filters as query params in `UnitsRemoteDataSourceImpl.list()`
   - Trigger API call when filters change (not just on first load)
   - Reset to page 1 when filters change

3. **Customer Mobile** (`apps/mobile/mobile_customer/lib/features/catalog/presentation/units/`):
   - Same pattern — wire filter sheet selections to API params

4. Update filter sheet UI in both apps to show "loading" indicator when filters are being applied

**Acceptance Criteria:**
- Selecting "3 bedrooms" filter calls API with `?bedrooms=3` — not just filters the current page
- Changing price range triggers new API call
- Filter + pagination work together correctly (page resets on filter change)
- Empty result state shows when no units match filters

---

### TASK-P2-004 — CMS Article Editor with RTE and Image Upload

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: XL
- **Affects Score**: Web Admin (+3), Web Public (+2) → **+5 pts**
- **Depends On**: Nothing

**Problem:**
CMS articles are read-only in web-admin. No rich-text editor, no in-article image upload. Articles cannot be created or edited through the admin UI.

**Steps:**

1. **Backend**: Verify `POST /v1/cms/articles` and `PATCH /v1/cms/articles/:id` exist and accept `content` (rich text HTML/JSON)

2. **Web Admin**: Add article create/edit page:
   - Install TipTap editor: `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image`
   - Create `apps/web-admin/src/app/dashboard/cms/articles/create/page.tsx`
   - Create `apps/web-admin/src/app/dashboard/cms/articles/[id]/edit/page.tsx`
   - Implement RTE toolbar: bold, italic, headings, lists, image insert
   - Add image upload button: presign via existing media endpoint → insert URL into editor

3. **Web Admin**: Update article list page to show edit/create buttons

4. **Web Public**: Confirm article detail page renders HTML content safely (sanitize with DOMPurify)

**Acceptance Criteria:**
- Admin can create article with formatted text (headings, bold, lists)
- Admin can insert images into article body
- Published article appears correctly on web-public
- HTML content is sanitized (no XSS via article content)

---

### TASK-P2-005 — Customer Maintenance Actions on Web-Public Portal

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: M
- **Affects Score**: Web Public (+4) → **+4 pts**
- **Depends On**: Nothing

**Problem:**
Mobile customer can confirm maintenance resolution and submit complaints. These actions are missing from `web-public/src/app/(account)/maintenance/` portal.

**Steps:**

1. Find the customer mobile implementation:
   - `apps/mobile/mobile_customer/lib/features/maintenance/`
   - API endpoints: `POST /v1/me/maintenance-requests/:id/confirm-resolution` and `POST /v1/me/maintenance-requests/:id/complaint`

2. Add to web-public maintenance detail page (`apps/web-public/src/app/(account)/maintenance/[id]/page.tsx`):
   - "Confirm Resolution" button — appears when status is `RESOLVED`
   - "Submit Complaint" form — text area + submit, appears when status is `RESOLVED`
   - Both call their respective API endpoints via server action

3. Add success/error feedback messages in Arabic

4. Update e2e test for web-public maintenance flow

**Acceptance Criteria:**
- "Confirm Resolution" button visible and functional when maintenance is resolved
- "Submit Complaint" form submits to API correctly
- Both actions refresh maintenance status after success
- Error states handled with Arabic message

---

### TASK-P2-006 — APM and Alerting

- **Status**: `[x]`
- **Priority**: P2
- **Effort**: XL
- **Affects Score**: Observability (+8), Performance (+3) → **+11 pts**
- **Depends On**: Staging environment deployed (TASK-P1-004)

**Problem:**
No metrics collection, no alerting. Issues only discoverable through Sentry (optional) or logs.

**Steps:**

1. **Add Prometheus metrics to NestJS API:**
   - Install `prom-client` and `@willsoto/nestjs-prometheus`
   - Add metrics: `http_request_duration_ms`, `http_requests_total`, `db_query_duration_ms`, `active_connections`
   - Expose `/metrics` endpoint (protected — internal only, not in v1 prefix)

2. **Deploy Grafana + Prometheus** (docker-compose addition or Railway service):
   - Add `prometheus.yml` scrape config for the API
   - Import NestJS dashboard template from Grafana marketplace

3. **Define SLO alert rules** in Prometheus:
   ```yaml
   - alert: HighErrorRate
     expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
   - alert: SlowResponses
     expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 2000
   - alert: APIDown
     expr: up{job="devora-api"} == 0
   ```

4. **Add Firebase Crashlytics** to both mobile apps (covered in TASK-P1-003)

5. **Add Firebase Performance Monitoring** to both mobile apps:
   ```dart
   await FirebasePerformance.instance.setPerformanceCollectionEnabled(true);
   ```

**Acceptance Criteria:**
- `GET /metrics` returns Prometheus-format metrics
- Grafana dashboard shows request rate, error rate, latency P50/P95/P99
- Alert fires within 5 minutes of induced high error rate
- Mobile crash reports visible in Firebase Console

---

## P3 — Improvements (Post-Testing Quality Uplift)

---

### TASK-P3-001 — Split God Files in Backend

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: L per file × 3 files
- **Affects Score**: Code Quality, Maintainability

**Files to split:**
- `apps/api/src/modules/reports/reports.module.ts` (2,458 lines)
- `apps/api/src/modules/maintenance/maintenance.module.ts` (~1,900 lines)
- `apps/api/src/modules/deposits/deposits.module.ts` (~1,250 lines)

**Per file steps:**
1. Create `reports.service.ts`, `reports.controller.ts`, `reports.dto.ts`
2. Move class definitions to their files
3. Import them back in `reports.module.ts` (module registration only)
4. Run full test suite — all existing tests must still pass
5. Repeat for maintenance and deposits

**Acceptance Criteria:**
- No `.module.ts` file exceeds 300 lines
- All existing tests pass
- No functional change

---

### TASK-P3-002 — Reports PDF and Excel Export

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: L
- **Affects Score**: Web Admin (+3)

**Steps:**

1. Install `pdfmake` and `exceljs` in api:
   ```bash
   pnpm add pdfmake exceljs --filter api
   ```

2. Add export endpoints to reports controller:
   - `GET /v1/reports/export/pdf?type=sales&from=...&to=...`
   - `GET /v1/reports/export/excel?type=financial&year=...`

3. Generate PDF with logo, date range, table of results

4. Generate Excel with multiple sheets (one per report type)

5. Web Admin: Add "Export PDF" and "Export Excel" buttons to each report page

**Acceptance Criteria:**
- PDF export downloads with correct data and Arabic text
- Excel export downloads with correct data, multiple sheets
- Both work for sales, financial, and broker reports

---

### TASK-P3-003 — Advanced Lead Filters on Staff Mobile

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: M
- **Affects Score**: Staff Mobile (+2)

**Problem:** Staff mobile leads list only filters by `q` (search). Web admin has source, assignedTo, status, dateRange filters.

**Steps:**

1. Add filter bottom sheet to `leads_screen.dart` with:
   - Status selector (NEW/CONTACTED/QUALIFIED/etc.)
   - Lead source selector (fetched from `/lead-sources`)
   - Date range picker

2. Pass selected filters as query params in `LeadsRemoteDataSourceImpl.list()`

3. Add "Active filters" chip row below search bar to show applied filters + clear buttons

**Acceptance Criteria:**
- Can filter leads by status, source, date range from mobile
- Filters persist during the session (cleared on screen dispose)
- "Clear all filters" button resets to full list

---

### TASK-P3-004 — Verify / Remove PlanTemplateScheduleItem Dead Code

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: S

**Problem:** `PlanTemplateScheduleItem` model exists in `schema.prisma` but no active code path was confirmed to create or read from it. The installment calculator uses `computeDurationOption()` which does not touch this table.

**Steps:**

1. Run: `grep -r "PlanTemplateScheduleItem\|planTemplateScheduleItems\|scheduleItems" apps/api/src --include="*.ts"`

2. If zero results: add a migration to drop the table + update `schema.prisma`

3. If results found: document the usage in a comment above the model in schema.prisma

**Acceptance Criteria:**
- Either table is removed (with migration) OR its usage is documented
- No orphaned model in schema

---

### TASK-P3-005 — Standardize Soft-Delete Pattern

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: L
- **Affects Score**: Database (+3)

**Problem:** Soft-delete is inconsistent — `Document` uses `deletedAt DateTime?`, other entities use `active Boolean`, some have neither.

**Steps:**

1. Decide on single pattern: `deletedAt DateTime?` (industry standard, more informative than boolean)

2. For each sensitive entity that should support recovery (Contracts, Deposits, Reservations, Users):
   - Add migration: `ALTER TABLE "..." ADD COLUMN "deletedAt" TIMESTAMP;`
   - Remove `active` boolean if it exists
   - Update Prisma schema
   - Update service methods to filter `WHERE deletedAt IS NULL`
   - Add `restore()` method to each service

3. Update e2e tests to verify soft-deleted records are excluded from lists but recoverable

**Acceptance Criteria:**
- All sensitive entities use `deletedAt` pattern
- No `active` boolean fields remain for delete-scoping
- Deleted records not returned in list endpoints
- Admin can restore soft-deleted records

---

### TASK-P3-006 — Add DB-Level Constraints

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: S
- **Affects Score**: Database (+2)

**Problem:** Several fields have no database-level constraints (only application-level validation):
- Commission rate 0–100
- `BonusEntry.commissionAmount > 0`

**Steps:**

1. Add Prisma migration:
   ```sql
   ALTER TABLE "BonusRule" ADD CONSTRAINT "commission_rate_range" CHECK ("commissionRate" >= 0 AND "commissionRate" <= 100);
   ALTER TABLE "BonusEntry" ADD CONSTRAINT "commission_amount_positive" CHECK ("commissionAmount" > 0);
   ```

2. Update `schema.prisma` with `@db.Check` annotations (Prisma 6 supports this)

3. Verify existing seed data doesn't violate constraints

**Acceptance Criteria:**
- DB rejects commission rate > 100 even if application validation is bypassed
- Migration runs cleanly on clean + existing databases

---

### TASK-P3-007 — API Versioning Strategy Documentation

- **Status**: `[x]`
- **Priority**: P3
- **Effort**: S
- **Affects Score**: APIs (+2)

**Steps:**

1. Create `docs/API_VERSIONING.md` documenting:
   - Current state: single `/v1` prefix
   - Deprecation policy: 6-month notice before removing/changing endpoints
   - How to introduce `/v2` when needed
   - Mobile client upgrade strategy (force-update vs. graceful degradation)

2. Add `X-API-Version: 1` response header in NestJS global interceptor

3. Add API version to Swagger docs header

**Acceptance Criteria:**
- `docs/API_VERSIONING.md` exists and is reviewed
- All API responses include `X-API-Version` header

---

## Testing Tasks (Run After P0+P1 Fixed)

These are testing tasks that must be created **after** the fixes above are deployed to staging.

---

### TASK-TEST-001 — Reports MT Isolation E2E Test

- **Status**: `[x]`
- **Priority**: P0 companion
- **Effort**: M
- **Depends On**: TASK-P0-001

Create `apps/api/test/reports-mt-isolation.e2e-spec.ts`:
- Company A: 5 projects, 50 reservations, 3 sales reps
- Company B: 3 projects, 20 reservations, 2 sales reps
- Authenticate as Company A ADMIN
- Assert all report figures match only Company A data
- Authenticate as Company B ADMIN
- Assert all report figures match only Company B data

---

### TASK-TEST-002 — @PermissionsStrict Two-Person Flow E2E

- **Status**: `[x]`
- **Priority**: P1 companion
- **Effort**: L
- **Depends On**: Nothing

Create comprehensive e2e tests covering all `@PermissionsStrict` flows:
- ADMIN without explicit `deposits:verify` permission → `403`
- ADMIN with `deposits:verify` permission → `200`
- ADMIN without `reservations:approve` → `403`
- SALES attempting `reservations:approve` → `403`
- All 12+ strict-permission endpoints covered

---

### TASK-TEST-003 — Mobile Upload E2E Test

- **Status**: `[x]`
- **Priority**: P2 companion
- **Effort**: M
- **Depends On**: Staging R2 bucket accessible

Create integration tests for upload flows:
- Payment proof: presign → PUT → attach to deposit
- Maintenance document: presign → PUT → attach → verify signed GET URL
- Test that files are actually stored in R2 (not just returning 200)

---

### TASK-TEST-004 — IDOR Penetration Test Suite

- **Status**: `[x]`
- **Priority**: P1 companion
- **Effort**: L
- **Depends On**: Staging environment

Create e2e tests for all IDOR scenarios:
- Customer A accesses Customer B's contract → `404`
- Customer A accesses Customer B's deposit → `404`
- Customer A accesses Customer B's maintenance request → `404`
- Staff member accesses different company's data → `404`
- Broker accesses another broker's leads → `403`

---

## Implementation Order

Follow this exact order to minimize risk and unblock testing as fast as possible:

```
Week 1
  Day 1–2  → TASK-P0-001 (fix reports SQL + write isolation test)
  Day 3    → TASK-P1-002 (seed guard — 2 hours max)
  Day 4–5  → TASK-P1-001 (email domain events)

Week 2
  Day 1–2  → TASK-P1-003 (Firebase assets + Crashlytics)
  Day 3–5  → TASK-P1-004 (CD pipeline + web-public Dockerfile)

Week 3 — First Staging Testing Round
  ↑ Fix any P0/P1 bugs found during testing
  Day 1–2  → TASK-P2-001 (migrate to Prisma.sql)
  Day 3–5  → TASK-P2-002 (inventory server pagination)

Week 4
  Day 1–2  → TASK-P2-003 (mobile units filters via API)
  Day 3–5  → TASK-P2-005 (web-public maintenance actions)

Week 5
  Day 1–5  → TASK-P2-004 (CMS article RTE)

Week 6
  Day 1–5  → TASK-P2-006 (APM + alerting)

Week 7–8 — Second Staging Testing Round
  ↑ Regression testing of all P2 fixes

Week 9–10 (P3 — Quality Uplift)
  → TASK-P3-001 (split god files)
  → TASK-P3-004 (PlanTemplateScheduleItem)
  → TASK-P3-006 (DB constraints)
  → TASK-P3-007 (API versioning docs)
  → TASK-P3-002 (PDF/Excel export)
  → TASK-P3-003 (lead filters mobile)
  → TASK-P3-005 (soft-delete standardize)
```

---

## Score Projection After All Tasks Complete

| Component | Current | After P0+P1 | After P2 | After P3 | Target |
|---|---|---|---|---|---|
| Backend | 84 | 95 | 97 | 99 | **100** |
| Web Admin | 90 | 91 | 97 | 99 | **100** |
| Web Public | 82 | 86 | 95 | 97 | **100** |
| Staff Mobile | 88 | 95 | 98 | 99 | **100** |
| Customer Mobile | 86 | 93 | 97 | 99 | **100** |
| APIs | 83 | 93 | 97 | 99 | **100** |
| Database | 87 | 88 | 90 | 98 | **100** |
| Security | 75 | 93 | 96 | 98 | **100** |
| Performance | 78 | 79 | 92 | 95 | **100** |
| Testing Readiness | 82 | 92 | 96 | 99 | **100** |
| **Overall** | **83** | **90** | **96** | **99** | **100** |

---

## Quick Reference: Files to Change

| Task | Files |
|---|---|
| TASK-P0-001 | `apps/api/src/modules/reports/reports.module.ts`, `apps/api/test/reports-mt-isolation.e2e-spec.ts` |
| TASK-P1-001 | `apps/api/src/modules/notifications/notifications.service.ts`, `apps/api/src/modules/auth/email.service.ts` |
| TASK-P1-002 | `apps/api/prisma/seed.ts`, `apps/api/.env.example` |
| TASK-P1-003 | `.github/workflows/ci.yml`, `firebase_options.dart` ×2, `pubspec.yaml` ×2, `main.dart` ×2 |
| TASK-P1-004 | `apps/web-public/Dockerfile`, `.github/workflows/deploy.yml`, `docs/production-deployment.md` |
| TASK-P2-001 | `apps/api/src/modules/reports/reports.module.ts`, `.eslintrc.js` |
| TASK-P2-002 | `apps/api/src/modules/units/units.module.ts`, `apps/web-admin/src/app/dashboard/inventory/page.tsx` |
| TASK-P2-003 | `apps/mobile/mobile_staff/lib/features/catalog/`, `apps/mobile/mobile_customer/lib/features/catalog/` |
| TASK-P2-004 | `apps/web-admin/src/app/dashboard/cms/articles/`, `apps/web-public/src/app/(marketing)/articles/` |
| TASK-P2-005 | `apps/web-public/src/app/(account)/maintenance/[id]/page.tsx` |
| TASK-P2-006 | `apps/api/src/main.ts`, `docker-compose.yml`, `prometheus.yml`, `apps/mobile/*/pubspec.yaml` |
| TASK-P3-001 | `reports.module.ts`, `maintenance.module.ts`, `deposits.module.ts` → split each |
| TASK-P3-002 | `apps/api/src/modules/reports/reports.module.ts`, `apps/web-admin/src/app/dashboard/reports/` |
| TASK-P3-003 | `apps/mobile/mobile_staff/lib/features/leads/` |
| TASK-P3-004 | `apps/api/prisma/schema.prisma`, new migration if table dropped |
| TASK-P3-005 | `apps/api/prisma/schema.prisma`, new migration, affected services |
| TASK-P3-006 | `apps/api/prisma/schema.prisma`, new migration |
| TASK-P3-007 | `docs/API_VERSIONING.md`, `apps/api/src/common/interceptors/` |
