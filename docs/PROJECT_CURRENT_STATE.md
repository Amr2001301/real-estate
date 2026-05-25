# Project Current State

> **Audit date:** 2026-05-25
> **Auditor:** Claude Code (senior architect / full-stack / QA / delivery review)
> **Method:** Read-only inspection of the entire monorepo. No files were modified.
> **Scope source:** The scope PDF was **NOT found** at `docs/scope.pdf`, `docs/real_estate_platform_scope.pdf`, or `real_estate_platform_scope.pdf`. This audit uses the scope supplied in the task prompt and the attached scope document content (Public Website, Admin Dashboard, Client/Customer Mobile App, Sales Mobile App).

---

## 1. Executive Summary

This is a **four-surface real-estate platform** built as a pnpm + Turborepo monorepo. Two of the four surfaces (Backend API + Admin Dashboard) are substantially built and production-leaning; the Public Website is built for **guest browsing** but its **authenticated customer/client portal is not built**; and **both mobile apps (Sales, Client/Customer) do not exist yet** — there are no `mobile-*` directories despite the README referencing them.

The backend is notably more complete than a typical MVP: 35 NestJS modules, ~37 Prisma models, 24 migrations, JWT + OTP auth, a fine-grained RBAC layer (roles + permission codes), audit logging, presigned R2 uploads, Swagger, and 54 unit/integration test specs. It also contains a **large Broker/Brokerage subsystem** (brokers, broker users, broker access, broker leads, broker commissions, broker payouts, broker portal) that is **not part of the original scope PDF** — this is real, working scope expansion that must be accounted for in delivery and QA.

The most important honest caveats:
- **Notifications are ~80% stubbed** (FCM push and SMTP email are configured but not wired; only in-app records + OTP SMS work). This blocks mobile.
- **No tests run in CI** (CI only lints, typechecks, builds). 54 API specs + Playwright smoke suites exist but are not gated.
- **No deployment automation, no backup/DR runbook, no dependency scanning.**
- The **customer-facing post-purchase portal** (My Property, Contracts, Deposits, Maintenance, Notifications, Favorites, Visit Requests, Profile) — required by scope on *both* web and mobile — exists on the **backend** but has **no web-public UI** and **no mobile app** consuming it.

## 2. Current Product Maturity

| Surface | Maturity | One-line justification |
| --- | --- | --- |
| Backend API (NestJS) | **MVP → approaching production** | Broad real domain coverage + tests; gaps in notifications, CI gating, ops runbooks. |
| Admin Dashboard | **MVP → approaching production** (~78%) | Core CRUD real; financial/CMS/notifications partial; some stub routes; thin form validation. |
| Public Website (guest) | **MVP** | Real API-backed browsing/SEO/SSR; no advanced project filters, no sort. |
| Public Website (customer portal) | **Not built** | Auth UI exists but logs in to nowhere (redirects to `/projects`). |
| Sales Mobile App | **Not started** | No code. |
| Client/Customer Mobile App | **Not started** | No code. |
| Platform overall | **MVP, not yet enterprise-ready** | Two of four surfaces missing/partial; ops, notifications, and CI gates incomplete. |

**Verdict:** This is a strong MVP with a production-leaning backend, **not** an enterprise-ready, fully-delivered platform. Treat it as ~50–55% of the full four-surface scope.

## 3. Current Architecture

```
Monorepo (pnpm workspaces + Turborepo)
├── apps/
│   ├── api/          NestJS 10 · Prisma 5 · PostgreSQL 16 · Redis/BullMQ · R2 · Firebase(stub) · Sentry
│   ├── web-admin/    Next.js 15 (App Router, React 19) · Tailwind · server actions · Playwright
│   └── web-public/   Next.js 15 (App Router, React 19) · Tailwind · ISR/SSR · Playwright
├── packages/
│   ├── shared-types/ Zod schemas + TS types (auth, project, unit, lead, reservation, pagination, translatable)
│   └── tsconfig/     base / nest / next TS configs (strict mode on)
└── (NO mobile-client / mobile-sales — referenced in README but absent)
```

