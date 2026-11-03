# Handoff — where the work stands (2026-11-02, after #242 + PR 2b)

> Read this first if you are picking up this repository in a new Claude session.
> The owner writes in Egyptian Arabic; code, commits, PRs and docs are in English.

---

## ملخص سريع (للمالك)

**إحنا فين:** خلصنا 3 جولات «سيناريوهات» كاملة على المنصة. كل جولة: نمشي سيناريوهات بيع وتحصيل حقيقية في الكود، نلاقي الأخطاء، تاخد إنت القرارات، وبعدين نصلّح على أجزاء، كل جزء PR لوحده بيتدمج لما الـ CI يخضر. آخر شغل: الجولة الرابعة (#89–#103) والتصميم الجديد U5 (#104–#107). الفرع الرئيسي (main) نضيف.

**الجولة الرابعة:** **خلصت كلها** — المراجعة واتنفّذت كل الأجزاء الأربعة (القسم 4 تحت فيه القرارات):
- **U2 فلوس:** خلص — #89، #90، #91.
- **U1 أمان وخصوصية:** خلص — #92، #93، #94.
- **U3 العميل والمهام التلقائية:** خلص — #95، #96، #97، #98 (تسليم الوحدة)، وحذف حساب العميل (آخر PR).
- **U4 التقارير:** خلص — #100، #101، وتوقيت الشركة في التقارير (آخر PR).

ملاحظة: Flutter بقى متاح في بيئة السحابة (`/opt/flutter-sdk/flutter/bin`)، فملفات الترجمة المولّدة (`packages/core/lib/src/l10n/generated/`) بتتعمل بـ `flutter gen-l10n`، و`flutter analyze` و`flutter test` بيشتغلوا محليًا قبل الرفع.

**التصميم الجديد (U5):** خلص كله. اعتمدت شكل جديد للوحة التحكم (أدمن، مبيعات، بروكر): خطوط جديدة، شريط أرقام كحلي، رأس صفحة أبسط، فلتر موحّد، جداول بهيدر كحلي، ووضع داكن — والتصميم نفسه على [هذا اللينك](https://claude.ai/artifact/UPVXRtVxEBMWpmuRMYqb1Z). اتنفّذ في #104 (الأساس والوضع الداكن)، #105 (المكوّنات المشتركة + المشاريع والمخزون والفرص)، #106 (الداشبورد بأرقام صح + صفحة التقارير)، #107 (الألوان القديمة في الداكن، الكروت، تبويب المالي، صفحات المبيعات والبروكر، صفحات التفاصيل، فلاتر البروكر). أي شاشة جديدة تتبني من المكوّنات المشتركة (القسم 3 تحت U5).

**بعد كده (من 18 لـ 23 أكتوبر، #109–#176):** القسم 2b تحت فيه كل PR. باختصار:
- **صحة الأرقام (الجولة الخامسة):** المبيعات بالسعر الصافي، ونسبة التحصيل على المستحق لحد النهارده، وإعفاء زيادة التقسيط في السداد المبكر.
- **الوحدات والمشاريع:** أنواع وحدات لكل شركة، ومواصفات الوحدة، والسعر بالمتر وإعادة تسعير مشروع كامل، ونماذج الوحدات، ومواعيد التسليم وتأخيرها.
- **العقود والدفع:** عقود اتعملت قبل السيستم، وخطة كاش، وبند غرامة التأخير في العقد، والحجز بشيك، ومدير المبيعات بيوافق على حجوزات فريقه، وكشف حساب العميل.
- **التصميم الجديد على باقي الصفحات** (#150–#160)، وصفحات المبيعات كمخطط يوم.
- **«المستحقات والالتزامات» (ليا وعليا)**، وكل كود في السيستم بيفتح صفحته.
- **دومين خاص لكل شركة** بيتربط تلقائي عن طريق Vercel.
- **الطباعة على ورق الشركة:** العقد واستمارة الحجز والإيصال، بالتوقيع والختم، ومعاها بيانات العميل الإضافية.
- **توقيع العميل على استمارة الحجز أونلاين** بكود SMS.

**قبل النشر على السيرفر:** فيه متغيرات بيئة جديدة، وmigrations بتعدّل بيانات موجودة. التفاصيل في القسم 2b تحت «Deploy notes».

**حاجات عليك إنت:** الاستضافة، تقييد مفتاح Firebase، حماية الفرع الرئيسي على GitHub، وتسميات الرسوم في تطبيقات الموبايل (محتاجة جهاز عليه Flutter).

**بعد كده (من 24 لـ 27 أكتوبر، #178–#191):** القسم 2c تحت. باختصار:
- **المساعد الذكي (AI):** باقات أسئلة للشركات، وصفحة شات في لوحة التحكم — محتاج `ANTHROPIC_API_KEY` على السيرفر.
- **تطبيق العميل باسم كل شركة:** إعدادات التطبيق عند السوبر أدمن، وبناء ملف Google Play تلقائي على GitHub — محتاج keystore وملف Firebase كـ secrets.
- **أمان:** تحديث مكتبات فيها ثغرات، وNext.js 16.4.2، وإصلاح سباقات في أكواد الدخول والتوقيع.
- **تصميم جديد:** صفحات الدخول (صورة معمارية)، «دومين الموقع» بقى عند السوبر أدمن، «خانات العميل الإضافية»، استيراد البيانات، و«الطباعة والمستندات» (4 تبويبات وشريط حفظ وشرح في المحرر).

**بعد كده (27 أكتوبر، #193–#197):** القسم 2d. باختصار: نظام المتابعة (FU1)، أسباب الخسارة وتقريرها (LR1)، والحملات التسويقية بمراحلها التلاتة (MC1–MC3): الحملات والصرف، الاستقبال التلقائي والتوزيع بالدور، والتقارير.

**بعد كده (28 أكتوبر، #198–#206):** القسم 2d. باختصار: تنبيهات المتابعة (FU2)، أزرار الاتصال والواتساب وإخفاء أرقام العملاء عن غير المسؤول (#200)، العملاء المكررين ودمجهم (#201)، التقويم بالزيارات والمتابعات وانتهاء الحجوزات وتوقيع العقود (#202)، الأجهزة المتصلة وتسجيل الخروج منها (#203)، التحقق بخطوتين بتطبيق مصادقة في لوحة التحكم (#204) وتطبيق الموظفين (#205)، وسبب الخسارة في تطبيق الموظفين (#206). كده قايمة المنافسين اللي اتفقنا عليها خلصت.

**بعد كده (28 أكتوبر → 1 نوفمبر، #199 و#210–#233):** القسم **2g** تحت. باختصار:
- **نقل البيانات من نظام تاني (#199، #217):** نظام زي «إنجاز» يبعت بيانات شركة بالـ API بمفتاح، وشاشة عند السوبر أدمن تربط القيم اللي مش متعرّفة بقيمنا مرة واحدة لكل نظام (القسم 2f).
- **الصلاحيات بقت بتفتح الصفحات (#210–#216):** الصلاحية هي اللي بتدخّل الموظف الصفحة، والصلاحيات الخطيرة للأدمن بس. صفحات الفلوس والتقارير والإدارة بتعرض الشركة كلها لمين ياخدها؛ المبيعات وبيانات العملاء بالفريق أو بتاعة المندوب. والمستندات وإجراءات الأدمن في الزيارات فضلت للأدمن (القسم 4c).
- **لوحة التحكم والموقع:** القائمة الجانبية أقسام بتتفتح وتتقفل وفيها بحث، والإعدادات في صفحة واحدة (#218)؛ صفحات المحتوى والبانرات بقت تظهر على الموقع (#219)؛ استمارة الحجز للتوقيع الإلكتروني الـ API بقى هو اللي بيجهزها (#226).
- **تطبيق الموظفين:** المتابعات (#220)، التقويم (#221)، أسماء الرسوم والغرامات بالعربي في التطبيقين (#222)، الشيكات وتسجيل الإيداع والصرف (#223، #224)، المساعد الذكي (#225)، إرسال استمارة الحجز للتوقيع (#226)، الحملات (#227)، العملاء المكررين (#228)، وصفحة «الأمان» (#229).
- **الصلاحيات في تطبيق الموظفين (#230):** الكود بيفتح الصفحة في التطبيق زي لوحة التحكم بالظبط («مراجعة الإيصالات»، «الشيكات»، «الحملات»). اتصلّح فيه قبل الدمج إن مدير المبيعات كان شايف «الشيكات» من غير الكود.
- **تحذير العميل المكرر (#232):** لما حد يضيف فرصة بإيده لعميل عنده فرصة مفتوحة، السيستم يقوله ويوريه الفرصة المفتوحة (المرحلة، المسؤول، التاريخ) ويسيبه يفتحها أو يضيف جديدة على أي حال — في لوحة التحكم وتطبيق الموظفين.
- **مراجعة التطبيقين (1 نوفمبر):** كل الطلبات اللي التطبيقين بيبعتوها للـ API موجودة، والتستات كلها شغالة. اتصلح في #233: موافقة مدير المبيعات على حجوزات فريقه من تطبيق الموظفين، وميعاد التسليم وتأخيره في صفحة العقد في تطبيق العميل. **الباقي من المراجعة في القسم 2h** (مواصفات الوحدة في التطبيقين، وصفحات المحتوى في تطبيق العميل).
- **ملحوظة:** شاشات الموبايل الجديدة اتختبرت بالاختبارات وبالرسم بس، ما اتجرّبتش على موبايل حقيقي.

**بعد كده (1 → 2 نوفمبر، #234–#242 وPR 2b):** القسم **2i** تحت. باختصار:
- **#234:** مواصفات الوحدة (المساحات، التشطيب، الإطلالة، الاتجاه، ميعاد التسليم) في التطبيقين زي الموقع.
- **#235:** بانرات الشركة وصفحاتها المنشورة في تطبيق العميل.
- **#236:** إعدادات الشركة بتقبل بس المفاتيح اللي السيستم بيقراها. **#237:** ملف `.env.example` فيه كل المتغيرات.
- **اختبار التطبيقين يدوي كامل (1–2 نوفمبر):** لقينا أعطال وحاجات شكلها مش موحّد، واتفقنا على خطة أجزاء:
  - **PR1 (#238):** الأعطال (شاشة رمادي في تطبيق الموظفين وفي الكتالوج، والمبالغ اللي جاية كنص). خلص.
  - **PR2a (#239):** أرقام إنجليزي (0-9) في كل التطبيق، وأسماء عربي للأدوار وأنواع الوحدات والأحداث، وأرقام التليفون من الشمال لليمين. خلص.
  - **PR3a (#240):** هيدر واحد بنفس الشكل في كل الشاشات في التطبيقين. خلص.
  - **PR3b (#241):** شارات المعلومات وكروت الأرقام موحّدة، ومفيش مبالغ مقطوعة ولا شارات فوق بعض، والكارت الكحلي باين في الوضع الداكن. خلص.
  - **PR3c (#242):** فورم البروكر بقى خطوات بأرقام زي فورم المبيعات، وكارت القسط في تطبيق العميل بقى واحد بنفس اسم الزرار. خلص.
  - **PR2b-1 (#243):** نصوص ملفات الترجمة بالفصحى. خلص.
  - **PR2b-2:** النصوص المكتوبة جوه الكود اتنقلت لملفات الترجمة (فصحى + إنجليزي). **مفتوح ومستني موافقتك.** بعده خطة مراجعة التطبيقين تكون خلصت.
- **قراراتك:** كل النصوص فصحى؛ التصميم الأول (3b و3c) وبعده الفصحى (2b)؛ الأرقام إنجليزي.

**مؤجّل بطلب منك (27 أكتوبر):** النشر على السيرفر، وتشغيل الحملات فعليًا. القائمة في القسم 5 تحت «Deferred by the owner».

**ليه التعديلات مش ظاهرة عندك؟** النشر على السيرفر **مش تلقائي**: ملف `deploy.yml` بيشتغل يدوي بس (`workflow_dispatch`)، وآخر مرة اشتغل كانت 18 سبتمبر. يعني السيرفر ما خدش أي حاجة من الشغل ده. ولو شغال على جهازك بعد الـ pull، الخطوات في القسم 2c تحت «Running the latest main».

**إزاي تكمّل من أكونت تاني:** افتح جلسة Claude Code على نفس الريبو، وقوله: «اقرأ `docs/HANDOFF.md`». كل الشغل لحد #247 مدموج. لو PR 2b-1 أو 2b-2 لسه مفتوح، شوفه الأول (ادمجه لو أخضر ووافقت)؛ **وبعدين ابدأ بالقسم 2i**؛ اللي فاضل في القسم 5 (حاجات مفتوحة) وحاجات عليك إنت فوق.

---

## 1. Working agreement (how this project is run)

- **Branch:** develop on the branch the session is given (last: `claude/awesome-galileo-ob9jmm`). After a PR merges, restart the branch from `origin/main` before new work.
- **One PR at a time.** Each PR is one coherent slice. Current rule (2026-11): merge only on the owner's explicit «ادمج» with CI green (squash, with the head SHA); discuss anything new before building it. Talk to the owner in simple Egyptian Arabic; when they say «ترجم» or «اشرح عربي», write fully in Arabic without English terms.
- **Every fix gets an e2e test that fails on the old code.** Verify by stashing `apps/api/src` (`git stash push --include-untracked -- apps/api/src`), running the new spec (expect failures), then `git stash pop`.
- **Every new e2e spec must be added to the `ci.yml` e2e-2 `--testPathPattern`** (the long `"…|e2e-plan-amendments"` list, ~line 429), or CI never runs it.
- **Run the full API unit suite before pushing** — mocks in unrelated specs often need a new Prisma method (e.g. `contractAmendment`, `setting.findMany`, `auditLog`).
- **Never commit `dump.rdb`** (Redis writes it to the repo root / `apps/api`). Delete it.
- Commit and PR texts must not name a model. PR bodies end with the Claude Code footer.
- Read `CLAUDE.md` — its rules (tenant scoping, migrations, security-spec vm rules, `zz_test_` objects, "never widen a security assertion") are binding.

### Local environment (cloud container)

```bash
service postgresql start; redis-server --daemonize yes      # after every container restart
pnpm install && pnpm db:generate
```

Databases: `realestate_pw` (dev) and `realestate_e2e` (tests), both at `postgresql://postgres:postgres@localhost:5432/`.

```bash
# API unit
cd apps/api && NODE_ENV=test DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
  JWT_ACCESS_SECRET=ci-access-secret-placeholder-1234567890 JWT_REFRESH_SECRET=ci-refresh-secret-placeholder-1234567890 \
  REDIS_URL=redis://localhost:6379 npx jest src

# API e2e (add the same JWT/REDIS vars)
TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/realestate_e2e?schema=public' \
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci_placeholder DEFAULT_COMPANY_ID=00000000-0000-0000-0000-000000000001 \
  npx jest --config ./test/jest-e2e.json --runInBand [pattern]

# Security suite: same env, -c test/jest-security.json --runInBand
```

- Security test **A9-2 always fails locally** (needs MinIO → 503). It passes in CI. Not a regression.
- Web-admin has no Jest; check it with `npx tsc --noEmit` and `npx eslint` inside `apps/web-admin`.
- Prettier: many files on `main` are not Prettier-clean and CI does not check formatting — don't reformat whole files.

### Migrations (no TTY here — `prisma migrate dev` can't run)

1. Write `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` (and update `schema.prisma`).
2. Apply to **both** DBs: `psql postgresql://postgres:postgres@localhost:5432/realestate_pw < …/migration.sql` and the same for `realestate_e2e`.
3. `npx prisma migrate resolve --applied <timestamp>_<name>` against each DB.
4. Verify no drift: `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --exit-code` → 0.
5. `npx prisma generate`.
- New permissions are only seeded by `seed.ts`, so a new permission also needs a migration that inserts it (see `20261016100000_approve_discount_permission`).
- `ALTER TYPE … ADD VALUE` for enums (see `20261016110000_amendment_price_reschedule`).

### Known CI flake

`report-pdf.service.spec.ts` (Chromium launch, 30 s timeout) failed on #80 and #84 and passed on re-run. If it fails again, **make the test robust** (raise the timeout / skip launch when Chromium is absent in a way that still asserts) — don't just re-run.

---

## 2. What has been done (merged PRs)

Earlier work (#18–#79): deposits linked to payment instruments and cheques, deposit reversal, company currency everywhere, branded report PDFs/XLSX via Chromium, notifications (all events, preferences, retries), cancellation with refunds, one live sale per unit, staff offboarding, broker suspension, subscription enforcement, late-payment fee setting, contract transfer (تنازل) and unit swap (تبديل), broker portal hardening, maintenance following the owner.

This session:

| PR | Slice | Main points |
|---|---|---|
| #80 | Data import | All-or-nothing, no duplicates. |
| #81 | S2 + S3 | `DepositType.FEE` for fee/penalty payments; deposits export names who paid *at payment time* (`ownerIdAt`). |
| #82 | T1 security & privacy | OTP login only for CLIENT/CUSTOMER; draft projects hidden publicly; no facets on public units; parents looked up tenant-scoped before child create; `/me/deposits` and contract documents windowed by transfer date; web-public `/api-proxy` 404s for an unknown domain (API default-company fallback kept for mobile); registration doesn't reveal existing accounts. |
| #83 | T2 money | Final (balloon) payment counted once; amounts in cents, last row takes the remainder; month-end safe `addMonths`; **per-company timezone** setting `company.timezone` (default `Africa/Cairo`) used by the overdue sweep; only signed contracts are billed (`BILLABLE_PLAN_WHERE`); payments on their way stop reminders/overdue/late fees; plan-less reservations snapshot the unit price. PR body has SQL to find old contracts that double-count the final payment. |
| #84 | T3 sales pipeline | No reassign via general PATCH; `?unassigned=1` queue for ADMIN/SALES_MANAGER; manager assigns within their team; WON only via conversion; no LOST with a live reservation; reservation credited to the lead's rep; returning website visitor with a closed lead gets a new lead; no double-booked visits. |
| #85 | T4 inventory & pricing | No deleting a building/phase/unit with deals; live-deal units can't change price/details; RESERVED never manual, SOLD needs a reason; **discount cap** setting `pricing.maxDiscountPct` + permission `pricing:approve-discount`; plan template price must equal unit price; archived projects can't be reserved/sold. |
| #86 | T5 plan changes | `POST contracts/:id/price` (price change; unpaid rows absorb it; discount cap applies), `POST contracts/:id/reschedule` (unpaid monthly rows spread over N months, total unchanged, old rows CANCELLED), `POST deposits/batch` (one cash/transfer payment for several installments), `POST deposits/settle` (early settlement). Contract page has a "Payments & plan changes" section. e2e `e2e-plan-amendments`. |

### 2b. After round 5 (#114–#176, 2026-10-18 → 2026-10-23)

Rounds 4 and 5 (#89–#113) are described in sections 3 and 4b. Everything after them:

| PR(s) | Slice | Summary |
|---|---|---|
| #114 | Company time zone on the web | `GET /company/currency` also returns `company.timezone`. The reports' default month, the sales/performance month and the dashboard greeting use it, not UTC. e2e `e2e-w3-company-timezone`. |
| #115 | Project/phase/building codes | The forms send the required `code`, uppercased. A taken code returns 409, not 500, and validation messages are in Arabic. |
| #116 | Count-priced plans are sellable | Plans priced by instalment count get a reservation snapshot, with the new `Reservation.snapshotFrequency`. Conversion spaces the rows by that frequency. e2e `e2e-x2-count-plans`. |
| #117 | Sign from the contract page | Admins can sign a live unsigned contract from its page (`signContractAction`). |
| #118 | Super-admin company page | The page opens again; it reads `userCount`. |
| #119 | Due dates are days | The down payment is due on the conversion day in company time (`localDayAfter()`). A migration moves timed due dates to their day. |
| #120–#121 | Visits and funnel | Upcoming visits leave out final statuses. The sales funnel is a cohort of the period's leads, so no rate goes above 100%. |
| #122 | Clawbacks owed | `clawbacksOwed` is on the financial dashboard's liabilities and in its CSV. |
| #123 | Role default permissions | New staff and new companies get their role's permissions (`permissions/role-default-permissions.ts`). |
| #124 | Broker activation | An invited agent becomes ACTIVE on first portal use. A pending firm says so and has «تفعيل الشركة». |
| #125 | Payment method on the contract page | `PaymentMethodFields` and `depositPayload`. Instalments are paid in full only. |
| #126 | Booking paid by cheque | The booking waits in PENDING_CLEARANCE. A cleared cheque pays it; a bounced one leaves it unpaid. |
| #127 | Typed times are the company's | `wallTimeToIso(value, tz)` and `nowWallTime`. |
| #128 | Waiver and swap keep the down payment | Changes touch the instalments and final payment only. `markupLeft` feeds the swap form. |
| #129 | Late-fee clause per contract | `Contract.lateFeesApply` and `PATCH /contracts/:id/late-fee-clause`. Nothing is charged before the contract was entered. `lateFee.enabled` is now only the default for new contracts. |
| #130 | No manual SOLD | Unit create, status change and import refuse SOLD/RESERVED without a deal. |
| #131 | Lead sources | Managed from the dashboard («مصادر العملاء»). A lead must use one of the company's active sources; defaults are seeded. |
| #132 | Expired session | The user goes to `/login?expired=1`. |
| #133 | Plan features | `GET /capabilities/me` hides maintenance and broker pages the company's plan lacks. |
| #134 | Known settings | `known-settings.ts` lists the keys the API reads, with Arabic names. The settings API itself still accepts any key. |
| #135 | Public site contacts and cities | WhatsApp and phone come from branding; `GET /public/projects/cities`. |
| #136 | Permission catalog in code | `permission-catalog.ts` and `PermissionCatalogBootstrap` write missing codes at startup and create the first SUPER_ADMIN from env. A unit test fails when a controller uses a code missing from the catalog. |
| #137 | Manager approves reservations | A SALES_MANAGER approves or rejects the team's reservations, never their own. Reps book as themselves. |
| #138 | Cash plan | A template marked cash has one down-payment row and no instalments. |
| #139–#140 | UI details (F4–F38) | Paid-plan companies start ACTIVE; permissions link; no fake figures; lead assignment; dates; proof queue; refusal reasons; handover confirm; warranties; broker leads. |
| #141 | Contracts signed before the system | Entered with their real signing date and no commission, bonus or notifications. Past payments can be marked in one go. |
| #142–#143 | Unit types and specs | `UnitType` per company with a usage (shops, offices, clinics, garages) and `/unit-types`. Unit specs: finishing, net/garden/roof/terrace/land areas, view and orientation. |
| #144–#145 | Price per meter | Price = per-meter price × area. `POST /units/reprice` reprices a project, phase or building, with a preview. |
| #146 | Unit models | `UnitModel` per project; picking a model fills the unit form. |
| #147–#149 | Handover dates | `Phase.deliveryDate`, `Unit.deliveryDate` and `effectiveDeliveryDate`. The contract keeps the date it promised (`Contract.deliveryDate`). `deliveryDelayDays` and `?deliveryDelayed=true`; the customer gets `delivery_delayed_customer` once per slip. #148 adds project type, district, total area and licence number. |
| #150–#160 | Premium redesign of the remaining pages | Operations center, financial report, audit log, users, settings, permissions, notifications (send and templates are admin-only), reservation and contract pages, projects/units, sales targets, leads/clients, visits, cheques, payments, maintenance, commissions, broker reports/payouts, CMS, documents, branding and the broker portal. #158: sales and manager homes as a day planner. #156: full demo seed (`pnpm db:seed:full-demo`, tagged DEMO-FULL, `--cleanup`, refuses production). |
| #161 | Payment states and statement | `depositState()` gives each payment one state. `GET /contracts/:id/statement` and the print page `/print/statements/:id`. The contract page has tabs (`?tab=`). |
| #162–#164 | Financial report and dashboard add up | Signed contracts only. The portfolio split (paid + awaiting + late + not due + not on a schedule = value) is shared by the report and the dashboard (`portfolio-split.ts`). Unsigned contracts have their own panel, and the needs-action tile counts those with a payment due. |
| #165 | Finance audit | The collection rate is counted on schedule rows of signed contracts. A booking is paid once (atomic claim). Cheque status changes are conditional, and a cheque clears all its rows or none. Late fees start at signing. Commission approve/cancel are conditional. No cancel while a customer proof waits. Customer and broker views match the ledger (FA6). The seeds add up (`prisma/seed-schedule.ts`). |
| #166 | Manual cancellation decided later | `POST /contracts/:id/cancellation-decision` applies CLAWBACK/RETAIN to the commission and bonus later. A booking cheque returned after signing reverses the deposit and adds a booking row to the schedule. |
| #167 | Ledger, links, loaders | «المستحقات والالتزامات» (Receivables & Payables): `GET /reports/ledger` and `/reports/ledger/rows`, page `/dashboard/ledger`; e2e FA10 reconciles it with the report. `EntityLink` makes codes and names open their pages. Shimmer loaders in each page's shape. Chromium gets 60 s to start. |
| #168 | Custom domains via Vercel | `VercelDomainsClient` adds the domain (and `www` for an apex) to the web-public project and removes it on delete. `DomainCheckCron` runs every 10 minutes. The admin Domains page shows the DNS records. |
| #169 | Print identity, paper and wording | Customer national ID/passport and address on the contract. Company paper, signature and stamp (PNG/JPEG ≤ 512 KB, stored in the DB). Wording templates with `{{placeholders}}`. `/company/print-settings`, `/document-templates`, page `/dashboard/company/print`. |
| #170 | E-sign the booking form | `SignatureRequest`: a single-use link valid 72 h (only its hash is stored) and a 6-digit SMS code (10 min, 5 tries). Evidence kept: time, IP, device and document hash. Staff use `/reservations/:id/signature-requests`; customers use web-public `/sign/[token]` (public endpoints are rate-limited). |
| #171 | Extra customer data and form layouts | Fixed customer details plus company-defined `CustomerField` (`{{custom.<key>}}`). `FormLayout` designer at `/dashboard/company/print/forms` (pdf.js in the browser) for the booking form and the receipt. |
| #172 | Company contract form | Contracts print on the company's own form (up to 40 pages). The customer's box is left for an ink signature. |
| #173 | Self-hosted fonts | Both web apps serve fonts from `public/fonts` (`src/app/fonts.css`), not Google Fonts. |
| #174–#176 | Form designer fixes | Arabic upload errors, a new form is named after its document, the designer says why save is off, values stay on one line, a missing value prints blank. |

**Deploy notes (new since #113):**
- **API env (optional):**
  - `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (12+ characters), `SUPER_ADMIN_NAME`: create the first platform owner at startup when none exists; an existing one is never changed. Listed in `apps/api/.env.example`.
  - `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (the web-public project), `VERCEL_TEAM_ID` (team projects): automatic custom domains. **Not yet in `.env.example`.** Without them, domains are added to Vercel by hand as before.
- **24 migrations** (`20261018120000` … `20261023140000`). Several change existing data:
  - due dates moved to company days;
  - role-default permissions for staff with no codes;
  - the late-fee clause for companies with `lateFee.enabled`;
  - default lead sources;
  - manager approve/reject permissions;
  - paid-plan TRIAL companies moved to ACTIVE;
  - default unit types, with existing units matched to them;
  - `BonusEntry.approvedAt` backfilled.
  
  Take a backup, then run `pnpm db:deploy` and `pnpm db:schema-check`.
- **Permission catalog:** written at startup, so production no longer needs the seed for permissions.
- **Storage (R2/MinIO):** must be reachable from the browser, with CORS allowing the admin site, or form-page uploads fail.
- **E-sign:** the SMS goes through the existing OTP provider, and the signing link uses the company's primary domain on web-public.
- **Who can use the new screens:**
  - Ledger: ADMIN + `reports:financial:read`.
  - Unit types: ADMIN + `settings:write`.
  - Customer fields and form layouts: `company_branding:manage`.
  - Domains: ADMIN.
  - E-sign requests: ADMIN, SALES_MANAGER or SALES.

**Decisions recorded in this stretch (owner):**
- Partial instalment payments stay unsupported (2026-10-18).
- Late fees apply only when the contract has the clause, and never to rows due before the contract was entered (2026-10-18).
- A unit is SOLD only by a contract; a sale made before the system is entered as a contract (2026-10-18).
- Owed money is late from the day it became owed (ledger, 2026-10-22).
- The operations-center shortcuts were removed and the sales/manager homes redesigned from scratch, both at the owner's request.

Shared helpers worth knowing (API): `common/utils/add-months.ts`, `common/time/company-timezone.ts`, `common/finance/*` (`COLLECTED_DEPOSIT_WHERE`, `BILLABLE_PLAN_WHERE`, `LIVE_CONTRACT_WHERE`), `installments/discount-policy.ts`, `projects/inventory-blockers.ts`, `common/ownership/ownership.service.ts`, `contracts/contract-amendments.service.ts` (`rescaleUnpaid`, `followNewPrice`, `liveContract`, `assertNoWaitingPayments`).

---

### 2c. #178–#191 (2026-10-24 → 2026-10-27)

| PR | Slice | Main points |
|---|---|---|
| #178 | AI1 | AI assistant packages (questions per month), company activation / top-up / renew ledger, usage counter, 80% / 100% / ending alerts; annual subscription 30-day notice. |
| #179 | AI2 | Assistant API on Claude: read-only tools scoped by tenant and role; one question counted per ask. |
| #180 | AI3 | Assistant chat page in web-admin (`/dashboard/assistant`) and usage card. |
| #181 | Security | Next.js 16.4.0 → 16.4.2 in web-admin and web-public. |
| #182 | Security | Vulnerable dependencies patched (3 critical + 64 high → 0 critical + 5 high). |
| #183 | MA1 | Each company's own customer app: settings kept by the platform owner (super-admin API + panel, icon upload). |
| #184 | MA2 | The Flutter customer app builds as one company's own app. |
| #185 | MA3 | `.github/workflows/company-app.yml` builds a signed App Bundle (AAB) per company for Google Play; the build file downloads from the panel. |
| #186 | MA4 | Push, store links and app links for a company's own app. |
| #187 | Round 6 | Races on sign-in codes, e-sign codes and the AI ledger. |
| #188 | Design | Sign-in pages (`components/auth/auth-shell.tsx`, `auth-fields.tsx`): full-bleed photo `public/brand/login-hero.jpg`, fixed colours in light and dark. |
| #189 | D1 | «دومين الموقع»: connecting a company's domain moved to the super-admin company page (`super-admin/companies/:companyId/domains`); the company admin only sees it on the branding page. `/dashboard/company/domains` was removed. |
| #190 | Design | «خانات العميل الإضافية» (ready-made fields, dialog with live preview and print code `{{custom.key}}`, switch, drag to reorder) and the data import page (stepper, drop zone, sticky confirm bar). |
| #191 | Design | «الطباعة والمستندات»: tabs `?tab=paper|seal|forms|wording`, sticky save bar, and a guide panel in the form and wording editors. |

**Deploy notes (new since #177):**
- **API env:** `ANTHROPIC_API_KEY` (unset → the assistant answers 503 and counts nothing), optional `AI_MODEL`, `AI_EFFORT` (low|medium|high|xhigh|max). Listed in `apps/api/.env.example`.
- **GitHub secrets for company apps:** `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`, `ANDROID_UPLOAD_STORE_PASSWORD`, `FIREBASE_CUSTOMER_GOOGLE_SERVICES_JSON`. iOS company apps are not done.
- **3 migrations:** `20261024120000_ai_assistant_plans`, `20261025090000_company_mobile_app`, `20261025170000_company_mobile_app_links` (additive). Run `pnpm db:deploy` then `pnpm db:schema-check`.
- **Deploys are manual.** `.github/workflows/deploy.yml` runs only on `workflow_dispatch` (Actions → "CD — Deploy to Production" → Run workflow, service `all`); its last run was 2026-09-18, so production has none of #114–#191. Run the migrations of 2b and 2c (backup first) before or with that deploy.

**Running the latest main on your own machine** (when merged work "doesn't show"):

```bash
git checkout main && git pull          # git log -1 should show the newest merged PR
pnpm install                           # #181/#182 changed dependencies
pnpm db:generate && pnpm db:deploy     # new Prisma client + new migrations
rm -rf apps/web-admin/.next apps/web-public/.next
pnpm dev                               # restart: API :4000, admin :3001, public :3002
```

Then hard-refresh the browser (Ctrl+Shift+R). Being on another branch (e.g. an old `claude/*` branch, which is reset after each merge) is the other usual cause.

### 2d. #192–#206 (2026-10-27 → 2026-10-28)

| PR | Slice | Main points |
|---|---|---|
| #192 | Docs | This file. |
| #198 | FU2 | Follow-ups reach the rep: a push 15 minutes before a lead's next action, an overdue alert 30 minutes after it (`follow-up-reminder.cron.ts`, once per follow-up time via `Lead.followUpRemindedFor/OverdueFor`), and a morning list at the company's 09:00 (reps: today + overdue; sales managers: their team). The customer page lists the customer's leads with the latest activity and next follow-up (`lastNote` on the leads list). |
| #193 | FU1 | Follow-ups: `Lead.nextActionAt/Type/Note`; notes carry kind (call, meeting, WhatsApp…), call result, a next action and one-level replies; `GET leads/follow-ups(/summary)`; `/dashboard/follow-ups` page, nav badge (overdue + today). |
| #194 | LR1 | Lost reasons per company (10 defaults, admin keeps the list), required when a lead is marked LOST; `GET leads/lost-report`; `/dashboard/lost-reasons`. |
| #195 | MC1 | Marketing campaigns: `Campaign`, `CampaignSpend` (by date), `Lead.campaignId`, `campaigns:manage`; tracking links; website leads linked by `utm_campaign`. |
| #196 | MC2 | Automatic lead intake: `LeadIntakeKey`, public `POST /v1/intake/:slug/leads` (Zapier / Make), round-robin over active SALES users (`leads.autoAssign`, `leads.roundRobinCursor`), first call (`leads.firstCallMinutes`); website leads routed the same way. |
| #197 | MC3 | Campaign reports (`GET campaigns/report` + PDF / Excel; first-touch sales and revenue, CPL, CPA, ROI, by channel / project / month); the Facebook channel is «ميتا (فيسبوك + إنستجرام)» with leads split by platform (`utm_source={{site_source_name}}`); web-public keeps ad tags from any landing page for 30 days. |
| #199 | MG1 | Data migration API (merged 2026-10-28 after the steps in 2e; design in 2f). |
| #200 | QA1 + MP1 | Call / WhatsApp buttons on leads (`POST leads/:id/contact` logs each tap, then the activity form opens); customer phones masked for anyone who is not responsible for the lead (`common/utils/contact-mask.ts`). |
| #201 | DUP1 | «العملاء المكررين»: open leads that share a customer (`GET leads/duplicates`), merged into one (`POST leads/:id/merge`: notes, activity, visits, chats move; a lead with a reservation or a broker is never merged away). |
| #202 | CAL1 | «التقويم» (`GET leads/calendar`): visits, follow-ups due, logged calls, reservation expiries and contract signings, a month at a time, in the caller's scope; rep filter for admins and managers. |
| #203 | SES1 | Sessions: `AuthSession` (each sign-in; refresh tokens rotate inside it); the access token carries `sid`, so ending a session cuts that device off at once. «الأمان والأجهزة» page (own devices, sign out one / all others, password change); admin `GET/POST users/:id/sessions(/revoke)`; logout ends the session on the server. |
| #204 | TFA1 | Two-step sign-in with an authenticator app (TOTP, RFC 6238). Optional per user; the admin can require it of admins or all staff (`security.require2fa`). Password → 5-minute challenge → `POST auth/2fa/verify`; setup during sign-in when required; ten one-use recovery codes; 5 wrong codes lock 15 min; admin reset for a lost phone. Secrets sealed with AES-256-GCM. |
| #205 | TFA2 | The staff mobile app handles the code step, the setup step (open in the authenticator app / copy the key) and the recovery codes. |
| #206 | LR2 | The staff mobile app asks why a lead is lost (company's active reasons, required; optional note) and shows it on the lead. |

**Deploy notes (new since #191):** 9 migrations, all additive except where noted — `20261027090000_lead_follow_ups`, `20261027150000_lost_reasons` (seeds reasons, backfills `lostAt`), `20261027180000_marketing_campaigns`, `20261028090000_lead_intake`, `20261028150000_follow_up_reminders`, `20261028180000_lead_contact_opened`, `20261028200000_lead_merged`, `20261028220000_auth_sessions`, `20261028230000_two_factor` (plus #199's, renamed to `20261029090000_data_migration` — see 2e — and MG2's additive `20261030090000_migration_mapping`). API env: `PUBLIC_API_URL` (the intake address shown to Zapier; falls back to `API_BASE_URL`); optional `FOLLOW_UP_REMINDERS_ENABLED`, `FOLLOW_UP_DIGEST_HOUR`; **`TOTP_ENCRYPTION_KEY`** (seals two-step secrets; if unset a key is derived from `JWT_REFRESH_SECRET`, and rotating that secret would then switch everyone's two-step sign-in off — set it once, before anyone turns 2FA on, and keep it).

**Known limits:** two leads arriving at the same instant may go to the same rep; WhatsApp and phone leads are tied to a campaign by hand; a lead created by hand for a customer with an open lead now asks first (DUP2, #232), and the duplicates tab still catches older ones; web-public does not pass the browser's user agent, so customer sessions show the server's (customers have no devices page); the staff app's "open in authenticator app" was not tried on a real device.

**Competitor-gap backlog:** done (#200–#206). Resale/rentals is the owner's call. Academy, jobs and a social timeline are not wanted.

### 2e. Merging #199 (MG1 — data migration API, other account) — step by step (done: #199 merged 2026-10-28)

> For the Claude session on the other account that owns #199 (branch `claude/awesome-galileo-ob9jmm`). Since it was opened, `main` moved by #198 and #200–#206. **This was rehearsed on 2026-10-28 against `main` at `f2615e6`:** merging `main` into the branch conflicts in exactly two files, and after the steps below the API typechecks, the unit suite passes (176 suites / 2,679 tests), e2e `e2e-mg1-data-migration` passes next to `e2e-tfa1-two-factor`, `e2e-ses1-sessions` and `e2e-isolated-apps`, the security suite passes except A9-2 (needs MinIO; local only), and web-admin typechecks.

1. **Bring `main` in (merge, never rebase or force-push):**
   ```bash
   git fetch origin main claude/awesome-galileo-ob9jmm
   git checkout claude/awesome-galileo-ob9jmm
   git pull origin claude/awesome-galileo-ob9jmm
   git merge origin/main
   ```
2. **Resolve `.github/workflows/ci.yml`** (the e2e-2 `--testPathPattern` line): take `main`'s line as it is and add `|e2e-mg1-data-migration` at the end, before the closing quote. It must end `...|e2e-cal1-calendar|e2e-ses1-sessions|e2e-tfa1-two-factor|e2e-mg1-data-migration"`. Nothing else in the file conflicts.
3. **Resolve `docs/HANDOFF.md`:** take `main`'s version of the whole file (it already lists #199 in 2d and has this section). Then move the MG1 text from your side into a new section **2f. MG1 — design and next steps** right after this one: the "MG1 design (owner-approved 2026-10-27)" paragraph, the "MG1 deploy" paragraph (with the new migration name from step 4) and "Next — MG2". Drop your old "Competitor-gap backlog" line; it is done.
4. **Rename the migration so it runs after `main`'s.** `main` now has five migrations later than `20261028120000` (`20261028150000_follow_up_reminders`, `20261028180000_lead_contact_opened`, `20261028200000_lead_merged`, `20261028220000_auth_sessions`, `20261028230000_two_factor`). Left as is, MG1's would sit before migrations that databases have already applied. Production has run none of them yet (the deploy is deferred), so renaming is safe:
   ```bash
   git mv apps/api/prisma/migrations/20261028120000_data_migration \
          apps/api/prisma/migrations/20261029090000_data_migration
   ```
   Change the name everywhere it is written: the PR body's "Deploy" section, and the HANDOFF text from step 3. The SQL does not change.
5. **Fix your local databases** (each one where the old name was registered, e.g. `realestate_pw` and `realestate_e2e`):
   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/<db>" -c \
     "UPDATE \"_prisma_migrations\" SET migration_name='20261029090000_data_migration' WHERE migration_name='20261028120000_data_migration';"
   ```
   Then apply `main`'s five migrations by the strict order in CLAUDE.md for each one: `psql -v ON_ERROR_STOP=1 < migration.sql`, then `npx prisma migrate resolve --applied <name>`. Then `pnpm db:schema-check` must exit 0, and run `pnpm db:generate`. (The e2e database is rebuilt by its global setup anyway.)
6. **Check before pushing:**
   ```bash
   pnpm --filter @rep/api exec tsc --noEmit -p tsconfig.json
   pnpm --filter @rep/api exec jest src            # needs JWT_ACCESS_SECRET / JWT_REFRESH_SECRET set
   # e2e (TEST_DATABASE_URL on an *_e2e database, --runInBand):
   pnpm --filter @rep/api exec jest -c test/jest-e2e.json --runInBand \
     --testPathPattern "e2e-mg1|e2e-tfa1|e2e-ses1|e2e-isolated-apps"
   pnpm --filter @rep/api exec jest -c test/jest-security.json --runInBand
   pnpm --filter web-admin exec tsc --noEmit
   ```
   Expect the counts above. The tenancy tests do not need changing: #203 added `AuthSession` as `TENANT_VIA_RELATION`, so your TENANT_OWNED count of 70 stays right.
7. **Commit the merge and push normally** (`git commit`, then `git push origin claude/awesome-galileo-ob9jmm`, no force). Wait for CI to go green on the new head, then tell the owner it is ready; **the owner approves the merge** (squash).
8. **After it merges**, add the deploy note to the production checklist in section 5: the migration `20261029090000_data_migration` runs with the others, and the other system needs `PUBLIC_API_URL`.

### 2f. MG1 — design and next steps

**MG1 design (owner-approved 2026-10-27):** one generic format for every system, not tied to Engaz. Records are matched by the other system's id (`MigrationRecord`, unique per company + `sourceSystem` + entity + `externalId`), so sending again updates; each record is checked on its own; `?dryRun=true` rolls each record back. Any field not in the format, and values not recognised (stage, source, unit type, person, activity kind), are kept on the record (`extra`, `unmapped`) — never guessed. Unknown stage → NEW; unknown source → «نقل بيانات»; units sold or booked over there are refused (decision 2026-10-18: SOLD only by a contract). Moved-in data sends no notifications and is not handed out. Phase 1 scope: no contracts, instalments or payments (Engaz has none).

**MG1 deploy:** one additive migration, `20261029090000_data_migration`. The other system needs the public API address (`PUBLIC_API_URL` on web-admin, else `API_BASE_URL`, is what the panel shows).

**MG2 — the mapping screen (done):** on the super-admin company page, under the migration panel, «ربط البيانات المحفوظة» lists per system each kept value and each extra field, with how many records carry it. The platform owner chooses once what each becomes:
- Kept values: lead stage, activity kind and call result (saved for the whole system: `MigrationMapping.companyId` null); lead source, lead owner, activity author and unit type (saved per company). Extra fields: a customer's into one of the company's customer fields; a lead's into a note on the lead (written once); anything else can only be ignored.
- A choice applies to the records already moved, but never over a hand change (owner, 2026-10-30): a lead's stage only while still «جديد», its source only while still «نقل بيانات», its owner only while unassigned; an activity's kind only while still a note; a unit's type only while still the company's first type and the unit still available; a customer field only where the customer has none. An activity's author applies to later sends only. Later sends use the choices directly; the raw value stays under `unmapped` on the record.
- Matching now ignores Arabic diacritics and tatweel too («جداً» = «جدا»).
- API: `GET/PUT super-admin/companies/:companyId/migrations/mapping` (`MigrationMappingService`). Model `MigrationMapping` (PLATFORM_GLOBAL, nullable companyId); migration `20261030090000_migration_mapping`. e2e `e2e-mg2-migration-mapping`.

**Next (not started):** the same mapping on any Excel/CSV file from any system; later, if wanted, contracts/instalments/payments, and the reverse (a company taking its data out over the API).

### 2g. #199, #210–#232 (2026-10-28 → 2026-11-01)

| PR | Slice | Main points |
|---|---|---|
| #199 | MG1 | Data migration API: `POST /v1/migration/:slug/{projects\|units\|customers\|leads\|activities}` with a key the platform owner makes on the company page; matched by the other system's id, `?dryRun=true`, nothing lost (`extra` / `unmapped`). Format: `docs/DATA_MIGRATION_API.md`. See 2f. |
| #210 | PRM1 | `@GrantedBy(code)` lets a staff member into a route outside its `@Roles` when they hold the code; admin-only codes in `common/permissions/staff-codes.ts` (refused on assignment, ignored if held); `GET /me/permissions`; web-admin nav and pages read the codes. Opened: projects/phases/buildings/units/media, campaigns + intake, lead sources + lost reasons, CMS, notification templates and sending. See 4c. |
| #211 | PRM2a | Reports open by `reports:sales\|operational\|financial:read`, with the admin's figures. |
| #212 | PRM2b | Contracts and payments: a rep sees their own sales, a manager their team's; `contracts:read:all` / `deposits:read:all` (in no starting set) open the whole company's. Helper `common/permissions/company-wide.ts`. |
| #213 | PRM2c | Cheques open by `payment-instruments:manage` (bounce stays admin); bonus: own/team by default, `bonus:entries:read:all`, `bonus:rules:manage`, `bonus:entries:create`; approve/pay stay admin. |
| #214 | PRM2d | Broker leads and reservations are sales data (own/team; before, every rep saw every broker lead with phones); broker admin pages open by their codes; suspending, approvals, payouts and invites stay admin. |
| #215 | PRM2e | Maintenance: `maintenance:manage:all` opens the dashboard's maintenance (whole company); supervisors keep their own requests. |
| #216 | PRM2f | Unit export by `units:export`; documents and the admin visit actions stay admin-only (owner's decision). |
| #217 | MG2 | Mapping screen «ربط البيانات المحفوظة» on the super-admin company page; choices apply to moved records only where nobody changed them by hand. `MigrationMapping`; `GET/PUT super-admin/companies/:id/migrations/mapping`. See 2f. |
| #218 | web-admin | Sidebar in collapsible sections with search (Ctrl/⌘+K); one settings page `/dashboard/setup`. Same visibility rules. |
| #219 | CMS1 | Banners (rotating strip on the site home) and published pages (`/pages/<slug>`, `GET /public/pages`, footer and sitemap) reach web-public; page/article slugs unique per company; link and image URLs validated. |
| #220 | Staff app | Follow-ups: log a call/meeting/WhatsApp with result and next follow-up; «المتابعات» overdue/today/upcoming; home card; morning list opens it. |
| #221 | Staff app | «التقويم»: a week strip with visits, follow-ups, reservation expiries, contract signings and logged calls. |
| #222 | Mobile | Fees and penalties named in Arabic in both apps (`FEE`, bounce penalty, late fee, transfer fee); staff payments list names the booking amount. |
| #223 | Staff app | «الشيكات» list and detail (admin and sales manager). Fixed: leads, visits and follow-ups lists stopped at 20 (read `meta` for paging). |
| #224 | Staff app | Cheques: «اتودّع في البنك» and «اتصرف» (with clearing date) from the phone; bounce/cancel/replace stay on the dashboard. |
| #225 | Staff app | The AI assistant chat (`GET /ai/status`, `POST /ai/ask`), with quota and error states. |
| #226 | E-sign | The booking form for e-signature is built by the API (`e-sign/document/booking-document.ts`; a client can no longer send its own document); the staff app sends it, shows the link, resends, cancels, and shows the signature. The dashboard's print page keeps its own copy of the printing code — a change to the booking form must be made in both. |
| #227 | Staff app | Campaigns: picker on a new lead, the campaign on the lead, managers' list and detail (read-only). |
| #228 | Staff app | Duplicate leads: keep one and merge the others (admin, and a manager for their team). |
| #229 | Staff app | «الأمان»: devices (sign out one / all others), two-step sign-in (turn on/off, recovery codes), password change. |
| #230 | Staff app PRM | The app reads `GET /me/permissions` after sign-in/restore (cleared at sign-out; on failure the role alone decides). `StaffAccess` (`features/permissions/staff_permissions.dart`): «مراجعة الإيصالات» → `deposits:read:all`, «الشيكات» → `payment-instruments:manage` (admin or the code — a SALES_MANAGER does not start with it), «الحملات» → `campaigns:manage`. e2e PRM2c-5. |
| #231 | Docs | This file after #229. |
| #232 | DUP2 | Warning when a lead is added by hand for a customer who already has an open lead: `POST /leads` → 409 `OPEN_LEAD_EXISTS` with `leads[]` (id, stage, owner, createdAt); `allowDuplicate: true` adds it anyway and the `created` activity records `duplicateOf`. Never asked for a new customer or one whose leads are all WON/LOST; lead intake passes `allowDuplicate` (it handles returning customers itself). web-admin `components/crm/open-lead-warning.tsx`; staff app `open_lead_sheet.dart`. e2e `e2e-dup2-open-lead-warning`. Any new code that creates a second lead for a client on purpose must send `allowDuplicate: true`. |
| #233 | Staff app | A sales manager approves or rejects a team member's pending reservation from its page (never their own; the admin always), as on the dashboard (F17). Reject takes an optional reason. `reservation_decision_card.dart`; the API side is `e2e-cc1-manager-approval`. |
| #233 | Customer app | Handover dates (F10): `GET /contracts/me/contracts` returns `deliveryDate` (promised), `expectedDeliveryDate` and `deliveryDelayDays` (shared `deliverySlip()` in `contracts.module.ts`); the contract page shows them until the handover. `delivery_delayed_customer` now carries `entityType: 'contract'`, and it and `unit_handed_over` open the contract. e2e EE7-4. |

**Deploy notes (new since #206):** 3 more migrations — `20261029090000_data_migration`, `20261030090000_migration_mapping`, `20261101090000_cms_slug_per_company` (drops and creates indexes only). The data migration needs `PUBLIC_API_URL`. New e2e specs are in the CI e2e-2 list (`e2e-mg1`, `e2e-mg2`, `e2e-prm1`, `e2e-prm2a`–`e2e-prm2f`, `e2e-cms1-pages-banners`).

**Not yet done:** the new staff-app screens were checked by tests and by rendering them, not on a real phone against a real server. The DUP2 warning on the dashboard has no Playwright test. No PR is open after #233.

**Local-only test failures (not real):** security A9-2 needs MinIO; the e2e reservation race test in `e2e-maintenance` fails locally on clean `main` too. Both pass in CI.

**Before pushing mobile changes, also run `flutter test` in `packages/core`:** its `l10n_completeness_test` fails when a parameterised ARB key has `@key` placeholder metadata in English but not in Arabic (both files need it). Add new ARB keys by appending text, not by re-dumping the JSON (that reformats the whole file).

### 2h. Next up — mobile catch-up (from the 2026-11-01 check)

The owner asked whether the two apps keep up with the dashboard and the website. Checked: every endpoint the apps call exists in the API (56 customer, 104 staff); all tests and `flutter analyze` pass; payment states (cheque waiting, reversed, bounced) show right in the customer app. Fixed in #233: manager reservation approval (staff app) and handover dates (customer app). **Left, in this order** — one PR each, owner approves each merge:

1. **Unit specs in both apps' catalog.** The website shows them (`apps/web-public/src/components/units/UnitSpecs.tsx`, labels in its `src/messages`); neither app does. Fields: `netArea`, `gardenArea`, `roofArea`, `terraceArea`, `landArea`, `finishing`, `view`, `orientation`, and the handover date (`deliveryDate` on the public unit = `effectiveDeliveryDate`).
   - Customer app: `GET /public/units` and `/public/units/:id` (serialized by `apps/api/src/modules/units/public-unit.serializer.ts`, which already includes them). Data source: `mobile_customer/lib/features/catalog/data/datasources/catalog_remote_data_source.dart`.
   - Staff app: `GET /units` and `/units/:id` (full unit, plus `effectiveDeliveryDate`). Data source: `mobile_staff/lib/features/catalog/data/datasources/staff_catalog_remote_data_source.dart`.
   - Show only the specs a unit has (as `UnitSpecs.tsx` does); finishing/view/orientation values need ar/en labels in `packages/core` ARB files (copy the website's wording).
2. **Content pages and banners in the customer app** (#219 on the website): `GET /public/banners`, `/public/pages`, `/public/pages/:slug` (`apps/api/src/modules/cms/cms.module.ts`). Banners on the home screen; pages from the account/profile menu.
3. **Optional:** the customer's contract page could link to an account statement; today `GET /contracts/:id/statement` is staff-only.

**Important before shipping new app builds:** production has not been deployed since 2026-09-18 (deferred by the owner). New app builds call endpoints the old server lacks (`/me/permissions`, follow-ups, two-step sign-in, …), so the apps must ship together with, or after, the server deploy.

**Other open items the owner has not decided yet** (ask before starting; the settings-key and `.env.example` items are done in #236/#237): chasing an unsigned contract's due rows; counting a MANUAL cancellation's commission/bonus as a possible liability; showing the customer's national ID/address/extra fields to the broker; e-signing the contract itself (large).

### 2i. #234–#242 and PR 2b (2026-11-01 → 2026-11-02) — mobile QA and polish

Items 1 and 2 of 2h are done (#234, #235); the two small items at the end of 2h are done (#236, #237).

| PR | Slice | Main points |
|---|---|---|
| #234 | Mobile | Unit specs in both apps' catalog (areas, finishing, view, orientation, handover date), only the ones a unit has; labels in core ARB files. |
| #235 | Customer app | The company's banners on home, published pages from the account menu (`/public/banners`, `/public/pages`). |
| #236 | API | `PUT` settings accepts only keys in `SETTING_VALIDATORS` (400 `"<key>: unknown setting"`); security DS-10. |
| #237 | API | `apps/api/.env.example` lists every variable the API reads (`PLATFORM_BASE_DOMAIN`, `DOMAIN_DNS_TIMEOUT_MS`, `VERCEL_*`, `PUBLIC_WEB_URL`, appointment reminders). |
| #238 | Mobile PR1 | Crashes found by hand-testing both apps in a browser: staff app grey screen (l10n read in `initState`; `TenantMismatchNotifier` is a plain class), customer catalog grey screen (`CustomerTenantStorage` provider first; `provider` is a direct dependency), decimals sent as strings (`readAmount()` in core `json_amount.dart`), reservation notes field, company selector width. |
| #239 | Mobile PR2a | Western digits everywhere (`PriceFormatter`, `DateFormatter`); Arabic role labels (مستشار مبيعات / مدير مبيعات / مدير النظام / مشرف صيانة / وسيط عقاري); `unitTypeLabel`; `ltr()` isolates for phones; reservation/visit event labels. |
| #240 | Mobile PR3a | One header design: core `AppNavHeader` (compact mode with gold subtitle, `NavHeaderBack`, `AppNavSliverHeader`, `NavHeaderPill`, `NavHeaderButton`), `AppHomeHeader` (`HeaderRoleChip`, `HeaderDateChip`), glass bell with `NavHeaderBadge`. ~30 custom headers and 25 private back buttons replaced. |
| #241 | Mobile PR3b | Core `AppInfoChip` (label ellipsizes) and `AppKpiTile` (value scales down); six staff `_InfoChip` and two `_KpiTile` now render them; reservation chips wrap; cheque amount on one line; `AppTone.navy` lighter on dark surfaces. |
| #242 | Mobile PR3c | Core `AppFormSection` (numbered form step) replaces four private `_SectionCard` copies; broker «إضافة عميل محتمل» and «حجز جديد» are numbered steps with `AppTextField`; the customer app has one `InstallmentCard` (`features/installments/presentation/widgets/installment_card.dart`) for «أقساطي» and a property's installments tab, label «إرسال إثبات الدفع». |
| #243 | Mobile PR2b-1 | ~170 Arabic ARB values in Egyptian dialect rewritten in MSA (placeholders kept); follow-up "when" reads اليوم / غدًا / أمس from ARB. |
| #244 | Mobile PR2b-2 | ~200 Arabic strings typed in widgets move to ARB keys (MSA + English); `l10n_msa_test` blocks dialect words in `app_ar.arb`. |
| #245 | Customer app ST1 | Statement of account (كشف حساب) on a signed contract: `GET /contracts/me/contracts/:id/statement` (customer, own contract only; same figures as staff, without who reversed a payment or deposit ids); screen `contract_statement_screen.dart`. e2e `e2e-st1-customer-statement`. |
| #246 | Staff app LG-M | «ليا وعليا»: the dashboard's receivables & payables (`GET /reports/ledger`, `/reports/ledger/rows`) — same numbers by construction; admin or `reports:financial:read` (`StaffAccess.ledger`); periods, groups with state split, rows per group. `features/ledger/`. |
| #247 | Mobile PR3d | Core `AppFilterChip` — one list filter pill (dot, count, navy when selected) replacing 16 private copies in both apps. |
| PR 3e | Mobile | Project and unit pages in all three apps (customer, staff, broker) share one layout the owner chose: the navy header, the photos in a rounded card, then the sections (core `AppDetailPage`, `AppDetailSectionTitle`, `AppDetailStat`, `NavHeaderGlass`). The sliding bottom sheet is gone. Open. |

**Owner decisions (2026-11-03) on the open items:** customer statement in the app — yes (ST1); an unsigned contract's due rows — remind staff only, never the customer (ST2, next); the broker does not get the customer's national ID / address / extra fields; e-signing the contract itself is postponed (needs a lawyer's view on Egyptian law first). «ليا وعليا» must show the same numbers in the staff app and on the dashboard — the staff app has no ledger screen yet; owner approved: built in LG-M (same API and permission).

**Next, in this order (one PR each, owner approves each merge):**
1. **PR 2b — Modern Standard Arabic (owner: «فصحى») — split into 2b-1 (ARB values) and 2b-2 (strings in the code), see the table.** About 124 ARB values read as Egyptian dialect → MSA. About 470 hard-coded Arabic strings in `lib/` move to ARB keys (ar + en). Includes the strings added in 3a ('خدماتك المالية', 'طلبات الخدمة', 'جديد', 'تفاصيل الطلب', 'المساعد الذكي', …). Find them with `grep -rnP "'[^']*[\x{0600}-\x{06FF}]" lib/`.

**Owner decisions (2026-11-01/02):** all app text in فصحى; design first (3b, 3c), then 2b; Western digits (0-9) for numbers, prices and dates in both languages.

**Mobile checks before every push:** `flutter analyze` and `flutter test` in `packages/core`, `mobile_customer`, `mobile_staff` (flutter at `/opt/flutter-sdk/flutter/bin`). Afterwards `git checkout` `apps/mobile/pubspec.lock` and the three `analysis_options.yaml` files — local tooling rewrites them. Known analyzer warning: customer `image_picker_photo_picker.dart:41`.

**How the apps were hand-tested (QA harness, not in the repo):** a copy of `apps/mobile` with web platforms added (`flutter create --platforms web .` in each app), built with `flutter build web --profile -t lib/main_dev.dart --no-web-resources-cdn`, served with `python3 -m http.server` (customer :8081, staff :8082), against a local API in dev mode on a DB filled by the full demo seed. Playwright drives the apps through Flutter's semantics tree (enable it by clicking `flt-semantics-placeholder`, then find nodes by `aria-label`/text). Logins: `*@demo-full.devora` / `DemoFull@2026!` (mahmoud.sales, hala.manager, sayed.maintenance, karim.broker), `admin@example.com` / `ChangeMe123!` (company code `default`), customer by OTP (code printed in the API log). Screens were checked in light and dark, Arabic and English.

## 3. Round 4 — the plan (U1–U4 done; U5 in progress)

Found by four read-only scenario audits on 2026-10-16. The top items were re-checked by hand. Paths are under `apps/api/` unless noted. Line numbers are as of `main` @ `bd3e46a`.

**Recommended order: U2 → U1 → U3 → U4 → U5** (U2 first because broker commissions are broken for every company after the first).

**Status (2026-10-17):** round 4 is done — U2 (#89–#91), U1 (#92–#94), U3 (#95–#99), U4 (#100, #101 and the time-zone PR). New since this plan:
- The late-fee clock pause lives on `Installment.lateFeePausedSince` / `lateFeePausedSeconds`.
- The one chase rule is `CHASED_INSTALLMENT_WHERE` in `installments/live-contract.ts`.
- Warranties and customer maintenance start at the unit handover (`UnitHandover`, `POST /contracts/:id/handover`); contracts signed before it were backfilled as handed over at their creation date.
- A customer deletes their own account with `DELETE /users/me` (anonymised, records kept).
- Reports: `reportRange` / `localMonth` (`common/time/report-range.ts`) — date filters, "this month" and monthly buckets are in the company's time zone; collected is two figures (`TOWARDS_PRICE_DEPOSIT_WHERE`, `FEES_DEPOSIT_WHERE`); a sale counts by `signedAt`.

### U2 — Money

1. **Commission / payout numbers clash across companies (CRITICAL).** `commissionNumber @unique` (`prisma/schema.prisma:2420`) and `payoutNumber @unique` (`:2497`) are global; the generators (`broker-commissions.service.ts:548-561`, `broker-payouts.service.ts:464-477`) count per tenant → the second company's first commission collides, materialization fails forever; payouts 500. Fix: migration to `@@unique([companyId, commissionNumber])` / `@@unique([companyId, payoutNumber])` (pattern: `20261016050000_reservation_number_per_company`), retry on clash. Check the P2002 handler at `broker-commissions.service.ts:300-319`.
2. **Resubmitted proof pays an installment at a stale amount; or reopens review on a CANCELLED row.** `deposits.service.ts` resubmit (~1216-1283) checks only `PAID`; `approveProof` (~1286-1340) never compares amounts; `assertNoWaitingPayments` (`contract-amendments.service.ts` ~205-228) only blocks on PENDING_REVIEW, not REJECTED. Fix: resubmit requires installment PENDING/OVERDUE and amount equal; approve refuses a mismatch.
3. **Amendment vs. proof race.** Amendments check waiting payments before the transaction; customer submit is check-then-create. Re-check inside the amendment transaction (lock the plan's open rows).
4. **Unit swap bypasses the discount cap and archived-project block.** `swapUnit` (`contract-amendments.service.ts:635+`): select `unit.price`, call `assertDiscountAllowed` + `assertUnitOnSale` (as `changePrice` does at ~454-468).
5. **`releaseUnit` can free a resold unit and wipe the new buyer's warranties.** `contract-cancellation.service.ts:504-549`: require unit still SOLD and no other live contract on it; else mark released without touching the unit.
6. **Reschedule accepts a past `startsAt`** (`contract-amendments.service.ts` reschedule) → rows born overdue, late fees. Require `startsAt >= company-local today`.
7. **Payout / bonus status races** (`broker-payouts.service.ts:317-456`, `bonus.module.ts:471-500`, `contract-cancellation.service.ts:130-133, 220-275`): use `updateMany({ where: { id, status: expected } })`, zero count → 409; re-read inside the cancellation transaction.
8. **Clawback collection uncapped / lost update** (`clawback-resolution.service.ts:58-82, 213-237`): reject above outstanding; atomic increment with a status guard.
9. **Commission follows price changes** (`followNewPrice`, `contract-amendments.service.ts` ~397-435) — apply decisions 3 & 4 below: commission on a DRAFT/APPROVED payout is recomputed and the payout goes back to DRAFT; an APPROVED commission/bonus whose amount changes returns to PENDING; after PAID: decrease → clawback, increase → top-up entry; outstanding clawbacks are netted against the broker's next payout.
10. **Commission base** (decision 3): compute on the net price after discount, **excluding** the instalment financing markup (`increasePercentage`). Today it is `contract.totalAmount` (`reservations.module.ts` ~1982-1985, `installments/duration-calc.ts`).
11. **RETAIN on cancellation actually payable** (decision 6): `broker-commissions.service.ts:383-387`, `broker-payouts.service.ts:148, 243, 279`, `bonus.module.ts:483-485` currently block it.
12. **Suspended broker at signing** (decision 5): pays if the reservation was made while the broker was active; record skips as visible sign follow-up failures; re-run materialization on reactivation (`broker-commissions.service.ts:158-164`, `brokers.service.ts:240-310`).
13. Manual bonus entries: validate `salesId`/`ruleId` belong to the company and are active (`bonus.module.ts:270-345, 505-520`). Bonus for a rep who left (decision): **hold for review**.

### U1 — Security & privacy

1. **Phone change without verification** → a typo hands the account to whoever owns that number. `users.service.ts:380-411` + `auth.service.ts:846-858`. Fix: two-step change confirmed by OTP to the new number; OTP login must not land on an account whose phone was set by an unverified profile edit.
2. **`GET /me/contracts` leaks broker commission and broker-agent contact** (`contracts.module.ts:1226-1264` reuses the admin `list()` select at ~631-660). Give it its own select.
3. **Broker portal leaks:** `/portal/performance` (`broker-portal.controller.ts:256-309`, `broker-portal-performance.service.ts:24-45`, `broker-reports.service.ts:252-309, 1276-1350`) shows any agent firm money and other agents' clients — apply `agentFilter(viewer)` and `withoutMoney()` when `!canViewCommissions`; same for `/portal/me` and `/portal/projects` rates (`broker-portal.service.ts:44-45, 115-116`). `/portal/commissions` (`broker-portal-commissions.service.ts:8-19, 54-82`): add `agentFilter` and `brokerFacingPerson`.
4. **Broker manager can grant themselves `canViewCommissions`** (`broker-portal-team.service.ts:190, 278-280`): admin-only; default `false` for new members.
5. **Broker project access `startsAt`/`endsAt` never enforced** (`broker-access.service.ts:93, 119`; lookups in `broker-portal-reservations.service.ts:604-646`, `broker-portal.service.ts:84-140`, `broker-portal-leads.service.ts:247-285`, `broker-commissions.service.ts:194-197`).
6. **Maintenance attachments accept any storage key / external URL** (`maintenance.service.ts:1192-1211`, `documents.module.ts:72-104`): accept only keys presigned for this user.
7. **Maintenance category `code` globally unique** (`schema.prisma:1948`, migration `20260522130000_add_maintenance_category_sla`): per-company unique; map P2002 to 400.
8. **After a transfer** (decision 8): close the old owner's open maintenance requests instead of handing them (and their photos) to the new owner (`contracts/unit-warranties.ts:53-66`); booking deposits stay with the payer — split by transfer date using `createdAt`, not customer-entered `paidAt` (`ownership.service.ts:90-127`, `deposits.controller.ts:266-275`, `contract-amendments.service.ts:286-291`).

### U3 — Customer app & background jobs

1. **Cancelled rows shown as owed** after a reschedule: `GET /me/installments` returns CANCELLED (`installments.module.ts:1641-1648`); mobile treats unknown status as pending (`apps/mobile/mobile_customer/lib/features/installments/...`). Fix API side (exclude by default) and add a `cancelled` state in the app (Flutter — can't be run in the cloud container; CI runs `flutter analyze`/tests). Specific error for a proof on a cancelled row (`deposits.service.ts:1032-1036`).
2. **Notify the customer** on reschedule and price change (new templates, e.g. `contract_rescheduled`, `contract_price_changed`; see how transfer/swap notify).
3. **Late fees / overdue for blocked companies and deleted/inactive customers** (`installments.module.ts:450-461, 537-583`): skip them; refuse deleting/deactivating a customer with a live contract (`users.service.ts:589-601`).
4. **Late-fee decisions (decision 7):** waive late-fee rows tied to installments cancelled by a reschedule; pause the late-fee clock while the company is blocked or a proof is under review; a transfer requires overdue rows and fees to be settled first.
5. **One "should be chased" filter** (signed + not waiting on a payment) used by the overdue sweep, reminders (`installments.module.ts:1447`) and the me-home banner (`me-home.module.ts:245-265`).
6. Reminder installment number counts cancelled/fee rows (`installments.module.ts:1550-1552`).
7. **Auto-closed maintenance stays actionable** (`unit-warranties.ts:72-84`): set `reviewStatus` too, include RESOLVED, and make `approve`/`assign`/customer-confirm refuse CLOSED (`maintenance.service.ts:643, 724, 974`).
8. Supervisor who leaves: IN_PROGRESS back to OPEN/ASSIGNED, RESOLVED reassigned (`users.service.ts:511-521`).
9. Warranty dates editable silently once started (`unit-maintenance-items.module.ts:136-176`): only extensions, with reason + audit.
10. **Handover (decision 1):** add a unit handover event (date + checklist); warranties start and maintenance unlocks at handover (today: contract creation, `contracts.module.ts:990-993`, `unit-warranties.ts:12`, `maintenance.service.ts:547`). New unit's warranty after a swap starts at the swap date (`contract-amendments.service.ts` ~808). This is the biggest new feature — schema + API + web-admin + mobile.
11. **Customer account deletion (decision 9):** "request deletion" in the app → deactivate + anonymise personal data, keep contract/payment records; refused while a live contract exists. Required by Apple/Google.

### U4 — Reports

1. **Broker leaderboard always empty:** `reports.service.ts:270-271` joins `"User"` on `bc."brokerId"`, which references `"Broker"`. Join `"Broker"` (+ companyId). Test ISO-R3 passes by accident.
2. **`dateTo` drops the last day** (`lte: new Date('YYYY-MM-DD')`): `reports.service.ts:148/153, 190, 1098, 1328, 1484, 1615, 1660`; `broker-reports.service.ts:990-996`. One helper: date-only `dateTo` → `lt` start of next day in the company timezone.
3. **Collection rate** on the financial page (`apps/web-admin/.../reports/financial/page.tsx:135,149`) disagrees with the dashboard: return `collectedTowardsPrice` from `financialDashboard` (as `adminSummary` does at `reports.service.ts:456-472`).
4. **Sales performance counts cancelled contracts:** `bonus.module.ts:631-634` add `LIVE_CONTRACT_WHERE`.
5. Computed overdue/aging use `LIVE_PLAN_WHERE` and ignore payments on their way (`reports.service.ts:1009, 1349-1396`): use `BILLABLE_PLAN_WHERE` + `PAYMENT_NOT_ON_ITS_WAY`.
6. **Reports in the company timezone** (all buckets are UTC today): `reports.service.ts:156, 293-303, 320-323, 991-1005, 1686-1697, 2511-2523`; `bonus.module.ts:151-160`.
7. Dashboard cash-flow forecast drops rows due today (`reports.service.ts:438-449` vs `1281`).
8. Batch payment receipt linked to the first deposit only (`deposits.service.ts` recordMany) → link to all.
9. `netCollected` with a type filter subtracts all refunds (`reports.service.ts:1733-1760`).
10. **Decision 2:** show "collected towards price" and "fees & penalties" as two separate figures; a sale is counted by **`signedAt`** everywhere (reports page and `salesTrend` currently use `createdAt`).
- Left as is (not decided otherwise): sales use the current (amended) price; inventory "sold value" uses list price; "number of payments" counts deposit rows.

### U5 — Unified premium design (approved 2026-10-16)

The owner approved a redesign of the whole `apps/web-admin` app — the admin dashboard, the sales screens and the broker portal (`src/app/portal`) all share it. Mockups (light + dark, interactive): **https://claude.ai/artifact/UPVXRtVxEBMWpmuRMYqb1Z** — artboards: Dashboard (light / dark), Projects list, Leads Kanban, Inventory. The link is private to the owner's account; ask the owner to share it if you can't open it. Structure, content and section order of the current pages stay; only the look and how data is presented change. Do U5 **after U4** (U4 fixes the numbers these screens show) unless the owner says otherwise.

**Palette** (keep the existing tailwind CSS-variable setup, `darkMode: 'class'`, and map these values onto it):

| Token | Light | Dark |
|---|---|---|
| ground (page) | `#F4F0E6` ivory | `#0B111C` |
| surface (cards) | `#FFFDF8` | `#111927` |
| raised (nested rows/cards) | `#FBF7EE` | `#152033` |
| hairline | `#E6DECB` | `#233046` |
| track (empty bar) | `#EEE6D3` | `#1E2A3D` |
| ink (text) | `#141A26` | `#EEE8DA` |
| muted text | `#6B6658` | `#9AA3B2` |
| gold text (links, units, small accents) | `#86651F` | `#D8B66A` |
| gold soft (active chip bg) | `#F6EDD6` | `#2A2618` |
| success | `#2F6B45` | `#86C9A0` |

Fixed in both themes: sidebar `#0A1120` with gold hairline border; **navy band** `#0E1626` + border `rgba(216,182,106,.28)` + soft shadow (KPI strips, table headers, the dark project card); gold `#C79A3B` / `#D8B66A`; primary button = gold gradient `#D8B66A → #B38B3A`, text `#1A1408`, pill shaped.

**Unit status colours — one set everywhere** (bars, chips, legends): sold = ink (`#141A26` light / `#F4ECD8` dark), reserved = gold `#C79A3B`, available = sage (`#9FBFAB` bar, `#3F6B52` text light; `#5E7F6B` bar, `#86C9A0` text dark). Today the inventory page uses green for available and grey for sold — replace.

**Fonts** (`src/app/layout.tsx`, today Inter + IBM Plex Sans Arabic via `next/font/google`): body **Almarai** (400/700/800), headings **Noto Naskh Arabic** (600/700), large numbers **Cormorant Garamond** (500/600, lining numerals). Western digits everywhere — no Arabic-Indic digits mixed in (the inventory page mixes them today).

**Components to change (one change reaches every page):**
- `components/premium/page-hero.tsx` (`PremiumPageHero`, ~88 uses): drop the white card + gold top border. Breadcrumb, then a 40px Naskh title + muted description, actions on the same row as pill buttons (secondary = outlined, one gold primary). No duplicate badge repeating the title.
- `components/premium/metric-strip.tsx` (`PremiumMetricStrip`, ~45 uses): one **navy band** divided by gold hairlines instead of separate white cards with a different colour per number; icon = thin gold line icon in a gold-ring circle; value in Cormorant, single colour; unit in small gold text. A distribution (e.g. units sold/reserved/available) can sit in the band's bottom row as one segmented bar + legend.
- `components/premium/filter-bar.tsx` (`PremiumFilterBar`, ~31 uses) and the one-off filter bars — `components/broker/{commissions,payouts,reservations,units}-filter-bar.tsx`, `components/reports/report-filter-bar.tsx`, `components/crm/leads-filter-popover.tsx`, `components/ui/toolbar.tsx` — become **one** filter bar: a pill-shaped bar with search (ivory inset), filters as pill selects showing `label · value` (active = gold border + gold-soft bg), status as toggle chips **with counts** (as on inventory today), a "more filters" button, and a view toggle (table / cards / kanban) where the page has one. **No "Apply/بحث" button** — submit on change (keep the GET-params form semantics). Under the bar: result count, active filters as removable chips, "clear all".
- Tables: navy header row (`#0E1626`, muted `#A9B0BD` labels), hairline rows, Naskh for row titles, Cormorant for numbers, a segmented status bar where units are shown, a round chevron button to open the row. **Lists default to table view** on the dashboard (cards stay available via the toggle; remember the user's choice). On the projects list drop columns that are always empty/identical (phases "—", type "قياسي", last update "—" unless filled) and add units distribution + contract value.
- Kanban (`components/crm/*`, leads page): fixed 288px columns, stage colour only as a 3px top line, count in Cormorant, empty column shows a dashed "drop here"; the 7 coloured stage pills above the board go away (the band shows total / conversion / unassigned / open). Card: client name prominent, project + source, "days in stage" + "last contact", rep avatar only, code small and muted, call/mail round buttons. "Unassigned" becomes a toggle in the filter bar.
- Dashboard (`app/dashboard/page.tsx`, `components/dashboard/*`): the hero band holds total contracts (largest), collected, collection rate (thin ring), overdue, contracts this month; "needs action" = 4 hairline-divided tiles; thin gold area line for bookings; slim gradient bars for the funnel; segmented bar + legend for financial health; hairline-divided cash-flow columns; project health as cards.
- Sidebar (`components/layout/sidebar.tsx`): active item = gold-tinted background + gold dot (not a solid gold pill); user card at the bottom; remove the second "Platform Admin" block from the top bar.
- **Dark mode:** `components/ui/theme-toggle.tsx` already exists (localStorage `admin-theme`, toggles `.dark` on `<html>`) but is not mounted anywhere — mount it in the top bar and give the CSS variables the dark values above. Avoid a flash: `ui/theme-script.tsx` exists for that.

**Dashboard review (owner-approved 2026-10-17)** — besides the look, these screens mislead:
1. *Two collected figures disagree* (650.6K / 35% at the top vs 575.6K / 31% in "financial health"): fixed in #101 — both use `collectedTowardsPrice`; keep it that way and label it "collected towards price", with "fees & penalties" as its own figure.
2. *Collection rate* is collected ÷ the whole contract value, so a healthy company shows red "low — action needed" while most instalments are not due yet. Compute it against **what is due up to today** (booking + rows with `dueDate <= today`, not cancelled, fees out) — needs `dueToDate` from `financialDashboard` / `adminSummary` in the API; the rate's colour/label follow that.
3. *Sales funnel*: bookings can exceed leads (bookings made without a lead), so conversion between stages is meaningless and bars of 1 and 3 render the same length. Bars scale to the largest stage; a conversion % is shown only where the next stage is a subset of the previous one.
4. *Top sales reps*: when nobody has a signed contract this month, show "no sales this month" instead of ranking zeros.
5. *Monthly bookings*: bars with the value on each (small integers), not a smoothed line (this replaces "thin gold area line for bookings" above).
6. *Digits*: Western digits everywhere (the funnel prints ٣/١/٠).
7. *Recent activity*: group consecutive same-person same-kind rows ("3 payments · 120K") and show the amount on payments.
8. *Primary action*: "new project" is rare; the gold primary on the dashboard becomes "record payment" (secondary: "new booking").
9. The header card shrinks to one row (title + actions); no badge repeating the title; "Platform Admin" only once (sidebar).

**Reports page (owner-approved 2026-10-17, same mockup link):** thin tabs (sales & bookings / financial) with a gold underline on the active one; filter = period segmented (monthly / quarterly / yearly), year / month / compare as `label · value` pills, submit on change, the chosen range written out ("1 – 31 October 2026"); the five coloured cards → the navy band (total sales, contracts signed, payments collected, conversion rate), no empty/broken cards ("• · avg EGP"); monthly sales = gold bars with the value above, current month outlined, peak labelled ("May · 1 contract"); funnel = slim single-colour bars with the conversion % between stages (no purple/gold mix, no repeated summary); booking status = a small card beside "highlights", not a full-width strip; the four highlight cards (best month, best project, top broker, collection on sales) = one card split by hairlines, "no data" instead of "—"; empty project/broker tables = one small line in a dashed box.

**Slices** (each one PR, merged when CI is green): **U5a** tokens (light/dark), fonts, Western digits, sidebar + top bar + theme toggle; **U5b** `PremiumPageHero`, `PremiumMetricStrip`, the unified filter bar; **U5c** tables + leads kanban + projects list; **U5d** dashboard (with review items 2–9; item 2 needs the API change); **U5e** reports page.

**Status (2026-10-17):** done — U5a #104 (tokens, fonts, Western digits, sidebar, top bar, dark mode), U5b/U5c #105 (shared components, projects, inventory, leads), U5d/U5e #106 (dashboard + `financial.dueToDate`, reports page), U5f–U5h #107 (Tailwind's default hues follow dark mode, `PremiumSectionCard` panel look, financial tab filter, sales / sales-manager / broker homes, detail and form pages, broker filter bars). Shared pieces to build new screens with, all in `components/premium/`: `PremiumPageHero`, `PremiumMetricStrip` (navy band; `unit`, `ring`, `distribution`), `PremiumFilterBar` / `PremiumFilterField` / `PremiumFilterChips` / `PremiumViewToggle`, `PremiumPanel` / `PremiumEmptyNote`, `PremiumBars`, and `data-table.tsx` (`PremiumTableCard`, `RowTitle`, `RowIconTile`, `NumCell`, `RowOpenButton`, `UnitsBar`, `StatusPill`); `compactParts()` in `lib/format.ts` splits a figure into number + unit. Every `<thead>` under `#main-scroll` gets the navy header from `globals.css`. The kanban card's "days in stage" reads `Lead.stageChangedAt`, kept by the DB trigger `lead_stage_changed_at` (migration `20261017170000`) on every stage change from any code path; "last contact" is the latest `LeadNote` (`lastContactAt` on the leads list).

**What is left (small):** dark mode themes the 50–200 and 600–800 steps of Tailwind's default hues; a class using another step (e.g. `text-amber-500`) keeps its light-mode colour — use the theme tokens in new code. `components/ui/toolbar.tsx` is unused (nothing imports it).

Check every surface after the change: admin, sales (SALES / SALES_MANAGER), broker portal, both locales (ar RTL / en LTR), light and dark, and phone width. Playwright suites (`pnpm --filter web-admin e2e`) select by text and test ids — keep labels and `data-testid`s.

---

## 4. Decisions the owner approved for round 4 (2026-10-16, «موافق»)

1. **Warranty & maintenance start at a new unit "handover" event** (date + checklist). After a swap, the new unit's warranty starts at the swap date.
2. **Collected:** two figures — collected towards price, and fees & penalties. A sale counts by **signing date** everywhere.
3. **Commission & sales bonus base:** net price after discount, without the instalment markup.
4. **Price change after approval/payment:** approved → back to PENDING for re-approval; paid and price down → clawback for the difference, netted automatically against the broker's next payout; price up → top-up entry.
5. **Broker suspended at signing:** earns the commission if the reservation was made while active. Two brokers with the same client: first to register wins; admin can override.
6. **RETAIN on cancellation:** the commission/bonus remains payable.
7. **Late fees:** waived automatically on rescheduled rows; clock paused while the company is blocked or a proof is under review; a transfer requires overdue amounts to be settled first.
8. **After a transfer:** the old owner's open maintenance requests are closed (new owner files new ones); booking receipts stay with the payer.
9. **Customer account deletion:** "request deletion" in-app → deactivate + anonymise, keep financial records; not allowed while a live contract exists.
- Also: bonus for a rep who left → held for review.

---

## 4b. Round 5 — numbers audit (2026-10-17)

Four read-only audits of every money figure (reports, dashboard, exports, the schedule maths, commissions, role home pages). The basics are right (cents, remainder row, final payment once, addMonths, late fees, signing-date sales, tenant scoping). The fixes go in three PRs:

- **V1 — schedule money & cancellation:**
  - The reservation snapshot is built on the booking actually charged: a percentage of the unit price or an admin's amount (`durationCalc` in `reservations.module.ts`). Editing the booking rebuilds it; that is refused once the booking is paid or has a proof under review. Approving a booking proof checks the amount.
  - `createPlan` leaves out the reservation's booking.
  - No 0.00 rows: conversion skips them; a price change or swap cancels a row that rescales to 0, along with its unpaid late fees. A template's booking + down + final must fit in the net price.
  - The discount cap compares the sale price without the markup (`commissionBasis`) to the list price.
  - Refund + retained ≤ collected on cancellation.
  - A payment approved again after a reversal pays its row and counts as collected again (`PaymentCorrection.supersededAt`).
  - e2e: `e2e-v1-schedule-money`.
- **V2 — commissions:**
  - MANUAL cancellation: an approved commission leaves a payout not sent yet. It stays APPROVED for the admin.
  - Payout totals only count commissions and price-change adjustments on payable deals (`PAYABLE_DEAL_WHERE` in `rebalancePayout`).
  - CLAWBACK cancellation:
    - Unpaid price-change adjustments are dropped.
    - The clawback recovers what was actually paid: net + top-ups sent − clawbacks sent. This is the new `clawbackAmount` on BrokerCommission and BonusEntry, also used by collect and payout settling.
    - Open bonus ADJUSTMENT entries are cancelled; paid ones are added to the bonus clawback.
  - A bonus ADJUSTMENT follows the bonus it adjusts when approved.
  - Leaderboard and broker reports count earned-and-kept commissions only (`EARNED_COMMISSION_WHERE`, `earnedCommissionNet`), with adjustments.
  - Broker portal: the commission locked at reservation is on the net price, and the payout detail lists its adjustments.
  - e2e: `e2e-v2-commissions`.
- **V3 — one definition per report figure.** Decisions (owner, «موافق»):
  - **a.** "Sales" and "contract value" are the **net price**, without the instalment markup, as the commission base: `NET_PRICE_SQL` and `netContractValue` in `common/finance/commission-basis.ts`. This covers sales, the sales trend, admin-summary, top projects, financial-dashboard, broker sales and sales-target achievement.
  - **b.** "Contract value" counts **signed** contracts only; KPI contract counts are signed too.
  - **c.** The collection rate is `collectedAgainstDue / dueToDate`: collected against what is due by today (`againstDueDepositWhere`). Early payments don't count. Both figures are on admin-summary and financial-dashboard; the dashboard, financial page and PDFs use them.
  - Collected is two figures everywhere:
    - `/reports/financial` `total` is towards the price, with a new `fees` field.
    - The financial-dashboard and admin-summary exports show towards price and fees.
    - The "collection from sales" ratio is gone.
  - Overdue, remaining, aging, due this month and the cash-flow trend are towards the price (fee rows out). "Due this month" counts paid rows too. The distribution shows "not yet due" = outstanding − overdue.
  - Dashboard: the collected trend compares with the same days of last month; the reports comparison caps a running period to the days elapsed.
  - Smaller fixes:
    - Deleted reservations and deposits are left out of the reports and the activity feed.
    - "Expiring soon" includes APPROVED reservations.
    - The booking uncollected estimate is the unpaid bookings of active reservations.
    - Export period labels are correct, and the sales CSV names projects.
    - Team target % counts only reps that have a target.
    - Top projects include archived ones.
  - e2e: `e2e-v3-report-figures`.

- **W1 — markup waiver (decided 2026-10-18):** `POST contracts/:id/waive-markup` on early settlement waives instalment markup not paid yet.
  - The total and `Contract.markupWaived` move together, so the sale price, commission, bonus and net sales stay; it is not a discount.
  - The unpaid rows absorb it. More than the markup left is refused, because that is a price change.
  - `financingMarkup` / `commissionBasis` / `NET_PRICE_SQL` subtract the waiver.
  - Amendment type `MARKUP_WAIVER`; the contract page has the form. e2e: `e2e-w1-markup-waiver`.

- **W2 — reschedule and the final payment (decided 2026-10-18):** an unpaid final (balloon) payment due before the new schedule ends moves to a month after its last row, and its unpaid late fees are waived. e2e: `e2e-w2-reschedule-final`.

- **W3 — company time zone on the web (decided 2026-10-18):** `GET /company/currency` also returns `timeZone` (setting `company.timezone`).
  - The web reads it with `getCompanyTimeZone()` / `todayIn()` in `lib/currency.ts`.
  - It sets the reports' default month and the running-period cap, the sales homes' and performance page's month, and the dashboard greeting/date. These were UTC or hard-coded Cairo before.
  - e2e: `e2e-w3-company-timezone`.

Left for the owner, not in V1–V3:
- The leaderboard share % is of the top 10 brokers.

## 4c. Next: permissions that open pages (PRM) — owner-approved direction, 2026-10-28

> Owner: «أنا أعتقد 2 أفضل من ناحية قوة المنصة» — build it from the other account (limits on this one). Work in the phases below, one PR per phase (or smaller), each merged only after the owner says so.

**Today (checked 2026-10-28 on `main` 307b41d):** a permission can only *narrow* what a role does; it never opens anything.
- Guards run in this order (`apps/api/src/app.module.ts`): `JwtAuthGuard` → `CompanyLifecycleGuard` → `RolesGuard` → `PermissionsGuard` → `CapabilityGuard`. `RolesGuard` (`common/guards/roles.guard.ts`) refuses before the permission is looked at, so ticking e.g. `reports:sales:read` for a SALES user changes nothing: the routes are `@Roles(UserRole.ADMIN)`.
- The sidebar is role-based (`apps/web-admin/src/lib/nav.ts`: `filterNavForRole`, `admin` / `manager` / `salesActorOnly` flags); permissions are not read.
- The per-user permissions page (`/dashboard/users/[id]/permissions`, API `GET /users/:id/permissions` in `modules/permissions/permissions.module.ts`) offers the whole catalogue to any role, so an admin can tick codes that do nothing.
- A rough scan of the controllers (`@Roles` + `@Permissions` on the same route) found ~98 codes in use, ~65 of them only on `@Roles(ADMIN)` routes. Redo the scan as step 1 below; the number is approximate.
- New users get their role's starting codes (`modules/permissions/role-default-permissions.ts`).

**Target:** the permission opens the page. A role becomes a starting template of codes; any staff member of the company (ADMIN, SALES_MANAGER, SALES, MAINTENANCE_SUPERVISOR; not CLIENT/CUSTOMER; brokers keep their own portal) who holds a code can use the routes and the page behind it.

**Rules (owner-approved unless marked):**
1. **Dangerous codes stay ADMIN-only even when ticked:** `permissions:manage`, all `users:*`, `settings:read`/`settings:write`, data export (`/dashboard/data-export`), data import, `company_branding:manage`, `audit:read`, anything under `super-admin`. Otherwise a user could grant themselves everything. Keep this list in one place (e.g. `common/permissions/admin-only-codes.ts`) and enforce it in the guard **and** in `PUT /users/:id/permissions` (refuse to assign them to non-admins), with an e2e test.
2. **Data scope — owner-approved 2026-10-28:**
   - **Money, reports and admin pages** (deposits, cheques, ledger, installments, financial / sales / operational reports, brokers and their commissions and payouts, maintenance, campaigns, inventory edits…): a non-admin who is granted the code sees **the whole company**, as the admin does. The admin granted it on purpose; these records are not owned by a rep, so a "their own" view would be empty.
   - **Sales and customer data keeps today's scope** whatever extra codes are granted: leads, follow-ups, calendar, duplicates, sales-team performance. A rep sees their own, a sales manager their team (`resolveSalesScope`).
   - **Phone numbers stay masked** for anyone not responsible for the customer (`common/utils/contact-mask.ts`, #200), on every page including reports.
3. Tenant scoping is untouched: every query keeps `companyId` (CLAUDE.md).
4. Nothing the admin can do today is lost; an ADMIN still passes every check (keep `adminBypass` behaviour).

**Phase 1 — the gate (one PR):**
- Re-scan and write a table in the PR: each code → routes → today's `@Roles` → the new rule.
- Introduce a decorator/guard pair so a route can say "staff with this code" (e.g. `@Roles(...STAFF_ROLES)` + `@Permissions(code)`), and switch the ADMIN-only routes whose code is *not* on the dangerous list. Do it module by module; leave routes without `@Permissions` as they are.
- Before switching a module, read its service for admin-only assumptions (e.g. a query with no sales scope because "only admins call this") and note what a non-admin would see; anything that depends on the decision in rule 2 waits for phase 2.
- web-admin: build the sidebar from the session's codes (expose them on `GET /users/me` or the session cookie payload) instead of the `admin` flag; pages that guard on role server-side (`requireAdmin` etc.) switch to the code.
- Permissions page: group codes; dangerous ones shown locked with «لمدير النظام فقط» for non-admins.
- Tests: e2e per switched module — a SALES user without the code gets 403, with it gets 200 and sees what rule 2 says; a non-admin can never be given a dangerous code; existing security specs stay green (never widen a security assertion — CLAUDE.md).

**Phase 1 — done (PR from `claude/awesome-galileo-ob9jmm` after #199):**
- Mechanism: `@GrantedBy(code)` (`common/decorators/granted-by.decorator.ts`) on a route lets in any staff member (`STAFF_ROLES`) outside its `@Roles` who holds the code; `RolesGuard` loads the caller's codes only then, and `PermissionsGuard` takes that code as the route's permission. ADMIN passes as before.
- Admin-only codes: `common/permissions/staff-codes.ts` (`permissions:manage`, all `users:*`, `settings:read/write`, `company_branding:manage`, `audit:read`; data export/import are role-only ADMIN routes). `PATCH users/:id/permissions` refuses them for a non-admin (400 «لمدير النظام فقط»); one held from before never counts in either guard.
- `GET /me/permissions` returns the codes that count (an admin: all). web-admin reads it (`lib/permissions.ts`): nav items carry `perm`, pages use `can(...)` instead of `role === 'ADMIN'`.
- Opened in phase 1 — configuration and inventory only, nothing owned by a rep and no customer data: projects create/update/delete/publish, phases, buildings, units create/update/status/delete/reprice and unit models, project/unit media, campaigns (+ their reads) and lead intake, lead sources and lost reasons, CMS, notification templates and sending. The permissions page marks admin-only codes locked.
- Left for phase 2 (they depend on rule 2 and on role-default codes): reports, deposits/cheques/installments, contracts and reservations admin actions, bonus entries, brokers and their commissions/payouts/reports, maintenance, documents, visit scheduling, unit export.
- **Open question for the owner before phase 2:** reps and managers start with `deposits:read`, `contracts:read`, `installments:read`, `units:read`, `bonus:entries:read`, `visits:schedule/reschedule`, `reservations:update` (and the maintenance supervisor `maintenance:read/resolve`), which today show only their own records. If those codes opened the admin pages with rule 2's whole-company view, every rep would see the whole company. Proposed: a separate «whole company» code per money page; the old codes keep their own-records meaning.

**Phase 2 — data scope:** apply rule 2 per group of pages (reports, money, brokers, maintenance, campaigns, inventory edits), each with an e2e test of what a granted non-admin sees.

**Phase 2a — reports (done):** every `reports` route takes `@GrantedBy` with the code it already checks (`reports:sales|operational|financial:read`); `contracts/refunds/outstanding` takes `reports:financial:read`. A granted staff member sees the admin's figures (rule 2); no phone numbers are in them. web-admin: the reports page fetches and shows only the parts the codes open; the tabs, the ledger and the reports nav item follow the codes. e2e `e2e-prm2a-reports`.

**Phase 2b — contracts and payments (owner's decision 2026-10-28: «أقفلها وأعمل كود جديد»):** before this, `GET /contracts` and `GET /deposits` showed SALES the whole company's (and a manager the whole company's payments); only a manager's contract list was team-scoped. Now (`common/permissions/company-wide.ts`):
- A rep sees the contracts and payments of their own sales (the reservation's `salesId`), a manager their own and their team's; another rep's contract, statement or installment plan (and a manager's other team's proof) is 404. A contract with no reservation has no rep, so only an admin (or the codes below) sees it.
- New codes, in no role's starting set: `contracts:read:all` and `deposits:read:all` open the whole company's, as the admin sees them; `deposits:read:all` also opens a payment's detail and the review queue (`@GrantedBy`), and the «الدفعات» nav item. Approving, rejecting, recording and reversing payments stay with the admin.
- The mobile staff app is unchanged; it simply gets fewer rows for a rep. e2e `e2e-prm2b-money-scope`.
- Phase 2 is complete with 2f below; documents and the admin visit actions stay admin-only by decision.

**Phase 2c — cheques and bonus (done):**
- Cheques: `payment-instruments:manage` opens the cheques routes (`@GrantedBy`) and nav item to any staff member; the whole company's, as for an admin. Recording a bounce and its suggestion stay admin-only (`payment-instruments:bounce` is strict).
- Bonus: a rep sees their own entries, a manager their team's (unchanged). New `bonus:entries:read:all` (in no role's starting set) opens the whole company's entries and the CSV/XLSX/PDF export. `bonus:rules:manage` opens the rules, `bonus:entries:create` the manual entry. Approving, paying, reverting and clawback decisions stay admin-only.
- web-admin: the bonus page shows the export, rules, manual entry and approve/pay buttons only to whoever may use them; the cheques and bonus nav items follow the codes. e2e `e2e-prm2c-cheques-bonus`.

**Phase 2d — brokers (done):**
- Broker leads and broker reservations are sales data (rule 2): a rep sees the ones assigned to / handled by them, a manager their team's, whatever codes are held; another rep's is 404. Before, every rep and manager saw every broker lead (phones included) and a manager every broker reservation. The admin still sees all, including the queue to approve.
- A broker contract is a contract (phase 2b): own / team, or the whole company with `contracts:read:all`.
- The admin broker pages open by their codes (`@GrantedBy`): `brokers:read/create/update`, `broker_access:*`, `broker_users:read/update`, `broker_payouts:read/create/update`, `broker_reports:read`, `broker_commissions:read`, `broker_reservations:create`. Suspending, terminating, payout holds, approving/rejecting leads and commissions, approving/processing/paying payouts, clawbacks, and inviting or removing broker users stay with the admin.
- web-admin: the brokers, broker commissions, payouts and reports nav items follow the codes; the review and payout action panels show only to the admin. The broker leads/reservations/contracts nav items stay admin-only (their codes are in every rep's starting set). e2e `e2e-prm2d-brokers`.

**Phase 2e — maintenance (done):**
- A maintenance supervisor keeps working their own requests in the app; their starting codes (`maintenance:read/resolve`) open nothing more.
- New `maintenance:manage:all` (in no role's starting set) opens the dashboard's maintenance: the whole company's requests, detail, reports and exports, assignment, status/approve/reject, the categories list and the unit maintenance items. Customer phones show there, as for the admin (whoever runs maintenance is responsible for the customer's request).
- `maintenance:assign`, `maintenance:categories:manage` and `maintenance:items:manage` open their own routes. A request on a customer's behalf stays with the admin (its form needs the customer list).
- web-admin: the maintenance nav item follows the code; the «new request» button shows only to the admin and the categories section only to `maintenance:categories:manage`. e2e `e2e-prm2e-maintenance`.

**Phase 2f — unit export, and what stays with the admin (done):**
- The unit export (Excel / CSV: the company's full price list) opens by the new `units:export`, in no role's starting set; `units:read`, which every rep starts with, does not export. The export menu on the units and inventory pages follows the code. e2e `e2e-prm2f-unit-export`.
- **Documents stay admin-only** (owner, 2026-10-28: «تفضل للمدير بس»): the documents page holds the customers' papers (IDs, contracts, receipts); a rep reaches their own customers' papers from the contract page as before.
- **The admin visit actions stay admin-only**: approving website visit requests, scheduling, rescheduling and reassigning. They are customer data with phone numbers (rule 2), and `visits:schedule/reschedule` are in the reps' starting set, so opening them by code would open them to every rep.

**Phase 3 (optional) — company role templates:** an admin saves a named set of codes («محاسب», «تسويق», «سكرتارية») and applies it to a user in one step; changing the template can update its users.

**Watch out for:** the throttled login in Playwright (5/min on `login-staff`; see `e2e/two-factor.spec.ts` `formLogin`), the shared admin storage in Playwright (create your own users and delete them — inactive users still use a plan seat), and the mobile staff app (it is role-based too; keep its behaviour unless the owner asks).

## 5. Other open items

- **Old contracts that bill the final payment twice** (converted before #83): the owner chose a script — `scripts/fix-double-final-payment.ts` (logic in `src/modules/contracts/double-final-payment.ts`). Run it on production: take a backup (`scripts/db-backup.sh`), then `pnpm --filter @rep/api contracts:fix-double-final-payment:dry-run` to list them, then `pnpm --filter @rep/api contracts:fix-double-final-payment` to correct them. It takes the excess off the unpaid monthly rows (audit `contract.schedule-corrected`); contracts with a payment waiting, or already paid above the price (a refund), are listed for an admin.
- **Gaps left by #114–#176:**
  - A MANUAL cancellation's commission and bonus stay out of liabilities and totals until the admin decides.
  - Only the booking form is e-signed online; the contract is signed in ink.
  - The broker portal does not get the customer's national ID, address or extra fields.
  - An unsigned contract's due rows are not chased until it is signed (no customer reminder, no late fee). Since ST2, staff are alerted instead: a daily job (`UnsignedContractAlertCron`, `unsigned_contract_due`) tells the sales rep on the deal, their sales manager and the admins — once when a payment falls due, then weekly while the contract stays unsigned. Env: `UNSIGNED_CONTRACT_ALERTS_ENABLED`, `UNSIGNED_CONTRACT_ALERT_CRON` (default `0 7 * * *`, UTC).
- **Leaderboard share:** a broker's share % is of the top 10 brokers only. This is the owner's call.
- **Owner's own tasks:** hosting/deployment (deploys are manual — see 2c), `ANTHROPIC_API_KEY` and `SUPER_ADMIN_*` on the API host, Android keystore and Firebase secrets for company apps, restricting the Firebase API key, GitHub branch protection on `main`.
- **Deferred by the owner (2026-10-27, «حطها في التأجيلات»):**
  - Production deploy of everything since 2026-09-18 (#114–#240): take a backup first, run the migrations of 2b, 2c, 2d and 2g, then `pnpm db:schema-check`; then Actions → "CD — Deploy to Production".
  - API env on the server: `PUBLIC_API_URL`, `ANTHROPIC_API_KEY`, `SUPER_ADMIN_*`, `TOTP_ENCRYPTION_KEY` (before anyone turns two-step sign-in on).
  - Campaigns go-live: check the company's website domain is set (ad links use it), connect a Zapier or Make account for Meta lead forms, then run a small test campaign and check its leads arrive.
- Older backlog docs: `docs/BACKLOG.md`, `docs/EXECUTION_BACKLOG.md`, `docs/PROJECT_CURRENT_STATE.md` (may be behind this file).
