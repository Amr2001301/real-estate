# Gap Analysis — Full Platform Scope vs Current Implementation

> **Date:** 2026-05-25 · **Method:** evidence-based, read-only audit · **Scope PDF:** not found at expected paths; scope taken from task prompt + attached document.
> **Risk:** Critical / High / Medium / Low · **Priority:** P0 (blocker) / P1 (must-have) / P2 (should-have) / P3 (nice-to-have)
>
> "Current Implementation" reflects what the **code actually proves**, not what the README claims.

---

## A. Public Website

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Featured projects, quick search, banners/offers, CTA | Real SSR/ISR home; featured projects+units; search panel; some hardcoded marketing sections (categories, why-us, how-we-help) | Marketing sections static (acceptable); banners not CMS-driven on public | Low | P2 | Wire public banners to CMS `Banner` model | CMS publish endpoint |
| Projects listing | List all, filters (city/price/type), sort | Real list + search(`q`) + featured toggle + pagination | **No city/price/type filters, no sort** | Medium | P1 | Add filter+sort params end-to-end (API already filters units; extend projects) | API query params |
| Project details | Media, description, services/amenities, Google Maps, Request Info/Visit | Real; gallery, amenities, Maps embed, generic FAQ, related units, CTA | Maps depends on coords being set; request-visit CTA links to contact (not a dedicated visit form) | Low | P2 | Add explicit Request-Visit form posting to `requests` | requests API (exists) |
| Units listing | List, filters (price/area/rooms) | Real list + type/bed/bath/price/status/city/project filters + pagination | Sort missing | Low | P2 | Add sort param | API |
| Unit details | Details, images + floor plan, status badge, contact/visit/save | Real; specs, gallery, status, compare, similar units | **Floor plan is placeholder SVG**; "save/favorite" not wired for guests | Medium | P1 | Real floor-plan media; favorites requires auth portal | Media; customer portal |
| Compare | Compare units | Real, client-side, up to 3, matrix + mobile cards | None significant | Low | P3 | — | — |
| Contact | Form, WhatsApp/Call | Real form → `/public/info-request`; validation | WhatsApp/Call CTAs presence to verify per design | Low | P2 | Confirm WhatsApp/Call links | — |
| Login / Register | Customer register + login (email/OTP) | Real UI + API; **session in localStorage; redirects to /projects** | **No protected area to land in; insecure token storage** | High | P1 | Build customer portal + move to httpOnly cookie/secure storage | Customer portal, auth hardening |
| **Customer/Client portal** (Favorites, Visit Requests, My Requests, Profile, My Property, Contracts, Deposits, Maintenance, Notifications) | Required by scope (Client+Customer use **website + app**) | **Not built** (backend endpoints exist) | **Entire authenticated portal missing on web** | High | P1 | Build portal pages consuming existing `me/*` endpoints | Auth hardening, notifications |
| SEO | Metadata, sitemap, robots, structured data | Strong: per-page metadata, JSON-LD, dynamic sitemap, robots | hreflang/English absent (single locale) | Low | P3 | Add hreflang if EN launched | i18n |
| Performance | ISR, image optimization | ISR 60s; **raw `<img>` (no next/image)** | Missing image optimization → LCP/bandwidth cost | Medium | P2 | Configure `remotePatterns` + `next/image` | R2 public URL config |
| Accessibility | Semantic, alt, aria | Good semantic + aria + alt | No formal WCAG audit | Low | P2 | axe/pa11y pass | — |

