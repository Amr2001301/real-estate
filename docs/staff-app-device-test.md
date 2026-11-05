# Staff app — real-device test checklist

For the person holding a phone. It lists what a browser run could not prove,
role by role, and what the release still needs from outside the code. Use it
next to [`mobile-release-guide.md`](mobile-release-guide.md) §6 (the generic
checklists) and [`mobile-store-readiness.md`](mobile-store-readiness.md).

Accounts: see [`manual-testing-access-sheet.md`](manual-testing-access-sheet.md).
Run each section once on **Android** and once on **iPhone**, in **Arabic**,
light and dark, with the phone's text size on the default and then on the
largest.

---

## 0. Before the first install (not testing — decisions and files)

| What | Where | State in the repo |
|---|---|---|
| Android `applicationId` | `android/app/build.gradle.kts` | `com.realestate.staff.mobile_staff`, with a TODO — cannot change after the first Play upload |
| iOS bundle id | Xcode project | needs the final id |
| App name | `AndroidManifest.xml`, `Info.plist` | «Devora Staff» on both |
| Release signing | `android/key.properties` + the keystore (outside git) | missing: a release build is signed with the **debug** key and must not be uploaded |
| Firebase (push, crash reports) | `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`, APNs key in the Firebase console | only the `.example` files are in the repo |
| API address | the flavor entrypoint (`main_dev` / `main_staging` / `main_prod`) | check the prod build points at the production API |

Build a release APK or AAB with the production entrypoint
(`flutter build appbundle --release -t lib/main_prod.dart`) and install **that**
for the run below, not a debug build: permissions and the missing Firebase file
only show up in release.

---

## 1. Every role

- [ ] Cold start: the splash, then the login page (or the home if signed in). No white flash, no crash.
- [ ] Wrong password shows the message in Arabic; the right one signs in.
- [ ] Two-step sign-in (an account with it on): the code page, a wrong code, a recovery code, back.
- [ ] Forgot-password page opens and sends the request.
- [ ] Sign out; sign in as a different role: no data of the first account is on screen.
- [ ] Kill the app and reopen: still signed in.
- [ ] Airplane mode: every list shows the friendly «no connection» state with a retry; no stack trace.
- [ ] Rotate the phone: the layout survives (or the app is portrait-only, as intended).
- [ ] Notifications: the bell, the unread count, open one, mark all as read.
- [ ] «الأمان»: devices list, the two-step page, change password.
- [ ] Phone actions: call, WhatsApp, e-mail buttons open the dialer / WhatsApp / mail app.
- [ ] Back gesture / button on every page returns one step and never exits from a detail page.
- [ ] Dark mode: open the contract, unit, lead and client pages; nothing is white-on-white.

## 2. Admin

- [ ] Home: the contract value ring, the month, «needs action», the funnel, projects, finance, cash flow, lead sources, top reps and brokers, activity — scroll to the end.
- [ ] Each «needs action» card opens its list.
- [ ] Leads: search, filter sheet, open a lead, change stage, log a contact, schedule a follow-up, add a note.
- [ ] Create a lead; it appears in the lead list and in the new-visit picker.
- [ ] Visits: create one (client, project, date and time), open it, reschedule, complete, cancel.
- [ ] Reservations: create (unit, plan), approve, reject, convert to a contract.
- [ ] Contracts: open one, the installments tab, record a payment, the statement, share the PDF.
- [ ] Payments review: open a proof (the image/PDF opens), approve, reject with a reason.
- [ ] Cheques: deposit, clear.
- [ ] «ليا وعليا»: each group, the period filter.
- [ ] Reports: sales and financial, the period filter, the comparison.
- [ ] Inquiries: reply, close.
- [ ] Brokers: the six tabs, a firm's sheet, approve and reject a commission (reason required), start paying and mark paid, suspend and resume a firm.
- [ ] Clients: list, search, a client page, suspend and reactivate.
- [ ] Campaigns, duplicates, calendar, follow-ups, the assistant (if the company has it).
- [ ] Documents: upload from the phone (camera roll and files), open and share.
- [ ] Calculator and installment plans: project → unit → plans.

## 3. Sales manager

- [ ] Home shows the team's figures; the team performance and team targets pages.
- [ ] Approve and reject a team reservation.
- [ ] A page the role cannot open shows «this page is not available for your account», not an error. (Clients, «ليا وعليا», reports, cheques.)
- [ ] «الوسطاء» shows only the tabs the account has a code for.

## 4. Sales

- [ ] Home, leads (only the rep's own), follow-ups, calendar.
- [ ] Create a lead, a visit, a reservation; log a contact.
- [ ] Targets and commissions pages.
- [ ] Cannot open: campaigns, clients, «ليا وعليا», reports.

## 5. Broker

- [ ] Lands on the broker home, never on a sales page; typing a sales route is impossible (and a deep link goes back to the broker home).
- [ ] Units and projects: only what the firm may see.
- [ ] Send a lead; create a reservation request; the contracts list; commissions and payouts; performance.

## 6. Maintenance supervisor

- [ ] Lands on the requests list only.
- [ ] Open a request, change its state, add a note and a photo (camera and gallery), the permission prompts read in Arabic.
- [ ] Notifications and «الأمان» work; nothing else is reachable.

---

## 7. Push (only after the Firebase files are in)

- [ ] The permission prompt appears once, in Arabic, on a first install (iOS and Android 13+).
- [ ] A notification sent from the dashboard arrives with the app closed, in the background and open.
- [ ] Tapping it opens the right page (lead, reservation, maintenance request).
- [ ] After sign-out, the device stops receiving the previous account's notifications.

## 8. Write down

For every failure: the role, the page, what you did, what you expected, and a
screenshot or a screen recording. Send them together; one list is faster to fix
than a message per problem.
