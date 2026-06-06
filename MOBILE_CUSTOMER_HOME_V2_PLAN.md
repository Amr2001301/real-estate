# Mobile CUSTOMER Home V2 — Ownership Command Center

**Status:** Design plan only — no code changes yet.
**Scope:** Mobile CUSTOMER Home/Dashboard, authenticated CUSTOMER role only.
**Out of scope:** Guest home, staff/broker/supervisor apps, catalog detail pages, any backend/API/auth/routing/business-logic change.

This plan is grounded in the current code:

- Body dashboard: `apps/mobile/mobile_customer/lib/features/catalog/presentation/home/customer_home_dashboard.dart`
- Host + discovery + bottom padding: `apps/mobile/mobile_customer/lib/features/catalog/presentation/home/home_screen.dart`
- AppBar + bottom nav + FAB: `apps/mobile/mobile_customer/lib/features/shell/presentation/customer_shell_scaffold.dart`
- Header pieces: `notification_bell.dart`, core `AdaptiveAppBar`, `GradientAvatar`
- Data: `my_property/**` (`Property`), `installments/**` (`Installment`), `maintenance/**` (`MaintenanceRequest`), `notifications/**` (unread count), `favorites` (count)
- Design system: `packages/core/lib/**` (`PremiumCard`, `SummaryTile`, `IconChip`, `StatusBadge`, `AppButton`, `AppSectionHeader`, tokens)

---

## 1. Current UI Diagnosis

Reading the three current mobile screenshots (V1 dashboard) top-to-bottom:

### 1.1 AppBar / profile / notification (screenshot 3, top)
- The shell renders a **single generic `AdaptiveAppBar`** shared by every branch: a **centered title `الرئيسية`** with a square gold **`AT` avatar + a plain bell** pushed to the top-start corner.
- The centered title dominates and says nothing useful to an owner ("Home" is obvious from the active tab).
- The **square `AT` avatar reads as a disconnected chip**, not a premium identity. It floats with no name, no role, no context.
- The **bell is a bare glyph**; with `0` unread it has no badge and looks decorative/disconnected.
- Net: the first 56px of the screen is wasted on generic chrome. There is **no customer identity, no ownership signal, no "what needs my attention"** at the very top.

### 1.2 Hero / status card (screenshot 3)
- The greeting card ("مرحبًا، Amr Tarek" + `عميل` badge + "لا أقساط مستحقة" box + `عرض الأقساط` / `طلب صيانة`) is the strongest element, but:
  - The status badge shows only **`عميل`**, never **`عميل · مالك وحدة`** — i.e. the **ownership signal is missing** in practice.
  - The card shows a payment state but **no property** above/below it in the first viewport.

### 1.3 My Property card — **missing in practice** (critical)
- In the screenshots **no My Property card appears** between the hero and the overview, even though the web dashboard for the same customer clearly shows an owned unit (سولارا هايتس · SH-1201 · CON-2026-0004) with an **overdue** installment.
- Mobile shows "لا أقساط مستحقة" and `أقساط مستحقة = 0` while web shows متأخر 500,000. This is a **data/visibility mismatch**: either the property/installment cubits return nothing for this session on mobile, or the property card is being skipped. **This is the single biggest reason the screen still feels like a generic dashboard rather than an ownership command center** — the centerpiece is absent.
- Action for V2: treat "My Property visible and first" as the primary success metric, and add a **diagnosis/verification step** (below) before styling.

### 1.4 Overview cards (screenshot 3, "نظرة عامة")
- The 2×2 grid uses full `SummaryTile`s (large filled icon chip + oversized number + label). At 4 tiles this is a **tall, sparse block** — exactly the "too large / too much empty space / visually weak" complaint.
- The values are mostly `0`/`14`, so a large card per number is poor information density.
- `المفضلة (14)` is the **largest non-zero number**, which visually elevates a **discovery** metric above ownership/finance — wrong priority for an owner.