## B. Admin Dashboard

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard home (KPIs/Reports) | Quick KPIs + reports | Real layout; **KPI trend/alerts hardcoded** (`TODO(phase-5)`) | KPIs not real | High | P1 | Wire to `/reports/*` (endpoints exist) | reports API |
| Users management | Admin/Sales + permissions | Real CRUD, activate/deactivate, manager assign, permissions | Permissions page route thin/stub | Medium | P1 | Finish permissions UI | permissions API |
| Clients/Customers mgmt | Clients, customers, profiles, assign to sales | Real CRUD + profile + documents + activity | Assign-to-sales flow to verify | Low | P2 | Verify assignment UX | leads/users API |
| CRM / Leads | Leads, sources, pipeline | Real kanban pipeline + sources + notes + stages | None major | Low | P2 | — | — |
| Projects | Add/edit, media, services, Maps | Real CRUD + media + map picker | None major | Low | P3 | — | — |
| Phases/Buildings | Manage phases/buildings | Backend real; admin UI to confirm depth | Verify UI completeness | Medium | P2 | Confirm/complete phase-building UI | — |
| Units / Inventory | Add unit, price, status, availability, reservation expiry, history | Real units CRUD + status history; inventory view read-only (client-side search, pagination TODO) | Inventory scaling/pagination | Medium | P2 | Server-side inventory pagination | API |
| Installment Plans | Create plans, visible to Sales only | Backend complete (templates, durations); admin CRUD real | Verify "Sales-only visibility" enforced in UI | Medium | P1 | Confirm RBAC on plan visibility | permissions |
| Reservations | Review requests, expiry | Real lifecycle (approve/reject/cancel/convert) + expiry cron | None major | Low | P2 | — | — |
| Deposits | Admin records, receipt upload, verify | Real register + filters + verify + receipt upload | None major | Low | P2 | — | — |
| Contracts | Upload PDF, manage | Real list/detail + PDF upload + sign + customer promotion | None major | Low | P2 | — | — |
| Financial module | Payments, installments, reports, bonus tracking | Real financial page (deposits/installments tables + charts) + bonus + payouts | Some figures depend on home KPIs (hardcoded); no PDF/Excel export | Medium | P1 | Wire real KPIs; add exports | reports API |
| Maintenance | Requests, assign, status, categories | Real create/assign/resolve + categories + SLA | UI ~75%; polish | Medium | P2 | Finish maintenance UI states | — |
| Bonus/Commission mgmt | Rules, approval, payment | Real rules/entries/approval; broker payouts full | UI minimal in places | Medium | P2 | Polish bonus UI | — |
| CMS (content) | Pages, banners, articles | Pages+banners CRUD; **articles read-only; no rich text; banner via URL only** | Articles editing, media upload, RTE | Medium | P2 | Complete CMS editor + uploads | media API |
| Notifications | Templates, send | Inbox + templates UI minimal; **delivery not wired** | Delivery + template UX | High | P1 | Wire FCM/email + finish UI | notification delivery |
| Media library | Images, PDF | Presigned uploads working; no central library browser | Central media browser | Low | P3 | Optional media browser | — |
| Audit logs | Tracking | Real filtered audit log view | None major | Low | P3 | — | — |
| Reports | Sales, financial | Real KPIs/sales/financial + CSV | PDF/Excel export, scheduling | Medium | P2 | Add export formats | reports API |
| Settings | System config, statuses, roles | Real key-value editor + permissions | Validation, statuses editor depth | Medium | P2 | Add validation + status mgmt | — |
| Form validation | Robust validation | **HTML5 only, no Zod/per-field errors** | Weak client validation | Medium | P1 | Adopt shared Zod schemas + field errors | shared-types |
| Token refresh | Long sessions | **No refresh interceptor** | Stale-token re-login | Medium | P2 | Add refresh on 401 | auth |

## C. Client / Customer Mobile App (Flutter)

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entire app | Splash/onboarding, login/register (OTP), home, projects, project details (+Maps), units, unit details (save/contact), favorites, visits (book/track), requests, notifications, profile; **Customer adds:** my property, deposits (view), contracts (download), maintenance (request/track) | **Does not exist** (no `mobile-client` dir) | **100% missing** | Critical | P1 | Build Flutter app per README stack (Riverpod, GoRouter, Dio from OpenAPI) | Mobile API foundation, notifications, OpenAPI client |