**Data flow (web):** Browser → Next.js (server components / server actions) → `/api-proxy/*` rewrite → NestJS `/v1/*` → Prisma → PostgreSQL. Uploads go browser → presigned URL → Cloudflare R2 directly (API only issues the signed URL).

**Hosting (per README, not automated in repo):** Railway (API + Postgres + Redis), Vercel (both web apps).

## 4. Current Tech Stack

- **Backend:** NestJS 10.4, Prisma 5.22, PostgreSQL 16, Redis + BullMQ (infra only, no processors), `@nestjs/schedule` crons, `@aws-sdk/*` for R2 presigning, `firebase-admin` (installed, **not wired**), `nodemailer` (installed, **not wired**), Argon2, `@nestjs/throttler`, Helmet, `@nestjs/swagger`, Zod env validation, Sentry (optional).
- **Web (both):** Next.js 15.1, React 19, TypeScript 5.6 (strict), Tailwind 3.4, Playwright. Admin adds Recharts, `@react-google-maps/api`, `@dnd-kit`. No `react-hook-form`; forms use native + `useActionState` + server actions. No `next-intl` (Arabic-first, hardcoded; admin has bilingual `{ar,en}` inputs).
- **Shared:** `@rep/shared-types` (Zod), `@rep/tsconfig`.
- **Tooling:** Turborepo, ESLint 9 (flat, warning-biased/brownfield), Prettier, Jest (API), Playwright (web).

## 5. Existing Modules (backend, evidence-based)

Complete & real: `auth`, `users`, `projects`, `phases`, `buildings`, `units`, `leads`, `requests` (info/visit), `visits`, `favorites`, `reservations`, `contracts` (PDF link + sign), `installments` (+ templates, overdue cron), `deposits` (admin-recorded), `maintenance` (+ categories, SLA, items), `bonus` (rules/entries/targets, auto-gen on contract), `cms` (pages/banners/articles), `reports` (KPIs, sales, financial, CSV), `audit`, `settings`, `permissions`, `documents` (polymorphic, MIME/size guarded), `media` (R2 presign), `health`, plus the full **broker subsystem** (`brokers`, `broker-users`, `broker-access`, `broker-leads`, `broker-reservations`, `broker-contracts`, `broker-commissions`, `broker-payouts`, `broker-portal`, `broker-reports`) and `crm` lead-matching utility.

Partial/stub: `notifications` (records + device tokens real; **push/email delivery not wired**).

## 6. Current Auth / Roles Flow

- **Staff (web):** email + password (`/auth/login`) — Argon2 verified; roles ADMIN, SALES, SALES_MANAGER, MAINTENANCE_SUPERVISOR, BROKER.
- **Customers (web-public):** email + password (`/auth/customer/register|login`) and phone OTP (`/auth/otp/request|verify`, Twilio or console). OTP hashed (SHA256), 10-min TTL, 5-attempt cap, throttled.
- **Tokens:** JWT access (15m) + refresh (30d, hashed at rest, rotated on use).
- **Roles:** `ADMIN, SALES, SALES_MANAGER, MAINTENANCE_SUPERVISOR, BROKER, CLIENT, CUSTOMER` (7) — broader than the scope PDF's 5 (Guest/Client/Customer/Sales/Admin).
- **Guards (global chain):** ThrottlerGuard → JwtAuthGuard → RolesGuard → PermissionsGuard (`@Roles`, `@Permissions('code')`, `@Public`, admin bypass). Permission codes stored in DB and assignable per user.
- **Web session:** Admin uses httpOnly cookies (access/refresh) + a non-httpOnly `user` hint cookie + middleware route guard. Web-public stores session in **localStorage only** (no protected routes yet).
- **Ownership scoping:** done inline in services (customer sees own leads/reservations/contracts; sales-manager sees team via `managerId`; broker scoped by broker access). **No centralized ownership guard** — easy to miss on new endpoints.

## 7. What Is Actually Complete (code-proven)