### 1.5 Quick actions (screenshots 2–3, "إجراءات سريعة")
- Compact rows are an improvement, but they **partly duplicate** the hero buttons and the overview tiles (الأقساط/الصيانة already appear as tiles and hero CTAs). Redundancy makes the screen feel repetitive.

### 1.6 Discovery sections (screenshots 1–2)
- "مشاريع مميّزة" (featured projects carousel) and "وحدات مختارة" (selected units) are **large, image-rich, and dominant** — they occupy more vertical space and visual weight than anything ownership-related. For a CUSTOMER this reproduces the **Guest/catalog feel** the task is trying to eliminate.

### 1.7 Bottom nav / FAB
- The floating assistant FAB sits over the bottom-start corner and, on the discovery sections, **visually collides with the unit cards** (screenshot 1). Even with the V1 `_fabClearance`, the discovery carousels keep the catalog at the bottom where the FAB lives.

### 1.8 Summary of root causes
1. The **ownership centerpiece (My Property) is not visible**, so nothing anchors the screen as an owner dashboard.
2. **Generic shared AppBar** gives no identity/priority at the top.
3. **Overview tiles are oversized**, low-density, and elevate the wrong metric (favorites).
4. **Discovery is still first-class**, re-introducing the catalog feel.
5. **Redundancy** between hero CTAs, overview tiles, and quick actions.

---

## 2. Proposed Concept — *Customer Home V2 — Ownership Command Center*

A single scrollable surface that, in its **first viewport**, answers: *who am I, what do I own, and what needs my money/attention right now* — then offers fast service actions and recent updates, with discovery removed (or collapsed to a single quiet link).

Principles:
- **Ownership-first:** the owned unit + next payment are the hero, not a greeting.
- **Compact & data-rich:** replace big number tiles with a tight metric strip; every pixel earns its place.
- **Service-focused:** the actions an owner repeats (pay, maintenance, contract, payments) are one tap away.
- **Distinct from Guest:** no image carousels above the fold; warm light cards, navy/gold accents, no marketing hero.
- **RTL-polished, premium:** consistent gold-glow light cards, navy reserved for the single primary CTA/identity rail.

---

## 3. Proposed Screen Hierarchy

New vertical order (first viewport ≈ sections 1–3):

### 3.1 Premium customer header *(replaces the generic AppBar on this branch)*
- **Purpose:** identity + attention at the top, not generic chrome.
- **Data:** name (`session.displayName`), role/ownership status (`عميل · مالك وحدة` when a property exists, else `عميل`), unread count (`UnreadCountCubit`), avatar/initials (`GradientAvatar`).
- **Visual:** a compact identity row — circular/rounded `GradientAvatar` (initials), name + status badge inline, and on the end side a **bell with gold unread badge** + a small profile chevron. Sits on the warm canvas, no boxed toolbar.
- **Actions:** bell → `/account/notifications`; avatar/name → `/account/profile`.
- **Empty state:** name falls back to email; status falls back to `عميل`.
- **Why here:** the top strip should establish *who* and *what needs attention* immediately.

### 3.2 Critical payment / status card (the hero)
- **Purpose:** the one thing an owner checks first — the next/overdue installment.
- **Data:** earliest unpaid `Installment` (amount, due date, OVERDUE flag), `unpaidCount`. Falls back to an "all caught up" state.
- **Visual:** PremiumCard with a **status-colored accent rail** (error rail when overdue, gold when due, success when clear). Large amount, due/overdue `StatusBadge`, "{n} أقساط متبقية" sub-line.
- **Actions:** primary `عرض الأقساط` (navy); secondary `طلب صيانة` (outline).
- **Empty state:** success chip "لا أقساط مستحقة / سجلّك خالٍ من المستحقات الحالية" (keep V1 copy).
- **Why here:** money owed is the highest-stakes owner question.