## D. Sales Mobile App (Flutter)

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entire app | Login, dashboard (leads/visits/bonus/targets), clients list + details (timeline/notes/status), CRM pipeline, projects, project details (+Map), units, unit details (share), installment calculator, reservations (request), visits (schedule/track), bonus page (commission/target/paid-pending), notifications, profile | **Does not exist** (no `mobile-sales` dir) | **100% missing** | Critical | P1 | Build Flutter app; reuse backend CRM/reservation/bonus/installment endpoints | Mobile API foundation, notifications, OpenAPI client |

## E. Backend / API

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Domain coverage | All modules per scope | 35 modules; full domain + brokers (beyond scope) | None for scope; broker scope-creep to manage | Low | P2 | Confirm broker scope with stakeholders | — |
| Mobile API foundation | Endpoints/contract for apps | REST + Swagger; **no exported OpenAPI artifact / generated client confirmed** | OpenAPI export + Dio generation pipeline | High | P1 | Add `openapi.json` export + codegen script | Swagger (exists) |
| Notification delivery | Push + email | **Stubbed** (records only; FCM/email not wired) | Delivery channels | Critical | P0/P1 | Implement FCM + email/SMS senders + triggers | Firebase, SMTP creds |
| Background jobs | Async processing | BullMQ infra only, **no processors**; 2 crons real | Processors for email/SMS/PDF/exports | Medium | P2 | Add queue processors | Redis (exists) |
| Ownership/data scoping | Tenant isolation | Inline per service; **no central guard** | Centralized ownership enforcement | High | P1 | Add ownership guard/decorator + tests | RBAC |
| API versioning | Stable contract | Single `/v1` | No deprecation path | Low | P3 | Define versioning policy before mobile GA | — |
| Pagination defaults | Bounded queries | Some `take:100` / unbounded lists | Resource risk at scale | Medium | P2 | Enforce default+max page sizes | — |

## F. Database / Data Model

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Schema | All entities | 37 models, 24 migrations, rich enums, 56+ indexes | None major | Low | P2 | — | — |
| Migrations | Versioned, reversible | Sequential Prisma migrations; deploy via `prisma:deploy` | **No documented rollback/runbook** | High | P1 | Migration + rollback runbook | — |
| Seed | Demo/seed data | Idempotent seed (projects/units/sources/categories + admin) | Clearly demo; ensure not run in prod | Medium | P1 | Guard seed against prod | env |
| Soft-delete | Recoverable deletes | `active` flags partial | No consistent soft-delete | Medium | P2 | Standardize soft-delete | — |
| Decimal bounds | Valid % | `Decimal(5,2)` allows out-of-range commission | Validation caps | Medium | P2 | Add 0–100 validation | — |

## G. Auth & Permissions

| Area | Expected Scope | Current Implementation | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Roles | Guest/Client/Customer/Sales/Admin | 7 roles incl. broker/manager/maintenance | Extra roles (managed scope) | Low | P2 | Document role matrix | — |
| RBAC | Per-page/role | Roles + permission codes + admin bypass; global guards | Strong | Low | P2 | — | — |
| OTP | Client login | Real (hashed, throttled, TTL) | None | Low | P3 | — | — |
| Web-public session | Secure | **localStorage tokens** | XSS exposure | High | P1 | httpOnly cookies / secure mobile storage | portal |
| Token refresh (admin) | Seamless sessions | Missing | Re-login friction | Medium | P2 | Refresh interceptor | — |

## H. Media / File Uploads

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Uploads | Secure media/PDF | Presigned R2, MIME whitelist, 25MiB cap, URL-safety | No client-side size check; no AV scan | Medium | P2 | Client size validation + optional AV scan | R2 |

## I. Contracts PDFs

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contract PDFs | Admin uploads PDF; customer downloads | Upload + sign + Document link + customer promotion | Customer-facing download UI (web/mobile) missing | High | P1 | Build customer contract download in portal/app | customer portal, RBAC |

## J. Deposits

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deposits | Admin records, no online pay, customer views/receipts | Admin record/verify/receipt; `GET /me/deposits` read-only | Customer-facing deposits view (web/mobile) missing | High | P1 | Build customer deposits view | customer portal/app |

