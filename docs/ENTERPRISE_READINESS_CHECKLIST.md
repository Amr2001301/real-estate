# Enterprise Readiness Checklist

> **Date:** 2026-05-25 · Assessed for delivery to a large real-estate company.
> **Legend:** ✅ Done · 🟡 Partial · ❌ Missing · ⚠️ Risky · ❓ Unknown (needs verification)
> Each item is judged against **what the code proves**, not intentions. "Risky" means present but with a flaw that would fail enterprise review.

---

## Authentication
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Staff email+password login | ✅ | `/auth/login`, Argon2, last-login tracked |
| Customer email+password | ✅ | `/auth/customer/register|login` |
| Phone OTP | ✅ | hashed, 10-min TTL, 5-attempt cap, throttled (Twilio/console) |
| JWT access + refresh | ✅ | 15m / 30d, refresh hashed + rotated |
| Admin web session storage | ✅ | httpOnly cookies + middleware guard |
| Web-public session storage | ⚠️ | **localStorage** tokens (XSS exposure) |
| Token refresh on web (long sessions) | ❌ | No refresh interceptor in admin/public |
| MFA for admin/financial roles | ❌ | Not implemented |
| Account lockout / brute-force on password login | 🟡 | Global throttler only; no per-account lockout |

## Role-Based Access Control
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Global guard chain | ✅ | Throttler → JWT → Roles → Permissions |
| Role decorator `@Roles` | ✅ | Enforced per endpoint |
| Fine-grained permission codes | ✅ | DB-backed, per-user, admin bypass |
| Documented role/permission matrix | ❌ | Not written down; 7 roles + 87 codes undocumented |
| Tests for RBAC | ✅ | Multiple `*-permissions.spec.ts` |

## Admin / Sales / Client / Customer permissions
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Admin full access | ✅ | — |
| Sales scoping (own/team) | ✅ | `managerId` team scope; sales-scope tests |
| Installment plans Sales-only | ❓ | Backend intent stated; verify UI/RBAC end-to-end |
| Client/Customer own-data scoping | 🟡 | Inline in services; **no centralized ownership guard** |
| Cross-tenant leak protection | ⚠️ | Relies on per-service discipline; easy to miss on new routes |

## Input validation
| Item | Status | Evidence / Note |
| --- | --- | --- |
| API DTO validation | ✅ | class-validator, whitelist + forbidNonWhitelisted |
| Env validation | ✅ | Zod, prod-specific checks |
| Admin form validation | ⚠️ | HTML5 only; no Zod/per-field errors |
| Public form validation | 🟡 | Custom regex client-side; server is source of truth |
| Shared validation schemas | 🟡 | `shared-types` Zod exists; not used by web forms |

## API validation
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Request schema validation | ✅ | Global ValidationPipe |
| Pagination bounds | 🟡 | Some unbounded/`take:100` lists |
| Decimal/range validation | ⚠️ | Commission `Decimal(5,2)` unbounded |
| Rate limiting | ✅ | Throttler global + OTP-specific |

## Error handling
| Item | Status | Evidence / Note |
| --- | --- | --- |
| API exception handling | ✅ | Nest filters + structured errors |
| Admin error boundaries | ✅ | `app/error.tsx`, dashboard error boundary |
| Public error boundaries | ✅ | `error.tsx`, `global-error.tsx`, friendly Arabic |
| Permission-error messaging | ✅ | 87-code Arabic label map |
| No raw error/PII leakage | ✅ | Sentry `beforeSend` redaction |

## Loading states
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Admin skeletons / pending | ✅ | `_loading.tsx`, `useActionState` pending |
| Public loading | ✅ | `loading.tsx`, submit spinners |

## Empty states
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Admin empty states | ✅ | `EmptyState` with CTA |
| Public empty states | ✅ | Listing/compare empty UI |

## Permission-denied states
| Item | Status | Evidence / Note |
| --- | --- | --- |
| API 403 shape | ✅ | `{ code:'missing_permission', permissions:[] }` |
| Admin denied UX | 🟡 | Inline error alerts, no dedicated boundary page |
| Public denied UX | ❓ | No protected pages yet |

## Audit logs
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Mutation audit interceptor | ✅ | Actor/action/entity/payload, sensitive masking |
| Admin audit viewer | ✅ | Filtered list + detail |
| Retention/export policy | ❌ | Undefined |

## Data privacy
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Sensitive-field masking in logs/audit | ✅ | passwords/tokens/OTP masked |
| PII minimization in Sentry | ✅ | id-only user context |
| Data retention / deletion policy | ❌ | None documented |
| PDPL/GDPR-style consent records | 🟡 | Register has terms checkbox; no consent storage |

## File upload security
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Presigned uploads | ✅ | R2, 5-min expiry |
| MIME whitelist + size cap | ✅ | docs presign: whitelist + 25MiB |
| URL-safety checks | ✅ | rejects javascript:/data:/file:/localhost |
| Client-side size validation | ❌ | none |
| Antivirus / content scanning | ❌ | none |

## Contract PDF security
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Admin-only upload | ✅ | per scope |
| Stored as Document w/ visibility | ✅ | `CUSTOMER_VISIBLE` etc. |
| Customer-scoped download | ❓ | Backend ready; **no customer UI** to test access control |
| Signed-URL expiry on download | ❓ | Verify download path uses time-limited URL |

## Deposit verification workflow
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Admin records deposit | ✅ | per scope, no online pay |
| Verify flag + receipt | ✅ | verify toggle + receipt upload |
| Customer read-only view | 🟡 | `GET /me/deposits` exists; **no UI** |
| Audit of verification | ✅ | covered by audit interceptor |