### 3.3 My Property card *(must be visible — the centerpiece)*
- **Purpose:** "what do I own" — the anchor that makes this an ownership dashboard.
- **Data:** primary `Property` (project name, unit type · code, status, contract number, signed date, installment plan summary). If more than one, a `عرض الكل` to `/account/property`.
- **Visual:** PremiumCard: gold `IconChip` + project/unit + `StatusBadge` (مملوك/محجوز), divider, compact meta rows, and an inline action row (العقد PDF / الأقساط / المدفوعات / صيانة).
- **Actions:** tap → `/account/property`; inline links to contracts, deposits, installments, maintenance-new (with `unitId`).
- **Empty state (no property):** a quiet ownership-onboarding card ("ابدأ رحلتك العقارية" + explore link) — this is the **only** place discovery is allowed, and only when the user owns nothing.
- **Why here:** directly under the payment hero, the unit + contract context completes "my ownership".

### 3.4 Compact priority metrics *(replaces the large 2×2 tiles)*
- **Purpose:** at-a-glance counts that route into detail.
- **Data:** الأقساط المستحقة (unpaid count, overdue emphasis), الصيانة المفتوحة (open count), الإشعارات (unread), المفضلة (count, **lowest priority**).
- **Visual:** a **single compact strip** — a 1-row, horizontally even set of 3–4 mini-metrics (small icon chip + number + short label) inside one PremiumCard, divided by hairlines. Not four tall cards.
- **Actions:** each cell taps to its route (`/account/installments`, `/account/maintenance`, `/account/notifications`, `/account/favorites`).
- **Empty state:** zeros render normally (muted), overdue shows error tint.
- **Why here:** secondary signals, scannable in one band, no wasted height.

### 3.5 Service actions (quick actions, de-duplicated)
- **Purpose:** the repeat owner tasks not already covered by the hero/property card.
- **Data:** static destinations — وحدتي, العقود, المدفوعات, الزيارات (drop الأقساط/الصيانة here since the hero already exposes them).
- **Visual:** compact 2-col rows (icon chip + label + chevron), consistent height.
- **Actions:** existing routes, unchanged.
- **Empty state:** always present (navigation).
- **Why here:** fast secondary navigation, below the data that matters.

### 3.6 Recent activity
- **Purpose:** "what changed / needs attention".
- **Data:** latest `MaintenanceRequest` updates (max 3, status badge + date). *(Notifications feed = Future data wiring, see §6.)*
- **Visual:** PremiumCard list, 3 rows max, `عرض الكل` → `/account/maintenance`.
- **Actions:** row → maintenance detail.
- **Empty state:** hide the whole section when there's nothing.
- **Why here:** an owner glances here after money/ownership.

### 3.7 Discovery — **removed from CUSTOMER Home** (see §5)
- Featured projects + selected units are **cut** from the authenticated CUSTOMER home. Replaced by at most one quiet text link ("استكشف المشاريع") if product still wants browsing reachable — but **not** image carousels above or below the fold.

---

## 4. AppBar / Header Redesign

The AppBar today is owned by `CustomerShellScaffold` (one `AdaptiveAppBar` for all branches, suppressed only for `_selfChromeBranches`). Two viable approaches:

### Option A — Enhanced shell AppBar actions (low risk)
Keep the shell `AdaptiveAppBar`, but on the customer Home branch swap the centered "الرئيسية" title for a **compact identity title widget** (small `GradientAvatar` + name + `عميل · مالك وحدة` status) left-aligned, with the bell (gold badge) as the single end action.

```
┌───────────────────────────────────────────────┐
│ [🔔•]                       Amr Tarek  (AT) │   ← title = identity (end), bell action (start)
│                          عميل · مالك وحدة       │
└───────────────────────────────────────────────┘
```
- **Pros:** smallest change, no scroll/safe-area rework, reuses `AdaptiveAppBar`.
- **Cons:** constrained to toolbar height; status line is cramped; centered-title platform behavior fights a 2-line identity.