## K. Installment Plans

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Plans | Admin-created, Sales-only visible | Backend complete; admin CRUD | Confirm Sales-only RBAC end-to-end; **Sales mobile calculator missing** | High | P1 | Verify visibility + build calculator in Sales app | Sales app |

## L. Reservations

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reservations | Sales requests, admin review, expiry | Full lifecycle + 5-min expiry cron | Mobile request UI missing | High | P1 | Build in Sales/Customer apps | mobile apps |

## M. Visits

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Visits | Request, schedule, track | Backend + admin UI real | Customer/Sales mobile + web-public visit UI | High | P1 | Build visit UIs | portal, mobile |

## N. Maintenance

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Maintenance | Customer requests post-purchase; admin/supervisor handles | Backend + admin/supervisor UI real; categories/SLA | **Customer-facing request UI (web/mobile) missing** | High | P1 | Build customer maintenance request/track | customer portal/app |

## O. Bonus / Commission

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bonus | Sales commission/bonus, rules, approval, payment | Backend + admin UI; auto-gen on contract; targets | **Sales-facing bonus page (mobile) missing** | High | P1 | Build Sales bonus/target page | Sales app |

## P. Financial Reports

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reports | Payments, installments, bonus, KPIs | Real endpoints + CSV; admin financial page | Home KPIs hardcoded; no PDF/Excel/scheduled | Medium | P1 | Wire KPIs; add exports | reports API |

## Q. Notifications

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Notifications | System notifications across surfaces (in-app/push/email) | Records + templates + device tokens; **delivery not wired** | Push + email delivery + triggers + UIs | Critical | P0/P1 | Implement delivery + event triggers + per-surface UI | Firebase, SMTP |

## R. Audit Logs

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Audit | Track mutations | Global interceptor + admin viewer | Retention/export policy | Low | P3 | Define retention | — |

## S. CMS / Content

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CMS | Pages, banners, articles | Pages+banners CRUD; articles read-only; no RTE/upload | Articles editing, RTE, image upload, public wiring | Medium | P2 | Complete CMS + connect to public | media |

## T. SEO

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEO | Discoverable public site | Strong (metadata/JSON-LD/sitemap/robots) | hreflang/EN | Low | P3 | Add if EN launches | i18n |

## U. Accessibility

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A11y | WCAG-conscious | Reasonable semantic/aria/alt; admin lighter (landmarks/alt) | No formal audit; admin gaps | Medium | P2 | axe/pa11y CI + fixes | — |

## V. Testing

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tests | Unit + integration + E2E, CI-gated | 54 API specs + Playwright smoke (both web) | **Not run in CI**; no coverage gate; no CRUD/E2E depth; no mobile tests | High | P0 | Gate tests in CI; add coverage + flows | CI |

## W. Deployment

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Deploy | Automated, repeatable | Dockerfiles (api, web-admin) + compose; **no CD; Railway/Vercel manual** | CD pipeline, web-public Dockerfile/Vercel config, release process | High | P1 | Add CD + documented release/runbook | CI |

## X. Monitoring / Logging

| Area | Expected | Current | Gap | Risk | Priority | Recommended Fix | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Observability | Logs, errors, metrics, health | JSON logs + optional Sentry + `/health` | No metrics/APM/tracing; no alerting; no dep/secret scanning | Medium | P2 | Add APM/metrics + alerts + Dependabot | — |

---

## Cross-cutting priority summary

- **P0 (blockers):** wire notification delivery; gate tests in CI.
- **P1 (must-have for scope):** mobile API foundation (OpenAPI/Dio) + push; web customer portal; both mobile apps; real Admin KPIs; centralized ownership guard; secure web-public session; migration/backup runbook; deployment automation.
- **P2 (should-have):** public filters/sort, image optimization, CMS completion, form validation, inventory pagination, A11y audit, APM, decimal/pagination bounds.
- **P3 (nice-to-have):** EN/hreflang, media library browser, API versioning policy, audit retention.
