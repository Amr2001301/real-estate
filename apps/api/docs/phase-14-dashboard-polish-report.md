# Phase 14 — Dashboard Production Polish + UX QA

_Generated 2026-05-18._

> **Scope reminder:** Dashboard + Broker Portal inside `apps/web-admin/` only.
> No website or mobile work. No new features, no schema changes, no
> permission rule changes.

## 1. Pages reviewed

**Admin** (`apps/web-admin/src/app/dashboard/`):
- `brokers/`, `brokers/[id]/`, `brokers/[id]/users/`, `brokers/[id]/access/`, `brokers/[id]/performance/`
- `broker-leads/`, `broker-reservations/`, `broker-contracts/`
- `broker-commissions/`, `broker-commissions/[id]/`
- `broker-payouts/`, `broker-payouts/[id]/`
- `broker-reports/`
- `notifications/`, `notifications/templates/`

**Broker portal** (`apps/web-admin/src/app/portal/`):
- `page.tsx`, `team/`, `team/new/`, `team/[id]/edit/`
- `projects/`, `units/`, `leads/`, `visits/`, `reservations/`, `contracts/`
- `commissions/`, `payouts/`, `performance/`
- `activity/`, `notifications/`, `profile/`

Audit method: code-driven scan via subagent looking for clear bugs, not design preferences.

## 2. Issues found