### Option B — Suppress shell AppBar on customer Home, render an in-body premium header (recommended)
Add the customer Home branch to a "self-chrome" set so the shell omits its AppBar for this branch, then render a richer header as the **first item of the scroll body** (like the catalog screens already do).

```
┌───────────────────────────────────────────────┐
│ (AT)  Amr Tarek                       [🔔•] ⌄ │
│       عميل · مالك وحدة                          │
└───────────────────────────────────────────────┘
   ↑ rounded gradient avatar   ↑ bell w/ gold badge + profile chevron
```
- **Pros:** full control of height, typography, RTL; identity + status read premium; bell badge and profile entry feel integrated; scrolls with content for a modern dashboard feel.
- **Cons:** must add the branch to the suppression set and re-create safe-area/top padding in the body; slightly more wiring.

**Recommendation: Option B.** It is the only way to eliminate the "default toolbar" feel and present `عميل · مالك وحدة` + a premium bell/profile cluster properly. Risk is contained to two files (`customer_shell_scaffold.dart` suppression set + a new header widget in the home body) and touches no routing/auth.

**Header must include (both options):** initials/avatar, customer name, `عميل · مالك وحدة` status (gold/navy `StatusBadge`), bell with unread gold badge (reuse `NotificationBell` semantics), and a profile entry (avatar/chevron → `/account/profile`). **Avoid:** the disconnected square `AT`, a bare standalone bell, a dominating centered title, and the default toolbar background.

---

## 5. What to Remove or Demote

| Element | Verdict | Reason | Replacement |
|---|---|---|---|
| **Featured projects carousel** | **Remove** from customer Home | Image carousel = catalog/Guest feel; highest visual weight on the screen; an owner rarely browses new projects from their dashboard | Reachable via the المشاريع/الوحدات tabs and a single quiet "استكشف المشاريع" link only if product insists |
| **Selected units carousel** | **Remove** from customer Home | Same as above; also where the FAB collides | Same quiet link, or nothing |
| **Favorites metric** | **Demote** | Discovery metric currently the largest number; competes with ownership | Keep as the **last, smallest** cell in the compact metric strip |
| **Large overview 2×2 `SummaryTile` grid** | **Replace** | Too tall, low density, sparse | Single compact metric **strip** (§3.4) |
| **Quick action grid (current 4)** | **Demote + de-dupe** | Overlaps hero CTAs (الأقساط/الصيانة) | Keep only non-duplicated destinations (وحدتي/العقود/المدفوعات/الزيارات) below the data |
| **Greeting-only hero text** | **Fold into header** | Greeting alone isn't ownership info | Identity moves to the header; hero becomes the payment/status card |

**Net effect:** the first viewport becomes Header → Payment status → My Property, with no images. Discovery leaves the CUSTOMER home entirely (Guest home keeps it, unchanged).

---

## 6. Data Prioritization

Order of importance (all from data the screens already load today):

1. **Owned property/unit** — `MyPropertyCubit` → `Property` (project name, `unitType`, `unitCode`, `status`, `contractNumber`, `signedAt`, `monthlyAmount`, `totalMonths`). *Available.*
2. **Next installment + due/overdue** — `InstallmentsCubit` → `Installment` (`amount`, `dueDate`, `status`). *Available.*
3. **Open maintenance count** — `MaintenanceRequestsCubit` → `MaintenanceRequest.status`. *Available.*
4. **Contracts / documents entry** — routes `/account/contracts`, contract PDF via existing download. *Available (navigation).*
5. **Recent notifications/activity** — recent maintenance updates *available*; **a true notifications feed list on Home = `Future data wiring needed`** (only the unread **count** is currently loaded app-wide via `UnreadCountCubit`; the notifications list cubit is not provided at `/home`).
6. **Payments / deposits summary** — total paid figure (web shows "إجمالي المدفوعات"); mobile Home does **not** load deposits today → **`Future data wiring needed`** (a `DepositsCubit` would need to be provided at `/home`; endpoint already exists, no backend change).