## Financial data safety
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Installments lifecycle + overdue cron | ✅ | daily cron |
| Bonus/commission approval workflow | ✅ | PENDING→APPROVED→PAID |
| Reports/CSV | ✅ | endpoints + export |
| Real KPIs on admin home | ⚠️ | **hardcoded demo data** (`TODO(phase-5)`) |
| Numeric integrity (rounding/decimal) | 🟡 | Decimal used; commission bounds unvalidated |

## Maintenance workflow
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Categories + SLA + warranty | ✅ | schema + service |
| Request → assign → status lifecycle | ✅ | admin/supervisor UI |
| Review/approval gate (SLA start) | ✅ | PENDING/APPROVED/REJECTED |
| Customer request UI | ❌ | not on web/mobile |

## Commission / Bonus workflow
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Rules + entries + targets | ✅ | admin UI |
| Auto-generate on contract | ✅ | sales-commission-generation tests |
| Broker commissions + payouts | ✅ | full lifecycle + tests |
| Sales-facing bonus view | ❌ | mobile app missing |

## SEO
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Metadata / OG / canonical | ✅ | `buildMetadata` |
| JSON-LD structured data | ✅ | org/breadcrumb/residence/product |
| Sitemap + robots | ✅ | dynamic sitemap, robots |
| hreflang / multi-locale | ❌ | single locale |

## Accessibility
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Semantic HTML / headings | ✅ | both apps |
| aria-labels / alt text | 🟡 | public good; admin lighter |
| Landmarks (nav/main/aside) | 🟡 | public yes; admin partial |
| Formal WCAG audit (axe/pa11y) | ❌ | none |

## Responsive design
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Public responsive | ✅ | mobile-first, RTL |
| Admin responsive | ✅ | grid/flex breakpoints, table scroll |
| Tested on real breakpoints | ❓ | no responsive test evidence |

## Performance
| Item | Status | Evidence / Note |
| --- | --- | --- |
| ISR/SSR caching (public) | ✅ | 60s revalidate |
| Image optimization | ❌ | raw `<img>`, no next/image |
| On-demand revalidation on publish | ❌ | no revalidate hook |
| Query indexing | ✅ | 56+ indexes |
| Load/perf testing | ❌ | none |

## Caching
| Item | Status | Evidence / Note |
| --- | --- | --- |
| HTTP/ISR caching | ✅ | public ISR |
| API/data caching (Redis) | 🟡 | Redis present (BullMQ); not used as cache |
| CDN strategy | ❓ | Vercel implied; not documented |

## Testing
| Item | Status | Evidence / Note |
| --- | --- | --- |
| API unit/integration tests | ✅ | 54 specs |
| Web E2E smoke | ✅ | Playwright (admin 3, public 1) |
| Tests gated in CI | ❌ | CI does not run tests |
| Coverage thresholds | ❌ | none |
| CRUD/flow E2E depth | 🟡 | smoke only |
| Mobile tests | ❌ | no apps |

## Database migrations
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Versioned migrations | ✅ | 24 Prisma migrations |
| Prod deploy command | ✅ | `prisma:deploy` + entrypoint flag |
| Rollback/runbook | ❌ | none |
| Drift detection in CI | 🟡 | `migrate status` runs but `continue-on-error` |
| Seed guarded from prod | ⚠️ | seed idempotent but not env-guarded |

## Backup readiness
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Backup procedure | ❌ | none documented (assumed Railway) |
| Restore drill / RTO-RPO | ❌ | none |

## Environment configuration
| Item | Status | Evidence / Note |
| --- | --- | --- |
| `.env.example` per app | ✅ | api/admin/public + docker |
| Prod env validation | ✅ | Zod prod checks (secrets/CORS/R2/SMTP) |
| Secret manager / rotation | ❌ | platform env only |

## Deployment readiness
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Dockerfiles (api, admin) | ✅ | multi-stage, non-root, healthcheck |
| web-public container/Vercel config | ❓ | no Dockerfile; Vercel assumed |
| CD automation | ❌ | none in repo |
| Release/rollback process | ❌ | undocumented |

## Observability / logging
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Structured logging | ✅ | JSON logger + request-id |
| Error tracking | 🟡 | Sentry optional (opt-in) |
| Health endpoint | ✅ | `/health` + docker healthchecks |
| Metrics / APM / tracing | ❌ | none |
| Alerting | ❌ | none |

## Documentation
| Item | Status | Evidence / Note |
| --- | --- | --- |
| README + architecture notes | ✅ | thorough (some stale: web-public/mobile phases) |
| Phase/QA reports | ✅ | 10 docs under apps/api/docs |
| API docs | 🟡 | Swagger live only; no exported OpenAPI |
| Deployment/DR runbook | ❌ | none |
| Role/permission matrix | ❌ | none |

## Handover readiness
| Item | Status | Evidence / Note |
| --- | --- | --- |
| Onboarding/quick-start | ✅ | README quick start |
| Env + secrets handover doc | 🟡 | examples exist; no secrets inventory/owner map |
| Known-issues / TODO register | 🟡 | scattered `TODO(phase-5)`; not centralized |
| Test+CI confidence for handover | ❌ | tests ungated |
| Mobile deliverables | ❌ | apps absent |

---

## Readiness verdict by surface
- **Backend:** ~70% enterprise-ready. Blockers: notifications delivery, CI gating, ownership guard, ops runbooks.
- **Admin:** ~75% feature-complete, ~60% enterprise-ready. Blockers: real KPIs, validation, finish stub modules.
- **Public (guest):** ~70% ready. Blockers: image optimization, filters/sort, secure session.
- **Public (customer portal):** not started.
- **Mobile (both):** not started.
- **Overall platform:** **Not enterprise-ready.** Strong foundation; ~50–55% of full scope delivered.
