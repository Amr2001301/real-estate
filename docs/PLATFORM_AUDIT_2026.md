# DEEP TECHNICAL & FUNCTIONAL AUDIT REPORT
## Real Estate Platform — "Devora"

**Date:** 2026-08-19
**Type:** Read-Only — No code modified during audit
**Scope:** Full-stack (Backend · Web Admin · Web Public · Staff Mobile · Customer Mobile · Database · Security · Performance · Testing)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Architecture](#2-platform-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Feature Inventory](#4-feature-inventory)
5. [Roles Inventory](#5-roles-inventory)
6. [Role × Feature Matrix](#6-role--feature-matrix)
7. [Staff Deep Audit](#7-staff-deep-audit)
8. [Staff Mobile Completeness](#8-staff-mobile-completeness)
9. [Web vs Mobile Feature Parity](#9-web-vs-mobile-feature-parity)
10. [Mobile App Audit](#10-mobile-app-audit)
11. [Backend / API Audit](#11-backend--api-audit)
12. [Database Audit](#12-database-audit)
13. [Business Flows](#13-business-flows)
14. [Performance Audit](#14-performance-audit)
15. [Security Audit](#15-security-audit)
16. [Error Handling Audit](#16-error-handling-audit)
17. [Notifications Audit](#17-notifications-audit)
18. [Search / Filters / Pagination Audit](#18-search--filters--pagination-audit)
19. [File & Image Upload Audit](#19-file--image-upload-audit)
20. [Code Quality & Architecture](#20-code-quality--architecture)
21. [Existing Tests](#21-existing-tests)
22. [Incomplete / Suspicious Features](#22-incomplete--suspicious-features)
23. [Configuration & Environment](#23-configuration--environment)
24. [Observability](#24-observability)
25. [Critical Issues — P0/P1/P2/P3](#25-critical-issues--p0p1p2p3)
26. [Platform Completeness Scores](#26-platform-completeness-scores)
27. [Testing Readiness](#27-testing-readiness)
28. [Recommended Testing Order](#28-recommended-testing-order)
29. [Final Conclusion](#29-final-conclusion)

---

## 1. Executive Summary

المنصة في حالة **أكثر نضجًا بكثير** مما توحي به ملاحظات الذاكرة القديمة. غالبية الميزات مكتملة end-to-end. الاكتشاف الأهم والأخطر في هذا الـ Audit:

> **🚨 CRITICAL — P0:** وحدة `reports` تحتوي على raw SQL queries (`$queryRawUnsafe`) لا تحمل أي `companyId` → تسريب بيانات cross-tenant في أي deployment متعدد الشركات. هذا هو الـ blocking issue الوحيد قبل Production.

**ما تم التحقق منه:**
- Backend: 39 وحدة، 358 route، بنية محكمة
- Web Admin: API integration حقيقي في 162 موضع، refresh interceptor، RBAC كامل
- Staff Mobile: 42 شاشة، 45 cubit، 58 endpoint مربوط — **مكتمل**
- Customer Mobile: 33 شاشة، 26 cubit، 42 endpoint مربوط — **مكتمل**
- FCM/Push: مُنفَّذ بالكامل (الملاحظات القديمة "stubbed" **خاطئة**)
- Tests: 99 unit + 46 e2e backend + CI محكم بـ path-filtered jobs

**الملاحظات القديمة التي ثبت خطأها:**
- "Notifications stubbed" → FCM مكتمل، nodemailer مكتمل
- "Mobile blockers external" → Mobile code complete، الحاجة فقط لـ Firebase assets في release builds
- "Staff mobile missing features" → 36/37 feature جاهزة للاختبار

---

## 2. Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  web-admin (Next.js 15, App Router) — staff/admin           │
│  web-public (Next.js 15, App Router) — marketing + portal   │
│  mobile_staff (Flutter, Clean Arch, Bloc/Cubit)             │
│  mobile_customer (Flutter, Clean Arch, Bloc/Cubit)          │
└────────────────────┬────────────────────────────────────────┘
                     │ REST / JSON  (Global prefix /v1)
┌────────────────────▼────────────────────────────────────────┐
│              apps/api  (NestJS 10, TypeScript)               │
│  Guard stack: Throttler → JWT → Roles → Permissions          │
│  Interceptors: RequestLogger → TenantContext → Locale → Audit│
│  39 modules · 358 routes · Swagger at /docs                  │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
┌──────▼──────┐ ┌────▼────┐  ┌──────▼──────┐
│ PostgreSQL  │ │  Redis  │  │  R2/MinIO   │
│ (Prisma 6)  │ │         │  │ (2 buckets: │
│ 61 models   │ │         │  │  pub/priv)  │
│ MT middleware│ │         │  │ presigned   │
└────────────┘ └─────────┘  └─────────────┘
       │
┌──────▼──────┐
│  Firebase   │ ← FCM push (Admin SDK, lazy-init)
│  SMTP       │ ← Email (nodemailer, Arabic HTML templates)
│  Twilio     │ ← SMS OTP (prod) / console (dev)
└─────────────┘
```

**Communication Patterns:**
- Web apps → API: server-side `fetch` with httpOnly cookies
- Mobile → API: Dio with Bearer token injection + token refresh interceptor
- Business logic: entirely in NestJS services — no duplication between web/mobile
- Shared services: `R2Service`, `PrismaService`, `NotificationsService`, `PushService`, `EmailService`

**State Management:**
- Web: Next.js Server Actions + server-side fetch
- Mobile: flutter_bloc (Cubit pattern)

**Multi-tenant:** `AsyncLocalStorage` + Prisma `$use` middleware auto-injects `companyId` on ~50 models. `DEFAULT_COMPANY_ID` env for public routes. SUPER_ADMIN bypasses. **Exception: raw SQL in reports (P0-001).**

---

## 3. Repository Structure

```
/Real Estate
├── apps/
│   ├── api/                          ← NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma         ← 61 models, 51 enums
│   │   │   ├── seed.ts               ← idempotent seed (⚠️ no prod guard)
│   │   │   └── migrations/           ← 19 migrations
│   │   └── src/
│   │       ├── app.module.ts         ← global guards/interceptors
│   │       ├── main.ts               ← bootstrap, Helmet, CORS
│   │       ├── config/env.validation.ts ← Zod env schema (fail-fast)
│   │       ├── common/               ← guards, decorators, interceptors,
│   │       │                            firebase, ownership, R2, prisma, SMS
│   │       ├── modules/              ← 39 feature modules
│   │       └── test/                 ← 46 e2e test files
│   │
│   ├── web-admin/                    ← Next.js admin
│   │   └── src/
│   │       ├── lib/api.ts            ← 162 callers, refresh interceptor
│   │       ├── app/dashboard/        ← all admin pages
│   │       └── middleware.ts         ← route protection
│   │
│   ├── web-public/                   ← Next.js marketing + customer portal
│   │   └── src/
│   │       ├── app/                  ← marketing + /account portal
│   │       └── lib/api/              ← API calls
│   │
│   └── mobile/
│       ├── mobile_staff/             ← Flutter staff app
│       │   ├── lib/features/         ← 17 feature domains
│       │   ├── lib/router/app_router.dart ← 668 lines, role-based
│       │   └── firebase_options.dart ← real FCM config (stale "TODO" comment)
│       │
│       ├── mobile_customer/          ← Flutter customer app
│       │   ├── lib/features/         ← 15 feature domains
│       │   └── lib/router/app_router.dart
│       │
│       └── packages/core/            ← shared Flutter package
│           ├── lib/src/l10n/arb/     ← app_ar.arb + app_en.arb
│           ├── lib/src/utils/        ← formatters, guards, Result<T>
│           └── lib/src/widgets/      ← design system
│
├── .github/workflows/
│   ├── ci.yml                        ← 8 path-filtered jobs
│   └── db-backup.yml
└── docker-compose.yml                ← infra/full profiles
```

---

## 4. Feature Inventory

| Feature | Web Admin | Web Public | Staff Mobile | Customer Mobile | Backend | Status |
|---|---|---|---|---|---|---|
| Customer Registration | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Email/Password Login | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| OTP Phone Login | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Forgot / Reset Password | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Token Refresh | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Email Verification | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Property Browse (Projects) | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Property Search / Filters | ✅ | ✅ | ⚠️ limited | ⚠️ limited | ✅ | **Partial** |
| Unit Detail | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Favorites | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Project Media / Gallery | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Visit Request (customer) | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Visit Appointments (staff) | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Visit Reschedule | ✅ | n/a | ✅ | ✅ | ✅ | **Complete** |
| Visit Reassign | ✅ | n/a | ✅ (admin) | n/a | ✅ | **Complete** |
| Sales Feedback on Visit | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Leads / CRM | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Lead Pipeline Kanban | ✅ | n/a | ⚠️ list only | n/a | ✅ | **Partial** |
| Lead Create | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Lead Notes / Activity | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Reservations | ✅ | n/a | ✅ | ⚠️ view | ✅ | **Complete** |
| Contracts Upload / Manage | ✅ | n/a | ✅ view | ✅ view+dl | ✅ | **Complete** |
| Installment Plans (Admin) | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Installment Calculator | ✅ | n/a | ✅ | ✅ | ✅ | **Complete** |
| Installments (customer view) | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Installment Proof Submission | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Deposits Review (staff) | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Deposits View (customer) | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Payment Proof Upload | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Maintenance Requests | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Maintenance Confirm (customer) | n/a | ❌ | n/a | ✅ | ✅ | **Web Missing** |
| Maintenance Complaint (customer) | n/a | ❌ | n/a | ✅ | ✅ | **Web Missing** |
| Maintenance Warranty | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Maintenance Signed Photos | ✅ | n/a | ✅ | ✅ | ✅ | **Complete** |
| Documents (upload/download) | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Notifications In-App | ✅ | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Push Notifications | n/a | n/a | ✅ code | ✅ code | ✅ | **Needs Firebase assets** |
| Email Notifications (auth) | ✅ | ✅ | n/a | n/a | ✅ | **Complete** |
| Email Notifications (domain events) | ❌ | ❌ | n/a | n/a | ❌ | **Not Implemented** |
| Bonus / Commission | ✅ | n/a | ✅ view | n/a | ✅ | **Complete** |
| Sales Targets | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| Reports / KPIs | ✅ | n/a | ✅ | n/a | ✅ ⚠️ | **Complete (MT Bug)** |
| Broker Portal | ✅ | n/a | ✅ | n/a | ✅ | **Complete** |
| CMS Pages / Banners | ✅ | ✅ | n/a | n/a | ✅ | **Complete** |
| CMS Articles (RTE) | ⚠️ read-only | ✅ | n/a | n/a | ✅ | **Partial** |
| Admin Users Mgmt | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Permissions UI | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Settings | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Audit Logs | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Chat / Support | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Info Requests | n/a | ✅ | n/a | ✅ | ✅ | **Complete** |
| Super Admin | ✅ | n/a | n/a | n/a | ✅ | **Complete** |
| Inventory Matrix | ✅ ⚠️ | n/a | n/a | n/a | ✅ | **Partial (client-side)** |

---

## 5. Roles Inventory

7 roles موجودة فعليًا في `UserRole` enum:

| Role | وصف | منصة الوصول |
|---|---|---|
| `SUPER_ADMIN` | يدير المنصة بأكملها — شركات، خطط اشتراك | Web Admin (/super-admin) |
| `ADMIN` | يدير شركته: users, leads, reservations, reports | Web Admin + Mobile Staff |
| `SALES_MANAGER` | مشرف مبيعات، يعتمد الودائع | Web Admin + Mobile Staff |
| `SALES` | موظف مبيعات | Web Admin + Mobile Staff |
| `MAINTENANCE_SUPERVISOR` | مشرف صيانة | Web Admin + Mobile Staff |
| `BROKER` | وسيط عقاري خارجي | Web Admin + Mobile Staff (broker shell) |
| `CLIENT` | عميل يتصفح (لم يشترِ بعد) | Web Public + Mobile Customer |
| `CUSTOMER` | عميل لديه عقد/وحدة مسجلة | Web Public + Mobile Customer |

**Auth Layers:**
- `@Roles(...)` — coarse role gate (OR semantics)
- `@Permissions(...)` — fine-grained permission code (OR semantics, ADMIN bypass)
- `@PermissionsStrict(...)` — two-person rule (AND semantics, NO bypass, even ADMIN must hold code explicitly)

---

## 6. Role × Feature Matrix

| Feature | SUPER_ADMIN | ADMIN | SALES_MGR | SALES | MAINT_SUP | BROKER | CLIENT | CUSTOMER |
|---|---|---|---|---|---|---|---|---|
| Company mgmt | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users CRUD | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Permissions assign | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Projects CRUD | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Units CRUD | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Browse catalog | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leads CRUD | n/a | ✅ | ✅ | ✅ | ❌ | ✅ broker | ❌ | ❌ |
| Visits manage | n/a | ✅ | ✅ | ✅ | ❌ | ⚠️ limited | ⚠️ request | ⚠️ request |
| Reservations approve | n/a | 🔒 strict | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reservations create | n/a | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Contracts upload | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contracts view | n/a | ✅ | ✅ | ✅ | ❌ | ⚠️ broker | ✅ own | ✅ own |
| Deposits review queue | n/a | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deposits approve | n/a | 🔒 strict | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deposits view | n/a | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ own | ✅ own |
| Installments manage | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Installment calculator | n/a | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Maintenance request | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Maintenance assign/resolve | n/a | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bonus manage | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bonus view (own) | n/a | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Reports | n/a | ✅ | ⚠️ limited | ❌ | ❌ | ✅ own | ❌ | ❌ |
| CMS edit | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settings | n/a | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Notifications | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chat/Support | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Favorites | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

🔒 = `@PermissionsStrict` — must hold explicit permission code, no bypass

---

## 7. Staff Deep Audit

### 7A — Staff Web (web-admin)

| Section | Pages | Status |
|---|---|---|
| Leads / CRM | list, detail, kanban, notes, sources | ✅ Complete |
| Clients | list, detail, documents, activity | ✅ Complete |
| Reservations | list, detail, approve/reject, notes | ✅ Complete |
| Contracts | list, detail, upload, sign | ✅ Complete |
| Deposits | list, detail, review-queue, approve/reject, receipt | ✅ Complete |
| Payments | payment-proof flow | ✅ Complete |
| Maintenance | list, detail, assign, categories, SLA | ✅ Complete |
| Visits | list, detail, schedule, assign, feedback | ✅ Complete |
| Projects / Units | CRUD, media, pricing, phases/buildings | ✅ Complete |
| Inventory | matrix view | ⚠️ Client-side only (TODO >1000 units) |
| Installments | templates, durations, calculator | ✅ Complete |
| Bonus / Targets | rules, entries, approval, targets | ✅ Complete |
| Notifications | inbox, templates | ✅ Complete |
| Reports | KPIs, sales, financial, CSV export | ✅ Complete (⚠️ MT SQL bug) |
| Permissions | user-permission assign | ✅ Complete |
| Settings | key-value editor | ✅ Complete |
| Audit Logs | filtered view | ✅ Complete |
| CMS | pages, banners, articles (read-only) | ⚠️ Articles no RTE |
| Brokers | full broker portal management | ✅ Complete |
| Super Admin | companies, packages, subscriptions | ✅ Complete |

### 7B — Staff Mobile

**42 Screens | 45 Cubits | 58 Backend Endpoints Called**

Every screen uses `DataStatus` state machine (initial/loading/success/empty/failure) with `ErrorState(onRetry)` widget.

| Feature | Backend API | Web | Screen | API Call | Actions | Pagination | Status |
|---|---|---|---|---|---|---|---|
| Login | ✅ | ✅ | `staff_login_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Forgot Password | ✅ | ✅ | `forgot_staff_password_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Dashboard KPIs | ✅ | ✅ | `dashboard_screen` | ✅ | view | n/a | ✅ Ready |
| Leads List | ✅ | ✅ | `leads_screen` | ✅ | ✅ | ✅ infinite | ✅ Ready |
| Lead Detail | ✅ | ✅ | `lead_detail_screen` | ✅ | stage/note | n/a | ✅ Ready |
| Create Lead | ✅ | ✅ | `create_lead_screen` | ✅ | form+validate | n/a | ✅ Ready |
| Visits List | ✅ | ✅ | `visits_screen` | ✅ | ✅ | ✅ infinite | ✅ Ready |
| Visit Detail | ✅ | ✅ | `visit_detail_screen` | ✅ | confirm/complete/cancel/no-show | n/a | ✅ Ready |
| Reschedule Visit | ✅ | ✅ | in detail screen | ✅ | date+time picker | n/a | ✅ Ready |
| Reassign Visit | ✅ | ✅ | in detail screen | ✅ | dialog (admin) | n/a | ✅ Ready |
| Sales Feedback | ✅ | ✅ | in detail screen | ✅ | rating+notes | n/a | ✅ Ready |
| Create Visit | ✅ | ✅ | `create_visit_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Reservations List | ✅ | ✅ | `reservations_screen` | ✅ | ✅ | ✅ | ✅ Ready |
| Reservation Detail | ✅ | ✅ | `reservation_detail_screen` | ✅ | note/status | n/a | ✅ Ready |
| Create Reservation | ✅ | ✅ | `create_reservation_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Contracts List | ✅ | ✅ | `contracts_screen` | ✅ | view | ✅ | ✅ Ready |
| Contract Detail | ✅ | ✅ | `contract_detail_screen` | ✅ | view | n/a | ✅ Ready |
| Deposits List | ✅ | ✅ | `deposits_screen` | ✅ | ✅ | ✅ | ✅ Ready |
| Deposit Review | ✅ | ✅ | `payments_review_screen` | ✅ | approve/reject | ✅ | ✅ Ready |
| Record Payment | ✅ | ✅ | `record_payment_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Installment Calculator | ✅ | ✅ | `calculator_screen` | ✅ | ✅ | n/a | ✅ Ready |
| Plan Templates | ✅ | ✅ | `plan_templates_screen` | ✅ | view | n/a | ✅ Ready |
| Maintenance List | ✅ | ✅ | `maintenance_screen` | ✅ | ✅ | ✅ | ✅ Ready |
| Maintenance Detail | ✅ | ✅ | `maintenance_detail_screen` | ✅ | status + signed docs | n/a | ✅ Ready |
| Projects Catalog | ✅ | n/a | `projects_screen` | ✅ | view | ✅ | ✅ Ready |
| Project Detail | ✅ | n/a | `project_detail_screen` | ✅ | view | n/a | ✅ Ready |
| Units List | ✅ | n/a | `units_screen` | ✅ | view | n/a | ⚠️ Filters client-side |
| Targets / Performance | ✅ | ✅ | `targets_screen` | ✅ | view | n/a | ✅ Ready |
| Bonus List | ✅ | ✅ | `bonus_screen` | ✅ | view | n/a | ✅ Ready |
| Notifications | ✅ | ✅ | `notifications_screen` | ✅ | read/read-all | ✅ | ✅ Ready |
| Broker Dashboard | ✅ | ✅ | `broker_dashboard_screen` | ✅ | view | n/a | ✅ Ready |
| Broker Leads | ✅ | ✅ | `broker_leads_screen` | ✅ | create/view | ✅ | ✅ Ready |
| Broker Reservations | ✅ | ✅ | `broker_reservations_screen` | ✅ | create/view | ✅ | ✅ Ready |
| Broker Commissions | ✅ | ✅ | `broker_commissions_screen` | ✅ | view | n/a | ✅ Ready |
| Broker Catalog | ✅ | ✅ | `broker_catalog_screen` | ✅ | view | n/a | ✅ Ready |
| Broker Profile | ✅ | ✅ | `broker_profile_screen` | ✅ | view | n/a | ✅ Ready |
| Profile | ✅ | ✅ | `profile_screen` | ✅ | view/edit | n/a | ✅ Ready |
| Push Registration | ✅ | n/a | main.dart FCM | ✅ | register | n/a | ⚠️ Needs Firebase assets |

---

## 8. Staff Mobile Completeness

**Ready for Testing: 36/37 features**

**Missing**: لا يوجد missing features جوهرية.

**Partial (1)**: Push notifications — code complete، يحتاج `google-services.json` + `GoogleService-Info.plist` في release builds.

**Stale Comment**: `firebase_options.dart` header يقول "TODO replace stub" لكن الملف يحتوي على Firebase credentials حقيقية — التعليق مضلل وليس خللًا.

---

## 9. Web vs Mobile Feature Parity

| Feature | Staff Web | Staff Mobile | Customer Web | Customer Mobile | Gap | Severity |
|---|---|---|---|---|---|---|
| Lead Kanban Pipeline | ✅ drag-drop | ⚠️ list only | n/a | n/a | No kanban on mobile | Low |
| CMS Article Edit/RTE | ⚠️ basic | n/a | n/a | n/a | No RTE on web | Medium |
| Inventory Server Pagination | ⚠️ client-side | n/a | n/a | n/a | Known TODO | Medium |
| Reports PDF/Excel Export | ⚠️ CSV only | n/a | n/a | n/a | No PDF/Excel | Low |
| Push Notifications | n/a | ✅ code | n/a | ✅ code | Needs Firebase assets | Medium |
| Email on Domain Events | ❌ | n/a | ❌ | n/a | Not implemented | Medium |
| Audit Logs Screen | ✅ | ❌ | n/a | n/a | Admin-only; acceptable | Low |
| Units API Filters | ✅ | ⚠️ client-side | ✅ | ⚠️ client-side | Filters not sent to API | Medium |
| Maintenance Confirm/Complaint | n/a | n/a | ❌ | ✅ | Web-public portal gap | Low |
| Customer Project Sort | ✅ | ⚠️ | ✅ | ⚠️ | Sort less rich on mobile | Low |

---

## 10. Mobile App Audit

### Authentication

| Check | Staff Mobile | Customer Mobile |
|---|---|---|
| Login | ✅ | ✅ email + OTP |
| Logout | ✅ | ✅ |
| Token refresh | ✅ Dio interceptor | ✅ Dio interceptor |
| Session persistence | ✅ FlutterSecureStorage | ✅ FlutterSecureStorage |
| Forgot password | ✅ | ✅ |
| Reset password | ✅ | ✅ |
| OTP flow | n/a | ✅ 6-digit, timed |
| Unauthorized handling | ✅ → /login | ✅ → /login |

### Data Patterns

- Loading/error/empty states: ✅ in ALL screens
- Retry on error: ✅ `ErrorState(onRetry:)` universal
- Pagination: ✅ `Paginated<T>` + `loadMore()` on scroll
- Pull-to-refresh: ✅ `RefreshIndicator` on list screens
- Offline: ❌ No caching — acceptable for real estate live-data app

### Forms

- Client-side validation: ✅ before API call
- Server error handling: ✅ `showFailureSnackBar(context, failure)` universal
- Date/time inputs: ✅ `showDatePicker` / `showTimePicker`
- File upload: ✅ presign → PUT pattern

---

## 11. Backend / API Audit

**39 modules | 358 routes | `/v1` global prefix | Swagger at `/docs`**

### Guard Chain
```
ThrottlerGuard (100/60s global · 3–5/60s on auth routes)
  → JwtAuthGuard (re-validates user from DB per request · @Public bypass)
    → RolesGuard (@Roles OR-semantics)
      → PermissionsGuard (@Permissions OR + ADMIN-bypass)
                         (@PermissionsStrict AND + NO bypass)
```

### Issues Found

| ID | Issue | Severity | File |
|---|---|---|---|
| A-01 | Reports raw SQL not MT-scoped | **HIGH** | `modules/reports/reports.module.ts` |
| A-02 | `me/documents/all` take:200 hardcoded | LOW | `modules/documents/` |
| A-03 | Inventory loads all units client-side | MEDIUM | (web-admin, not API) |
| A-04 | Email not triggered on domain events | MEDIUM | `modules/notifications/` |
| A-05 | No API versioning strategy | LOW | docs gap |

### API Consumer Map

| Consumer | Endpoint Type |
|---|---|
| Mobile customer only | `/v1/chat/*` |
| Web admin only | `/v1/audit`, `/v1/super-admin/*` |
| Both mobile staff + web admin | `/v1/broker-portal/*` |
| All consumers | Auth, projects, units, leads, visits, reservations, contracts, deposits, maintenance, notifications, documents |

---

## 12. Database Audit

**61 models | 51 enums | 19 migrations (latest: 2026-08-18)**

### Multi-tenant Coverage

~50 models auto-scoped via Prisma middleware on `companyId`. `Setting` uses compound PK `[companyId, key]`. **Exception: raw SQL in reports bypasses middleware entirely.**

### Issues

| ID | Issue | Risk |
|---|---|---|
| DB-01 | Soft-delete inconsistent — `Document` has `deletedAt`, others use `active` boolean, some have neither | Medium |
| DB-02 | `BonusEntry.commissionAmount` no DB-level `CHECK > 0` | Low |
| DB-03 | `VisitAppointment` no CASCADE from `VisitRequest` — orphan risk if request deleted | Low |
| DB-04 | No DB-level `CHECK` on commission rate 0–100 | Low |
| DB-05 | `ChatSession`/`ChatMessage` no index on `sessionId` beyond FK | Low |
| DB-06 | `PlanTemplateScheduleItem` usage unclear — may be dead migration | Cannot Verify |

---

## 13. Business Flows

### Flow A: Customer → Lead → Visit → Reservation → Contract → CUSTOMER

```
[Customer] Request Visit (web-public or mobile)
  → POST /v1/requests/visit (@OptionalAuth)
  → VisitRequest created
  → Notification to SALES

[SALES] Creates appointment
  → POST /v1/visits/appointments
  → Notification to customer

[Customer] Confirms/reschedules
  → PATCH /v1/me/visit-requests/:id/confirm or /request-reschedule

[SALES] Completes visit + feedback
  → POST .../complete + .../sales-feedback

[SALES] Creates reservation
  → POST /v1/reservations (unit + customer + plan + amounts)

[ADMIN] Approves (@PermissionsStrict)
  → POST /v1/reservations/:id/approve

[ADMIN] Uploads contract
  → POST /v1/contracts + document link
  → Customer role promoted → CUSTOMER

[CUSTOMER] Downloads contract
  → GET /v1/contracts/me/contracts + /me/documents/:id/download (signed URL)
```

**Failure point**: If FCM not configured, customer never notified of appointment.

### Flow B: Payment Proof → Review → Approve

```
[CUSTOMER] GET /v1/me/installments (schedule)
  → POST /v1/me/payments/presign → PUT to R2
  → POST /v1/me/deposits (link to installment)

[SALES_MANAGER] GET /v1/deposits/review-queue
  → Review metadata (no file download — by design)

[ADMIN] PATCH /v1/deposits/:id/verify (@PermissionsStrict)
  → Status → VERIFIED
```

### Flow C: Maintenance Request → Resolve → Confirm

```
[CUSTOMER] POST /v1/me/maintenance-requests
[SUPERVISOR] GET /v1/me/maintenance-requests (scoped)
  → GET /v1/me/maintenance-requests/:id (includes signed doc URLs)
  → PATCH .../status
[CUSTOMER] POST /v1/me/maintenance-requests/:id/confirm-resolution
```

### Flow D: Broker Lead → Commission → Payout

```
[BROKER] POST /v1/broker-leads → [ADMIN] approve (@PermissionsStrict)
  → POST /v1/broker-reservations
  → Contract signed → BonusEntry + BrokerCommission auto-created
  → [ADMIN] approve commission (@PermissionsStrict)
  → Payout flow
```

---

## 14. Performance Audit

| ID | Issue | Area | Severity |
|---|---|---|---|
| P-01 | Reports raw SQL — no LIMIT on aggregate joins | Backend | HIGH |
| P-02 | Inventory matrix client-side — all units in memory | Web Admin | MEDIUM |
| P-03 | `me/documents/all` take:200 — arbitrary cap | Backend | LOW |
| P-04 | Mobile image loading — no `cached_network_image` | Mobile | LOW |
| P-05 | Document presigning — separate S3 call per doc | Backend | LOW |
| P-06 | Mobile units filters client-side on loaded page | Mobile | MEDIUM |

---

## 15. Security Audit

| ID | Finding | Severity | Detail |
|---|---|---|---|
| SEC-01 | **Reports raw SQL cross-tenant leak** | **CRITICAL** | `$queryRawUnsafe` in `reports.module.ts` — 0 `companyId` bindings. Aggregates span ALL companies. |
| SEC-02 | Raw SQL injection (mitigated) | LOW | Sanitized via regex allowlists. Parameterized queries (`Prisma.sql`) would be safer. |
| SEC-03 | Firebase client keys committed | INFO | `firebase_options.dart`. Client keys are public by design but note for repo hygiene. |
| SEC-04 | Seed no prod guard | MEDIUM | `prisma/seed.ts` has no `NODE_ENV` block. |
| SEC-05 | No AV scan on uploads | LOW | MIME allowlist + size cap exist. No antivirus. Acceptable for current scale. |
| SEC-06 | SVG excluded from uploads | ✅ POSITIVE | Prevents stored XSS via SVG. |
| SEC-07 | Anti-enumeration on auth | ✅ POSITIVE | Identical responses on forgot-password/verify-email regardless of email existence. |
| SEC-08 | @PermissionsStrict on sensitive ops | ✅ POSITIVE | Two-person rule enforced at code level for approve/verify/sign/pay. |
| SEC-09 | IDOR protection via OwnershipService | ✅ POSITIVE | `NotFoundException` (not 403) on cross-user access — prevents existence probing. |
| SEC-10 | FlutterSecureStorage on mobile | ✅ POSITIVE | Keychain/Keystore — not SharedPreferences. |
| SEC-11 | httpOnly cookies on web | ✅ POSITIVE | No localStorage tokens. |
| SEC-12 | Subscription blocking on login | ✅ POSITIVE | SUSPENDED/CANCELLED/EXPIRED companies cannot authenticate. |
| SEC-13 | Prod env.validation.ts fail-fast | ✅ POSITIVE | App refuses to start with weak config (JWT ≥32 chars, distinct secrets, bucket isolation, etc.). |

---

## 16. Error Handling Audit

| Layer | Pattern | Status |
|---|---|---|
| Backend validation | `ValidationPipe(whitelist+forbidNonWhitelisted)` globally | ✅ |
| Backend auth | `401` + `WWW-Authenticate: Bearer` | ✅ |
| Backend RBAC | `403` + `missing_permission` code | ✅ |
| Backend not found | `NotFoundException` → `404` | ✅ |
| Backend 500 | Global exception filter; structured JSON | ✅ |
| Web Admin | `api.ts` parses `missing_permission` → Arabic message | ✅ |
| Web Admin 401 | Auto-refresh → re-login if refresh fails | ✅ |
| Mobile API errors | `guardApiCall<T>` → `AppFailure(type:)` | ✅ |
| Mobile 401 | `AuthInterceptor` → refresh → retry once → logout | ✅ |
| Mobile empty states | `ErrorState(failure, onRetry)` universal | ✅ |
| Mobile offline | `FailureType.network` → user message shown | ✅ |

---

## 17. Notifications Audit

**Complete flow:**

```
Domain Event
  → NotificationsService.sendToUsers(userIds, templateCode, vars)
    → Template fetched + {{var}} interpolation
    → Notification record created per recipient
    → PushService.sendToUser → FCM sendEachForMulticast
    → Dead token pruning on UNREGISTERED response
  → [Cron] appointment-reminder.cron.ts → 24h-before push
```

| Channel | Status | Detail |
|---|---|---|
| In-App | ✅ Complete | `GET /me/notifications`, read/read-all, unread-count |
| Push (FCM) | ✅ Code complete | Needs `google-services.json` / `GoogleService-Info.plist` |
| Email (auth) | ✅ Complete | Reset/verify emails via nodemailer |
| Email (domain events) | ❌ Not implemented | Reservation/contract/deposit updates NOT emailed |
| SMS | ✅ OTP only | Twilio in prod |

**Mobile tap → navigation**: `FirebaseMessaging.onMessageOpenedApp` routes to correct screen based on `data.type` payload. ✅

---

## 18. Search / Filters / Pagination Audit

| List | Backend | Web | Mobile | Sort | Pagination | Status |
|---|---|---|---|---|---|---|
| Projects | q, status, featured, type, phaseId | ✅ | ✅ q+city | ❌ | ✅ | ⚠️ No sort |
| Units | type, beds, baths, price, status, city | ✅ | ✅ | ⚠️ client-side | ✅ | ⚠️ Mobile filters not API |
| Leads | q, status, source, assignedTo, date | ✅ | ✅ | ❌ | ✅ infinite | ⚠️ |
| Visits | status, leadId, today | ✅ | ✅ | ✅ | ✅ infinite | ✅ |
| Reservations | status, projectId, unitId, date | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deposits | status, type, date | ✅ | ✅ | ✅ | ✅ | ✅ |
| Maintenance | status, categoryId, priority | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications | read/unread | ✅ | ✅ | n/a | ✅ | ✅ |

---

## 19. File & Image Upload Audit

| Feature | Presign | Type Check | Size Limit | Mobile | Status |
|---|---|---|---|---|---|
| Project/Unit images | ✅ private PUT | JPEG/PNG/WEBP/MP4 | 50 MiB | n/a (admin) | ✅ |
| Banners | ✅ | same | 50 MiB | n/a | ✅ |
| User avatar | ✅ | JPEG/PNG | 50 MiB | ✅ | ✅ |
| Contract PDF | ✅ private | PDF | 50 MiB | n/a | ✅ |
| Deposit receipt | ✅ private | JPEG/PNG/PDF | 50 MiB | ✅ | ✅ |
| Payment proof | ✅ `/me/payments/presign` | JPEG/PNG/PDF | 50 MiB | ✅ | ✅ |
| Maintenance docs | ✅ private + signed GET | JPEG/PNG/PDF | 50 MiB | ✅ | ✅ |
| Documents | ✅ private | JPEG/PNG/PDF | 50 MiB | ✅ | ✅ |

**Security**: SVG excluded. Double-checked at service layer. Private bucket enforced. Signed GETs expire 1h (maintenance) / 5m (documents).

---

## 20. Code Quality & Architecture

### Strengths
- Consistent NestJS module pattern; global pipes/guards/interceptors
- Flutter Clean Architecture strictly followed (data/domain/presentation)
- `Result<T>` sealed class throughout mobile — eliminates null-pointer risks
- `guardApiCall<T>` uniform error wrapping in all repository impls
- `@PermissionsStrict` elegant for two-person business rules
- Argon2 throughout (not bcrypt, not MD5)
- **Near-zero TODO/FIXME** in actual implementation code

### Issues

| ID | Issue | Type | Severity |
|---|---|---|---|
| CQ-01 | `reports.module.ts` 2,458 lines | God file | Medium |
| CQ-02 | `maintenance.module.ts` ~1,900 lines | God file | Low |
| CQ-03 | `deposits.module.ts` ~1,250 lines | God file | Low |
| CQ-04 | Stale "TODO replace stub" in `firebase_options.dart` | Misleading comment | Low |
| CQ-05 | `PlanTemplateScheduleItem` model unused in active code path | Dead code? | Low |
| CQ-06 | `me/documents/all` hardcoded `take: 200` | Magic number | Low |
| CQ-07 | Mobile units filters client-side | Design limitation | Medium |

---

## 21. Existing Tests

| Category | Count | Quality |
|---|---|---|
| Backend Unit (`*.spec.ts`) | 99 files | Good — critical paths covered |
| Backend E2E (real Postgres) | 46 files | Strong — includes MT isolation (ISO-5..ISO-15), ownership, strict-permissions |
| Staff Mobile Dart | 19 files | Good — cubit state machines, use cases |
| Customer Mobile Dart | 17 files | Good — catalog, auth, deposits, maintenance |
| Core Package Dart | 7 files | Good — utilities, formatters |
| Web Admin Playwright | 8+ specs | Smoke level |
| Web Public Playwright | Smoke | Smoke level |

### CI Jobs (path-filtered)
```
lint-typecheck-build  → always
migration-integrity   → always
schema-drift-check    → always (fails on drift)
api-unit              → on apps/api/**
api-e2e               → on apps/api/** (real ephemeral PG)
mobile-static         → on apps/mobile/** (analyze + test)
web-admin-e2e         → on apps/web-admin/**
web-public-e2e        → on apps/web-public/**
```

### Missing Coverage
- Reports cross-tenant isolation test
- Email delivery integration test
- Push delivery (FCM) integration test
- Mobile upload end-to-end (presign → PUT → attach)
- Broker commission full flow e2e
- `@PermissionsStrict` two-person flows comprehensive e2e
- Inventory matrix with >1000 units (performance test)

---

## 22. Incomplete / Suspicious Features

| ID | Feature | File / Location | Issue | Type |
|---|---|---|---|---|
| INC-01 | Reports cross-tenant SQL | `reports.module.ts` | `$queryRawUnsafe` without `companyId` | Security Bug |
| INC-02 | CMS Article editor | `web-admin/dashboard/cms/articles/` | No RTE, no image upload | Partial |
| INC-03 | Inventory server pagination | `web-admin/dashboard/inventory/page.tsx:41` | Self-flagged TODO | Known Gap |
| INC-04 | Email on domain events | `modules/notifications/` | Nodemailer exists, not called from domain events | Partial |
| INC-05 | `PlanTemplateScheduleItem` | `schema.prisma` | Model exists; no active consumer confirmed | Cannot Verify |
| INC-06 | `firebase_options.dart` stale comment | Both mobile apps | "TODO replace stub" header on file with real config | Misleading |
| INC-07 | Seed production guard | `prisma/seed.ts` | No `NODE_ENV` block | Missing Guard |
| INC-08 | Mobile units filter via API | `units_screen.dart` | Client-side on loaded page | Design Limitation |
| INC-09 | Customer maintenance complaint (web-public) | `web-public/account/` | Mobile has it, web-public missing | Web Gap |
| INC-10 | Customer maintenance confirm-resolution (web-public) | same | Mobile has it, web-public missing | Web Gap |

---

## 23. Configuration & Environment

### Required for Production (api)

```
DATABASE_URL, REDIS_URL
JWT_ACCESS_SECRET (≥32 chars), JWT_REFRESH_SECRET (≥32, different from access)
JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES
CORS_ORIGINS
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET (must differ)
R2_PUBLIC_URL, R2_PRIVATE_ENDPOINT
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
OTP_PROVIDER=twilio (prod), TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
DEFAULT_COMPANY_ID (must match real Company.id in DB)
SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (≥12 chars, ≠ 'changeme')
LOG_LEVEL, LOG_FORMAT, NODE_ENV=production
```

### Deployment Gaps

| Item | Status |
|---|---|
| `api` Dockerfile | ✅ |
| `web-admin` Dockerfile | ✅ |
| `web-public` Dockerfile | ❌ Missing |
| Mobile Firebase assets (`google-services.json`, `GoogleService-Info.plist`) | ❌ Not in repo (correct) — needs CI secrets |
| CD pipeline (auto deploy) | ❌ Manual only |

---

## 24. Observability

| Component | Status | Detail |
|---|---|---|
| Structured JSON logging | ✅ | `RequestLogger` on every request |
| Sentry crash reporting | ✅ optional | `SENTRY_DSN` env; NestJS integration |
| Audit logs | ✅ | `AuditLog` table + `AuditInterceptor` |
| Health endpoint | ✅ | `/health` — DB + Redis ping |
| APM / Metrics | ❌ | No Prometheus/Datadog/OpenTelemetry |
| Alerting | ❌ | No alert rules |
| Mobile crash reporting | Cannot Verify | FCM configured; Crashlytics separate — not confirmed |
| Mobile performance monitoring | ❌ | Not confirmed |

---

## 25. Critical Issues — P0/P1/P2/P3

### P0 — Blocker

#### P0-001 — Reports Cross-Tenant Data Leak
- **Severity**: CRITICAL
- **Feature**: Reports, Dashboard KPIs
- **Platform**: Backend / Web Admin / Staff Mobile (dashboard)
- **Problem**: `$queryRawUnsafe()` in `reports.module.ts` builds raw PostgreSQL without `companyId`. In multi-company deployment, ADMIN of Company A sees Company B data in reports.
- **Evidence**: `grep "companyId" apps/api/src/modules/reports/reports.module.ts` → 0 results. Affected functions: `getByProject()`, `getBrokerLeaderboard()`, `getSalesTrend()`, `getTopPerformers()`
- **File**: `apps/api/src/modules/reports/reports.module.ts`
- **Fix**: Replace `$queryRawUnsafe` with `Prisma.sql` tagged templates; inject `companyId` from `TenantContextService.getRequiredCompanyId()`

---

### P1 — Critical

#### P1-001 — Email Notifications Not Triggered on Domain Events
- **Feature**: Notifications
- **Problem**: `EmailService` (nodemailer/SMTP) works for auth emails but `NotificationsService.sendToUsers()` sends only in-app + FCM push. Domain events (reservation approved, contract uploaded, deposit verified, maintenance resolved) never email the customer.
- **File**: `apps/api/src/modules/notifications/`
- **Fix**: Add email channel to `sendToUsers()` or per-template channel config

#### P1-002 — Seed Has No Production Guard
- **Problem**: `pnpm prisma:seed` will execute on production DB if run accidentally.
- **File**: `apps/api/prisma/seed.ts`
- **Fix**: Add `if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SEED_IN_PROD) { process.exit(1) }` at top

#### P1-003 — Firebase Assets Missing for Mobile Production Builds
- **Problem**: Push notifications non-functional without `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in platform directories.
- **Fix**: Add to CI as secrets; inject during `flutter build` step in CD pipeline

#### P1-004 — No CD Pipeline
- **Problem**: All deployments to Railway/Vercel are manual. `web-public` has no Dockerfile or Vercel config committed.
- **Fix**: GitHub Actions CD workflow; add `web-public` Dockerfile or Vercel config

---

### P2 — Important

#### P2-001 — Raw SQL Uses `$queryRawUnsafe` Pattern
- `$queryRawUnsafe` is inherently dangerous. Current sanitization is correct but future modifications may introduce regressions.
- **Fix**: Migrate to `$queryRaw` with `Prisma.sql` tagged templates

#### P2-002 — Inventory Matrix No Server Pagination
- **File**: `apps/web-admin/src/app/dashboard/inventory/page.tsx:41`
- **Fix**: Dedicated inventory-matrix API endpoint with server-side pagination

#### P2-003 — Mobile Units Filters Not API-Backed
- **File**: `apps/mobile/mobile_customer/lib/features/catalog/presentation/units/`
- **Fix**: Send active filters as query parameters in units API call

#### P2-004 — CMS Article Editor: No RTE / Image Upload
- **File**: `apps/web-admin/src/app/dashboard/cms/articles/`
- **Fix**: Add TipTap/Slate RTE + presigned image upload to article form

#### P2-005 — Customer Maintenance Actions Missing from Web-Public Portal
- Confirm-resolution and complaint actions exist in mobile customer but not in `web-public/account/maintenance/`
- **Fix**: Add these actions to web-public maintenance detail page

#### P2-006 — No APM / Alerting
- **Fix**: Add Prometheus + Grafana or Datadog; define SLOs + alert rules for error rate / latency / health

---

### P3 — Improvement

| ID | Issue | Fix |
|---|---|---|
| P3-001 | God files: `reports.module.ts` (2458 lines), `maintenance.module.ts`, `deposits.module.ts` | Extract to separate service/controller/dto files |
| P3-002 | Reports CSV only — no PDF/Excel | Add PDF/Excel export using pdfmake or exceljs |
| P3-003 | No mobile crash reporting (Crashlytics) confirmed | Enable Firebase Crashlytics in both mobile apps |
| P3-004 | Lead list mobile: no advanced filters (source, assignedTo, dateRange) | Add filter sheet with API-backed params |
| P3-005 | `PlanTemplateScheduleItem` model may be dead code | Verify usage; remove migration artifact if unused |
| P3-006 | No hreflang for future English locale | Add when EN launched |
| P3-007 | No API versioning strategy documented | Define before mobile GA |

---

## 26. Platform Completeness Scores

| Component | Score | Main Reason for Deduction |
|---|---|---|
| **Backend API** | **84/100** | P0 reports SQL leak (−10), email domain events gap (−3), seed guard (−2), no versioning (−1) |
| **Web Admin** | **90/100** | CMS RTE missing (−4), inventory perf (−3), no PDF export (−2), not all forms have Zod (−1) |
| **Web Public** | **82/100** | Maintenance actions gap (−5), no Dockerfile (−4), push exposure (−3), CMS not fully wired (−3) |
| **Staff Mobile** | **88/100** | Push needs Firebase assets (−5), units filters client-side (−4), no kanban (−3) |
| **Customer Mobile** | **86/100** | Push needs Firebase assets (−5), units filters client-side (−5), no offline mode (−4) |
| **APIs** | **83/100** | Reports MT bug (−10), email domain events (−4), no versioning (−3) |
| **Database** | **87/100** | Inconsistent soft-delete (−5), no DB-level range constraints (−4), PlanTemplateScheduleItem (−4) |
| **Security** | **75/100** | P0 cross-tenant reports SQL leak (−20), seed no prod guard (−3), no AV scan (−2) |
| **Performance** | **78/100** | Reports raw SQL unbounded (−10), inventory client-side (−7), mobile image caching (−5) |
| **Testing Readiness** | **82/100** | No reports MT isolation test (−8), email/push integration missing (−6), mobile upload e2e (−4) |

### **Overall Platform Readiness: 83/100**

---

## 27. Testing Readiness

| Area | Status | Blocker |
|---|---|---|
| Functional Testing | ✅ Ready | — |
| Authentication Testing | ✅ Ready | — |
| Role / Permission Testing | ⚠️ Ready with blocker | Reports MT isolation must be verified/fixed |
| Staff Mobile Testing | ✅ Ready | 36/37 features ready |
| Customer Mobile Testing | ✅ Ready | Push E2E needs Firebase assets |
| API Testing | ⚠️ Ready with blocker | Fix P0-001 first |
| Database Testing | ✅ Ready | MT isolation tests exist |
| E2E Testing | ⚠️ Ready with blocker | web-public Dockerfile needed for CI E2E |
| Performance Testing | ⚠️ Ready with blocker | Fix reports + inventory first |
| Security Testing | ⚠️ Ready with blocker | P0-001 must be fixed first |

---

## 28. Recommended Testing Order

```
Phase 1 — Foundation (Fix P0/P1 first)
  → Fix P0-001 (reports cross-tenant SQL)
  → Fix P1-002 (seed production guard)
  → Deploy staging with real Firebase, R2, SMTP, Postgres

Phase 2 — Authentication
  → Staff login / logout / refresh / session persistence
  → Customer OTP flow / email login / register
  → Forgot / reset password (both apps)
  → Unauthorized redirect handling
  → Subscription status blocking

Phase 3 — RBAC & Permissions
  → Role-based navigation enforcement
  → @PermissionsStrict two-person flows (approve deposit, approve reservation, sign contract)
  → Cross-role IDOR attempts (customer accessing other customer's data)
  → Broker isolation from main staff data

Phase 4 — Core Business Flows (E2E)
  → Flow A: inquiry → lead → visit → reservation → contract → CUSTOMER promotion
  → Flow B: installment → payment proof → review → approve
  → Flow C: maintenance request → assign → resolve → customer confirm
  → Flow D: broker lead → approve → reservation → commission → payout

Phase 5 — Staff Mobile Parity
  → Every staff mobile screen vs web admin equivalent
  → All action buttons verified (not just UI)
  → Pagination + infinite scroll
  → Form validation + server error handling

Phase 6 — Customer Mobile
  → Catalog → favorites → visit booking
  → My Property financial hub
  → Contract / deposit / installment view
  → Maintenance flow end-to-end

Phase 7 — Notifications
  → In-app notification delivery + read state
  → Push notification on real device (iOS + Android)
  → Notification tap → correct screen navigation

Phase 8 — Multi-Tenant Isolation
  → Reports: Company A ADMIN cannot see Company B data (after P0 fix)
  → All filtered endpoints MT isolation
  → Extend existing ISO- e2e tests to cover reports

Phase 9 — Performance
  → Reports endpoint under load with large dataset
  → Inventory matrix with 500+ units
  → Mobile list scrolling 200+ items
  → File upload large PDFs

Phase 10 — Security
  → OWASP Top 10 scan
  → IDOR penetration on all /me/* and /:id endpoints
  → Upload bypass (MIME spoofing attempts)
  → Auth brute-force (verify throttling holds)
  → Session token security

Phase 11 — E2E Regression
  → Playwright full flow: web-admin + web-public
  → Mobile integration test suite
  → Confirm no regressions after P0/P1 fixes
```

---

## 29. Final Conclusion

المنصة في حالة **جيدة جدًا**. البنية التقنية محكمة، الكود نظيف، وغالبية الميزات مكتملة فعليًا — UI → Business Logic → API → Database مربوطة في كل مكان.

**الاكتشاف الأهم**: وحدة Reports تحتوي على ثغرة أمنية MT حقيقية (P0-001). هذه هي المشكلة الوحيدة التي تمنع النشر الآمن في بيئة متعددة الشركات.

**ما كان يُعتقد أنه ناقص وهو مكتمل:**
- FCM/Push مكتمل بالكامل (ليس stub)
- Staff Mobile 36/37 feature جاهزة
- Customer Mobile 33 شاشة مكتملة

**أولويات ما قبل Testing:**
1. إصلاح P0-001 (reports raw SQL cross-tenant leak)
2. إضافة seed production guard
3. Deploy staging environment حقيقي
4. Firebase assets للـ mobile release builds
5. كتابة test للـ reports MT isolation