> **Critical verification item (pre-work):** the screenshots show **no property and zero installments** on mobile Home while web shows an owned unit + overdue installment. Before styling V2, confirm whether `MyPropertyCubit`/`InstallmentsCubit` actually return data for the signed-in mobile session (account parity / API base URL / `..load()` firing). If they return empty for the real account, the My Property + payment hero will stay invisible regardless of design. **No backend change is in scope** — this is a wiring/verification check only; if data genuinely isn't available client-side, mark the affected sections `Future data wiring needed`.

---

## 7. Mobile Layout Details

- **Spacing rhythm:** section gap `AppSpacing.lg` (20); intra-card `AppSpacing.md/sm`; screen side padding `AppSpacing.lg`. Reuse the existing `StaggeredColumn(spacing: AppSpacing.lg)`.
- **Header:** ~64–72px tall (Option B), avatar 40–44px, name `titleMedium` bold, status `StatusBadge` (gold soft).
- **Payment hero card:** PremiumCard, `accentRail` colored by status, internal next-payment box `surfaceSoft` + hairline; amount `titleLarge`/`headlineSmall` bold.
- **My Property card:** PremiumCard, meta rows are label(start)/value(end) pairs; action row is a `Wrap` of pill links.
- **Compact metric pattern:** ONE PremiumCard containing a `Row` of 3–4 equal `Expanded` cells, each = small `IconChip(size: sm)` + number (`titleMedium` bold) + label (`labelSmall` muted), separated by `VerticalDivider`/hairlines. Target cell height ≈ 64–72px (vs the current ~140px tiles).
- **Quick action pattern:** 2-col `GridView.count` with `childAspectRatio ≈ 3.4` (compact rows already used in V1), icon chip + label + chevron.
- **Bottom padding strategy:** keep the single-source bottom padding in `home_screen.dart`. With discovery removed, the last section is Recent Activity (a normal card), so retain `_fabClearance` (≈72) so the FAB never overlaps it; keep iOS `safe-area + 32` and the compare-dock branch.
- **FAB clearance:** unchanged mechanism; with no carousels at the bottom the FAB now floats over canvas/Recent-Activity tail, not over image cards.
- **RTL alignment:** all rows use `start/end` (directional); badges/rails use `PositionedDirectional`; numbers use `dir: auto` where needed (Arabic-Indic vs Latin).
- **Smaller devices:** sections stack and scroll; metric strip stays single-row (numbers are short); never force fixed heights that clip Arabic text — use `min` main-axis sizing.
- **Dark mode:** read every color from `context.appColors` (canvas/surface/ink/hairline/brandGold/brandNavy); no hard-coded light colors. The accent rail/badges already flip via tokens.

---

## 8. Visual Design Rules

- **Navy:** reserved for the **single primary CTA** (`عرض الأقساط`) and the identity avatar gradient — not for big blocks. (Matches the account design language: navy = hero/CTA only.)
- **Gold:** accents — icon chips, status badges, accent rails, unread badge, section eyebrows.
- **Background:** warm off-white canvas (`colors.canvas`); cards `colors.surface` with `colors.hairline` borders.
- **Icon chips:** `IconChip` gold/navy/success tones, `sm` in dense contexts, `md` in cards; `filled` only for emphasis.
- **Status badges:** `StatusBadge` soft variant for status (owned/overdue/due), `dot` for live states.
- **Cards:** `PremiumCard` with `shadowSoft`/`shadowCard`, gold corner glow only on the hero and property card (not on every tile).
- **Typography:** number-forward — values bold `titleMedium`/`titleLarge`, labels muted `labelSmall`/`bodySmall`, section titles via `AppSectionHeader`.
- **Radius/shadow:** reuse `AppRadii.card/input/pillAll`; avoid heavy shadows on small tiles.
- **Anti-patterns:** no huge empty cards, no oversized icon-only blocks, no image carousels, no marketing hero, no centered toolbar title.