- Backend domain for the **entire** Admin/Sales/Customer workflow: projects → units → leads → visits → reservations → contracts (PDF) → deposits → installments → maintenance → bonus, plus brokers and reports.
- Admin Dashboard CRUD for: projects, units, leads (kanban), contracts (+PDF upload), deposits (+verify, +receipt), reservations, installments, visits, maintenance, clients, customers, brokers, broker payouts, users, bonus, financial reports, settings, CMS (pages/banners), audit logs.
- Public Website guest experience: home, projects list+detail, units list+detail, compare, contact (real submit), login/register UI, SEO (metadata, JSON-LD, sitemap, robots), ISR, Google Maps embed.
- Cross-cutting: audit interceptor, locale interceptor, request-id, JSON logging, env validation, Swagger at `/docs`, presigned R2 uploads with MIME/size guards, reservation-expiry + installment-overdue crons.
- 54 backend test specs (permissions, workflows, calculations) + Playwright smoke suites for both web apps.

## 8. What Is Partial

- **Admin:** financial home KPIs use **hardcoded demo trend/alert data** (`TODO(phase-5)`); CMS (articles read-only, banner via URL only, no rich text); notifications/templates UI minimal; documents/permissions/operations/targets routes thin or stub; form validation is HTML5-only (no Zod/per-field errors); no token refresh on long sessions.
- **Public:** project filters limited to search + featured (no price/type/amenities/sort); images use raw `<img>` (not `next/image`); single-locale (no English runtime switch); unit floor-plan is a placeholder SVG.
- **Backend:** notifications delivery; BullMQ has no processors.

## 9. What Is Missing

- **Web-public customer/client portal:** Favorites, Visit Requests, My Requests, Profile, My Property, Contracts, Deposits, Maintenance, Notifications — **no UI** (backend endpoints exist).
- **Sales Mobile App** — entirely (login, dashboard, clients/CRM pipeline, leads, projects/units, unit/installment calculator, reservations, visits, bonus, notifications, profile).
- **Client/Customer Mobile App** — entirely (onboarding, auth, home, projects/units, favorites, visits, requests, notifications, profile + customer: my property, deposits, contracts, maintenance).
- **Mobile API foundation:** confirmed OpenAPI export / generated Dio client; push notifications; mobile-shaped endpoints/versioning.
- **Notification delivery** (FCM + email) — required by every mobile/notification feature.
- **Ops:** CI test gating, deployment automation, backup/DR runbook, dependency/secret scanning, APM/metrics.

## 10. What Is Risky

| Risk | Why it matters |
| --- | --- |
| Notifications stubbed | Mobile apps + "Notifications" pages across scope cannot function. **Blocks Phases 4–6.** |
| No CI test gate | 54 specs + E2E exist but regressions can merge silently. Enterprise reviewers will flag this immediately. |
| No centralized ownership guard | Customer/broker data-scoping is inline; a missed check on a new endpoint = cross-tenant data leak. |
| localStorage tokens on web-public | XSS-exposed token storage for customers; not enterprise-grade once the portal carries financial/contract data. |
| Hardcoded demo data on Admin home | Financial KPIs shown to decision-makers are not real (`TODO(phase-5)`). Misleading. |
| Broker subsystem beyond scope | Large surface (10+ modules) to QA, secure, and maintain that the original scope didn't budget for. |
| No backup/DR + no deploy automation | Data-loss and release-integrity exposure for a company holding contracts/financials. |
| Thin form validation (admin) | Relies entirely on API validation; inconsistent UX and weak defense-in-depth. |
| Decimal commission bounds | `Decimal(5,2)` allows out-of-range %; needs validation caps. |

---

### Bottom line
A credible, well-architected MVP with a strong backend and two web surfaces in progress. To reach the **enterprise-ready, full four-surface scope** the company expects, the critical path is: **stabilize + gate CI → finish notification delivery + mobile API foundation → complete the web customer portal → build the two Flutter apps → harden ops/security/QA for handover.** See `IMPLEMENTATION_ROADMAP.md`.