| # | File | Severity | Type | Description |
| --- | --- | --- | --- | --- |
| 1 | [apps/web-admin/src/app/portal/payouts/page.tsx:96](apps/web-admin/src/app/portal/payouts/page.tsx#L96) | 🔴 | label | English placeholder `"YYYY-MM"` on an otherwise Arabic filter input |
| 2 | [apps/web-admin/src/app/dashboard/broker-payouts/[id]/_action-forms.tsx:122-138](apps/web-admin/src/app/dashboard/broker-payouts/[id]/_action-forms.tsx#L122-L138) | 🔴 | button-gating | `CancelPayoutForm` had no `window.confirm()` — destructive (unlinks all linked commissions) but a single click triggered it |
| 3 | [apps/web-admin/src/app/dashboard/broker-commissions/[id]/_review-forms.tsx:53-87](apps/web-admin/src/app/dashboard/broker-commissions/[id]/_review-forms.tsx#L53-L87) | 🔴 | button-gating | `RejectCommissionForm` and `CancelCommissionForm` had no confirm — irreversible status transitions on a single click |
| 4 | [apps/web-admin/src/app/portal/team/page.tsx:195-208](apps/web-admin/src/app/portal/team/page.tsx#L195-L208) | 🔴 | button-gating | Team "إزالة" button had no confirm |
| 5 | [apps/web-admin/src/app/dashboard/brokers/[id]/users/page.tsx:203-211](apps/web-admin/src/app/dashboard/brokers/[id]/users/page.tsx#L203-L211) | 🔴 | button-gating | Admin "حذف" (delete broker user) had no confirm |
| 6 | [apps/web-admin/src/app/dashboard/notifications/templates/page.tsx](apps/web-admin/src/app/dashboard/notifications/templates/page.tsx) | 🟡 (defer, not a bug) | label | English placeholders on bilingual template-authoring form — by design (parallel AR/EN fields), template `code` must be ASCII identifier |
| 7 | [apps/web-admin/src/app/dashboard/cms/page.tsx](apps/web-admin/src/app/dashboard/cms/page.tsx) | 🟡 (defer, not a bug) | label | Same bilingual-by-design pattern as templates page |
| 8 | [apps/web-admin/src/app/dashboard/broker-payouts/[id]/page.tsx:97](apps/web-admin/src/app/dashboard/broker-payouts/[id]/page.tsx#L97) | 🟡 (defer) | type-cast | `as never` on dynamic `Link` href — codebase-wide pattern for Next.js typed routes with UUIDs |
| 9 | [apps/web-admin/src/app/portal/layout.tsx](apps/web-admin/src/app/portal/layout.tsx) | 🟡 (defer) | sidebar | When `/portal/me` errors mid-session, sidebar falls back to full nav — backend still gates every route via guards (already documented in Phase 13) |

## 3. Fixes made

### 3.1 Native confirmation on destructive actions
Added two tiny client helpers and wired them into the five destructive forms surfaced above:

- New [apps/web-admin/src/components/confirming-form.tsx](apps/web-admin/src/components/confirming-form.tsx) — thin client wrapper around `<form>` that calls `window.confirm()` on submit. Used inside server-component pages.
- Used `onSubmit` inline on already-client forms.

**Forms hardened:**
- `CancelPayoutForm` → `'سيتم إلغاء الدفعة وفصل جميع العمولات المرتبطة بها. هل أنت متأكد؟'`
- `RejectCommissionForm` → `'سيتم رفض العمولة. هل أنت متأكد؟'`
- `CancelCommissionForm` → `'سيتم إلغاء العمولة. هل أنت متأكد؟'`
- Portal team Remove → `'سيتم إزالة «{اسم العضو}» من فريق العمل. هل أنت متأكد؟'`
- Admin broker-users Delete → `'سيتم حذف «{اسم العضو}» من قائمة موظفي الوسيط. هل أنت متأكد؟'`

Non-destructive actions (تفعيل, إيقاف, اعتماد) intentionally do NOT have a confirm — they're recoverable.

### 3.2 Arabic placeholder on portal payouts filter
- [apps/web-admin/src/app/portal/payouts/page.tsx:96](apps/web-admin/src/app/portal/payouts/page.tsx#L96) → `placeholder="YYYY-MM"` → `placeholder="الفترة (مثال: 2026-05)"`; widened input to `w-40` so the longer hint fits.
- Mirrors the admin payouts page fix already shipped in Phase 11.

### 3.3 Files changed
| File | Change |
| --- | --- |
| `apps/web-admin/src/components/confirming-form.tsx` | **new** — client `<form>` with confirm() gate |
| `apps/web-admin/src/app/dashboard/broker-payouts/[id]/_action-forms.tsx` | `CancelPayoutForm` now confirms before submit |
| `apps/web-admin/src/app/dashboard/broker-commissions/[id]/_review-forms.tsx` | `RejectCommissionForm` + `CancelCommissionForm` now confirm |
| `apps/web-admin/src/app/portal/team/page.tsx` | Remove form wrapped in `ConfirmingForm` |
| `apps/web-admin/src/app/dashboard/brokers/[id]/users/page.tsx` | Delete form wrapped in `ConfirmingForm` |
| `apps/web-admin/src/app/portal/payouts/page.tsx` | Localised period placeholder |
| `apps/api/docs/phase-14-dashboard-polish-report.md` | **new** — this report |

## 4. Issues intentionally deferred

| # | Reason |
| --- | --- |
| Bilingual template authoring (notifications/templates, cms) | The English placeholders are on English-language fields — by design. The `code` field must be ASCII (it's the lookup key). Touching these without changing the bilingual authoring model is cosmetic. |
| Portal sidebar fallback when `/portal/me` errors | Documented in Phase 13 as P3. Backend still gates every route. Fix would either swallow errors silently or add a redirect — both have UX trade-offs that warrant a dedicated decision. |
| `as never` casts on dynamic `Link` href | Project-wide pattern for Next.js typed routes. Not a bug. |

## 5. Screens that still need a manual human review

Code-driven polish caught what static analysis can catch. The following classes of issues are best caught by a human walking through the live app — they remain pending in the Phase 13 sign-off checklist:

- Responsive behaviour on tablet (~768px) widths for the wide tables (broker-leads, broker-reservations, broker-contracts).
- CSV download UX in Excel + Numbers + LibreOffice.
- Notification bell unread count accuracy after the inbox flow (mark-one, mark-all).
- Activity feed deep-links opening the correct entity page on the correct surface (admin vs portal).
- Visual consistency of status badges across all pages — code review confirms they use shared components from `apps/web-admin/src/components/badges.tsx`, but the final visual diff needs eyeballs.

## 6. Commands run

```bash
cd apps/web-admin && npx tsc --noEmit         # ✅ 0 errors
cd apps/api && npx tsc --noEmit               # ✅ 0 errors (backend not touched)
```

`prisma validate`, `prisma generate`, and the smoke script were not re-run — only web-admin client files changed, and the Phase 13 results remain valid.

## 7. Manual QA steps for the changes in this phase

1. **Cancel payout** — open a `DRAFT` or `APPROVED` payout in `/dashboard/broker-payouts/:id` → click cancel → confirm dialog appears → cancel from the dialog leaves the payout untouched → confirm proceeds and unlinks commissions.
2. **Reject commission** — open a PENDING commission in `/dashboard/broker-commissions/:id` → click reject → confirm dialog → cancel from dialog keeps commission PENDING; confirm rejects it.
3. **Cancel commission** — same flow but for the cancel action.
4. **Remove broker team member** (portal) — `/portal/team` → "إزالة" button on any row → dialog quotes the member's name → cancel keeps row visible; confirm removes it.
5. **Delete broker user** (admin) — `/dashboard/brokers/:id/users` → "حذف" link on any non-REMOVED row → dialog quotes name → cancel/confirm as above.
6. **Portal payouts filter** — `/portal/payouts` → period filter input shows Arabic hint `"الفترة (مثال: 2026-05)"` → entering `2026-05` filters as before.

## 8. Final UX readiness verdict

### **READY WITH MINOR WARNINGS**

**Why READY:**
- All five destructive forms now require explicit user confirmation.
- All user-facing Arabic-page placeholders that surfaced in the audit are localised.
- Type-check passes on both apps after the fixes.

**Why "with minor warnings":**
- The deferred items in §4 are real but each has a sound reason for deferral.
- The §5 list is the same set the Phase 13 report flagged as "needs human eyeballs" — that has not changed.
- This phase consciously kept the scope narrow (polish only). Layout/responsive review at tablet/laptop widths is best done in a browser session, not from code.

**No P0/P1 issues remain.** All P3 items are documented with rationale.