---

## 9. Implementation Plan (safe, incremental)

> Planning only — the steps below are for the follow-up implementation pass. Each step is small, reversible, and presentation-only.

| # | Step | Files likely to change | Risk | Acceptance criteria |
|---|---|---|---|---|
| 0 | **Verify data wiring** for property/installments on the real mobile session (no code change; debug/log) | — | None | Confirm whether My Property/installments return data; if not, mark those sections `Future data wiring needed` |
| 1 | **Premium header** (Option B): add customer Home to shell self-chrome set; new `CustomerHomeHeader` widget at top of body | `customer_shell_scaffold.dart`, new `customer_home_header.dart`, `home_screen.dart` | Med | Header shows avatar + name + `عميل · مالك وحدة` + bell w/ gold badge + profile entry; no double AppBar; safe-area correct on iOS/Android |
| 2 | **Critical payment/status card** with status accent rail | `customer_home_dashboard.dart` | Low | Overdue→error rail+badge; due→gold; none→success "all caught up"; CTAs route correctly |
| 3 | **My Property card** guaranteed visible when a property exists; multi-unit `عرض الكل` | `customer_home_dashboard.dart` | Low | Card appears directly under hero when `MyPropertyCubit` has data; all inline links route unchanged |
| 4 | **Compact metric strip** replaces the 2×2 `SummaryTile` grid | `customer_home_dashboard.dart` | Low | One-row strip, 3–4 cells ≤ ~72px tall; favorites is last/smallest; each cell routes |
| 5 | **De-duplicated service actions** | `customer_home_dashboard.dart` | Low | Only وحدتي/العقود/المدفوعات/الزيارات; no overlap with hero CTAs |
| 6 | **Recent activity** unchanged logic, restyled to sit above where discovery was | `customer_home_dashboard.dart` | Low | Max 3 maintenance updates; hides when empty; `عرض الكل` routes |
| 7 | **Remove discovery from CUSTOMER home** (keep for Guest) | `home_screen.dart` | Med | Authenticated customer sees no featured-projects/selected-units carousels; Guest home unchanged |
| 8 | **Bottom nav / FAB clearance** re-check after discovery removal | `home_screen.dart` | Low | Last card never under FAB/dock on iPhone Pro Max + small devices |
| 9 | **Quality gates** | — | None | `dart format` clean; `flutter analyze` no new issues; `flutter test` green |

**Risk notes:** Step 7 changes the customer branch of `home_screen.dart`’s `ListView` children — must remain gated by `isCustomer` so Guest discovery is untouched. Step 1 is the only structural change (AppBar suppression); everything else is body widget composition.

---

## 10. Final Implementation Prompt (ready to copy after approval)

```
You are Claude Code working in the Devora Flutter workspace.

Implement "Customer Home V2 — Ownership Command Center" for the MOBILE CUSTOMER Home only,
following MOBILE_CUSTOMER_HOME_V2_PLAN.md.

SCOPE (hard limits):
- Mobile CUSTOMER Home/Dashboard only, authenticated CUSTOMER users.
- Do NOT touch Guest home, staff/broker/supervisor apps, catalog detail pages, or any unrelated screen.
- Files you may edit:
  - apps/mobile/mobile_customer/lib/features/catalog/presentation/home/customer_home_dashboard.dart
  - apps/mobile/mobile_customer/lib/features/catalog/presentation/home/home_screen.dart
  - apps/mobile/mobile_customer/lib/features/shell/presentation/customer_shell_scaffold.dart (AppBar suppression for the customer Home branch only)
  - a NEW header widget file under .../home/ (e.g. customer_home_header.dart)
  - new localization keys in packages/core ARB files (ar + en) + regenerate, if needed

PROHIBITED:
- No backend/API/DB/Prisma/DTO/contract changes.
- No auth/session, role-routing, GoRouter behavior, or middleware changes.
- No Cubit/BLoC business-logic, repository, datasource, use-case, or model changes.
- No new dependencies.
- Do not change or remove any existing navigation destination or action.
- Use ONLY data already available to the Home route's cubits (MyPropertyCubit, InstallmentsCubit,
  MaintenanceRequestsCubit, UnreadCountCubit, FavoritesCubit). If a data point is unavailable,
  add a "// TODO: future data wiring" note instead of implementing it.

BUILD THIS (per the plan):
1. Premium in-body customer header (suppress the shell AppBar for the customer Home branch):
   avatar/initials + name + status "عميل · مالك وحدة" (fallback "عميل") + bell with gold unread
   badge → /account/notifications + profile entry → /account/profile.
2. Critical payment/status hero card with a status-colored accent rail (overdue=error, due=gold,
   clear=success "لا أقساط مستحقة"); primary "عرض الأقساط" + secondary "طلب صيانة".
3. My Property card directly under the hero whenever MyPropertyCubit has data (project, unit·code,
   status badge, contract no., signed date, plan summary; inline links to contracts/deposits/
   installments/maintenance-new with unitId; "عرض الكل" when multiple).
4. Compact priority metric STRIP (one PremiumCard, 3–4 equal cells ≤ ~72px tall): due installments
   (overdue emphasis), open maintenance, notifications, favorites (last/smallest). Each routes.
5. De-duplicated service actions (وحدتي/العقود/المدفوعات/الزيارات) as compact 2-col rows.
6. Recent activity: latest 3 maintenance updates, hides when empty, "عرض الكل" → /account/maintenance.
7. Remove the featured-projects and selected-units discovery sections from the CUSTOMER home only
   (Guest home keeps them, unchanged).
8. Keep single-source bottom padding + _fabClearance so no card hides behind the bottom nav/FAB on
   iPhone Pro Max and smaller devices.

DESIGN RULES:
- Reuse core components/tokens (PremiumCard, SummaryTile/compact cells, IconChip, StatusBadge,
  GradientAvatar, AppButton, AppSectionHeader, AppSpacing/AppRadii). Navy = primary CTA + identity
  only; gold = accents; warm canvas; all colors from context.appColors (dark-mode safe). RTL via
  start/end + PositionedDirectional. No image carousels, no marketing hero, no oversized empty cards.

VERIFY before finishing:
- dart format on changed files.
- flutter analyze for mobile_customer (no new issues).
- flutter test for mobile_customer (green).

THEN report:
- Files changed.
- Section-by-section what changed.
- Confirmation: no backend/API/auth/routing/business-logic changes and no new dependencies.
- Confirmation: all existing navigation destinations/actions preserved; Guest home unchanged.
- Any "future data wiring" TODOs added (e.g. deposits total, notifications feed).
- Analyzer/format/test results.
```

---

### Appendix — components & data already available (no new wiring)

- **Components:** `PremiumCard`, `SummaryTile`, `IconChip`, `StatusBadge`, `GradientAvatar`, `AppButton`, `AppSectionHeader`, `AppBottomNav`, `NotificationBell`, `AdaptiveAppBar`, `StaggeredColumn`.
- **Cubits at `/home` (customer):** `HomeCubit`, `MyPropertyCubit`, `InstallmentsCubit`, `MaintenanceRequestsCubit` (+ app-wide `UnreadCountCubit`, `FavoritesCubit`).
- **Entities:** `Property`, `Installment`, `MaintenanceRequest`.
- **Routes (unchanged):** `/account/property`, `/account/installments`, `/account/deposits`, `/account/contracts`, `/account/maintenance`, `/account/maintenance/new` (extra `unitId`), `/account/requests`, `/account/notifications`, `/account/profile`, `/account/favorites`, `/chat`.
- **`Future data wiring needed` (no backend change, deferred):** deposits/payments total on Home; a notifications feed list on Home.
```
