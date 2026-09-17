# 15 — Email Delivery Audit

> **Scope:** Part 1 investigation only — no source files were modified.
> **Audit date:** 2026-09-17
> **Files read:** `prisma/seed.ts`, `notifications/notifications.module.ts`,
> `auth/email.service.ts`, `config/env.validation.ts`,
> `notifications/push.service.ts`, `common/firebase/firebase.service.ts`

---

## 1. NotificationTemplate seed: channel = EMAIL count

**Answer: zero.**

Every `NotificationTemplate` row created by `prisma/seed.ts` uses either
`NotificationChannel.PUSH` or `NotificationChannel.IN_APP`. The `EMAIL` enum
value exists in Prisma schema but is never assigned in the seed. This resolves
the uncertainty noted in `01-system-map.md §NEEDS HUMAN INPUT item 3`.

Evidence: `prisma/seed.ts:583–1188` — the `Promise.all([...].map(...))` block
upserts 68 templates (plus `admin_broadcast` in `notifications.module.ts:187`).
Searching every `channel:` assignment yields only `NotificationChannel.PUSH`
and `NotificationChannel.IN_APP`. No `NotificationChannel.EMAIL` appears
anywhere in that file.

---

## 2. End-to-end send path for an EMAIL-eligible notification

`deposit_recorded` is used as the example (seeded as `PUSH`, present in
`EMAIL_ELIGIBLE_TEMPLATES`). The path is:

### Step 1 — Business action completes its DB transaction

`deposits.service.ts:152` (admin record path): `prisma.$transaction` marks
installment PAID and creates a `Deposit` row. Post-transaction, the service
calls `notifications.sendToUser(customerId, 'deposit_recorded', {...})`. This
call is NOT awaited by the caller's method body (the result is not captured).

### Step 2 — `sendToUser` swallows all errors

`notifications.module.ts:252–265`:

```ts
async sendToUser(userId, templateCode, payload) {
  if (!userId) return;
  try {
    await this.send({ userId, templateCode, payload });  // line 259
  } catch (err) {
    this.logger.warn(`Notification send failed ...`);    // line 261
  }
}
```

Any error from `send()` is caught and logged. Nothing propagates to the
deposits service. The caller always sees `void`.

### Step 3 — `send()` writes the DB row first

`notifications.module.ts:314–379`:

- **Line 315–318:** Fetches the template. Throws if not found (caught in step 2).
- **Line 319:** `channel = dto.channel ?? tpl.channel` — resolves to `PUSH`
  (the template's seeded channel).
- **Line 322–330:** `this.prisma.notification.create(...)` — **the `Notification`
  row is written here, with `sentAt: new Date()`.** This is the record that
  appears in the in-app notification list and the audit trail.
- **Line 333:** Enters a single `try { ... } catch` block. Everything below
  runs inside this block.

### Step 4 — FCM push, awaited

`notifications.module.ts:353–357`:

```ts
await this.push.sendToUser(dto.userId, { title, body, data: fcmData });
```

`push.service.ts:37–84`: checks `this.firebase.messaging()`. If null (FCM
disabled), returns `{ enabled: false, ... }` silently. If enabled, calls
`messaging.sendEachForMulticast(tokens, ...)` — real FCM multicast over the
network. Dead tokens are pruned.

The `await` here means that if `sendEachForMulticast` throws a hard error,
it bubbles to the `catch` block at line 372 and is logged as a push warning.
The Notification row already exists by this point.

### Step 5 — Email: condition check, then fire-and-forget

`notifications.module.ts:360–371`:

```ts
if (user?.email && EMAIL_ELIGIBLE_TEMPLATES.has(dto.templateCode)) {
  const subject = resolveText(tpl.subject, payload, locale, dto.templateCode);
  const bodyText = resolveText(tpl.body, payload, locale, '');
  const htmlBody = `<div ...>...</div>`;
  void this.email.sendNotificationEmail(user.email, subject, htmlBody); // line 370
}
```

The `void` operator discards the returned promise. `sendNotificationEmail` is
called but NOT awaited. Its resolution or rejection is invisible to `send()`.
The outer try/catch at line 372 can only catch synchronous throws from the
email call — there are none, because `sendNotificationEmail` is async and
returns a promise immediately. **SF-02 confirmed.**

### Step 6 — `sendNotificationEmail` and the two silent exits

`email.service.ts:105–120`:

```ts
async sendNotificationEmail(to, subject, htmlBody): Promise<void> {
  const from = this.config.get('SMTP_FROM') ?? 'noreply@devora.sa';
  const transporter = this.createTransporter();   // line 107
  if (!transporter) {                             // line 108
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.warn(`[email] notification email to ${to} — ${subject}`);
    }
    return;                                       // line 113 — SF-03
  }
  try {
    const text = htmlBody.replace(/<[^>]+>/g, '');
    await transporter.sendMail({ from, to, subject, text, html: htmlBody });
  } catch (err) {
    this.logger.error(`Failed to send notification email to ${to}: ...`); // line 118
    // no rethrow — error is swallowed
  }
}
```

`createTransporter()` at `email.service.ts:122–130`: returns null if ANY of
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` is absent. A null transporter
causes early return at line 113. **SF-03 confirmed.**

### What the Notification row says in all cases

The `sentAt` timestamp is written unconditionally before push or email is
attempted (`notifications.module.ts:329`). The row's `channel` field reflects
the template's stored channel (PUSH or IN_APP), never EMAIL. There is no
field on the `Notification` model for email delivery status, email error, or
email attempt timestamp. The row cannot distinguish "email sent," "SMTP
unconfigured," or "SMTP call failed."

---

## 3. Behaviour in each environment

### A. SMTP fully configured (all four: HOST, USER, PASSWORD, FROM)

| Question | Answer |
|---|---|
| Customer gets email? | Yes — `transporter.sendMail` executes |
| Anyone finds out if it fails? | `logger.error` in server logs only; no alert, no DB update |
| What does the Notification row say? | `sentAt` = timestamp of write; no email-specific field |

The `sendMail` call may still fail (network error, provider rate limit, auth
failure). That failure is swallowed at `email.service.ts:118`. No retry, no
dead-letter, no operator alert.

### B. SMTP absent in development (NODE_ENV !== 'production')

| Question | Answer |
|---|---|
| Customer gets email? | No |
| Anyone finds out? | Yes — `logger.warn` at `email.service.ts:110` writes a one-line log entry to the server console. No structured error, no metric |
| What does the Notification row say? | `sentAt` set, looks identical to a successful send |

### C. SMTP absent in production (NODE_ENV === 'production')

`env.validation.ts:153–162` (inside `assertProductionRequirements`):

```ts
const smtpFields = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
for (const [key, label] of smtpFields) {
  if (!env[key]) errs.push(`${label} is required in production`);
}
```

`configValidation()` at line 236–241 throws if `prodIssues.length > 0`. The
API will **fail to start** if any SMTP field is absent in production. This
prevents the "SMTP absent in prod" scenario from being silent, but it also
means no other startup validation error can be reached — the app crashes on
the first missing SMTP field.

| Question | Answer |
|---|---|
| Customer gets email? | N/A — API never starts |
| Anyone finds out? | Yes — process exit with error list |
| Subtle risk | The startup check enforces presence of the env vars but not that the SMTP connection actually works. A wrong password or wrong hostname passes the startup check and fails silently at `sendMail` time |

### D. SMTP configured but send fails at provider

| Question | Answer |
|---|---|
| Customer gets email? | No |
| Anyone finds out? | `logger.error` at `email.service.ts:118` — server logs only. No structured metric, no operator alert |
| What does the Notification row say? | `sentAt` set; indistinguishable from a successful send |

This is the worst failure shape: the system records a sent notification, the
email never arrives, no automatic retry, no customer-visible error, no admin
alert. Because the `void` on line 370 discards the promise, even an unhandled
rejection would not surface to the NestJS exception filter.

---

## 4. PUSH-only templates with no email fallback (customer-critical)

Templates listed here: (a) have `channel = PUSH` in the seed, (b) are absent
from `EMAIL_ELIGIBLE_TEMPLATES`, and (c) are delivered to a customer.

| Template code | Recipient | Consequence if no FCM token |
|---|---|---|
| `payment_proof_approved` | Customer | Customer receives nothing when their payment proof is approved |
| `payment_proof_rejected` | Customer | Customer receives nothing when their proof is rejected; no hint to resubmit |
| `reservation_expired` | Client | **IN_APP only — never triggers push or email regardless** |
| `installment_plan_created` | Customer | **IN_APP only** |

Notes:
- `contract_created_customer`, `contract_signed_customer`,
  `contract_document_available` are PUSH **and** in `EMAIL_ELIGIBLE_TEMPLATES`.
  A customer with SMTP-configured tenancy will receive the email fallback.
- `payment_proof_approved` and `payment_proof_rejected` were identified as the
  highest-severity gap in `08-functional-gaps.md §3`. Confirmed: they are PUSH
  only, no email fallback.
- The older `deposit_verified` template (legacy verify path) IS in
  `EMAIL_ELIGIBLE_TEMPLATES`. The inconsistency between the two approval flows
  remains.

### Which templates ARE in EMAIL_ELIGIBLE_TEMPLATES

Confirmed from `notifications.module.ts:148–167`:

| Template code | Seed channel |
|---|---|
| `reservation_status_changed` | PUSH |
| `reservation_submitted_admin` | IN_APP |
| `reservation_payment_requested` | PUSH |
| `reservation_booking_paid` | PUSH |
| `contract_created_customer` | PUSH |
| `contract_signed_customer` | PUSH |
| `contract_document_available` | PUSH |
| `deposit_recorded` | PUSH |
| `deposit_verified` | IN_APP |
| `maintenance_request_created` | IN_APP |
| `maintenance_request_assigned` | IN_APP |
| `maintenance_request_resolved` | IN_APP |
| `maintenance_request_closed` | IN_APP |
| `installment_due_soon` | PUSH |
| `broker_approved` | PUSH |
| `broker_suspended` | PUSH |
| `user_account_approved` | PUSH |
| `user_account_suspended` | IN_APP |

All 18 emails in this set follow the same fire-and-forget path with the same
failure characteristics described in section 3.

---

## 5. FCM push: does it work today?

From code analysis:

- `firebase.service.ts:18–43`: `onModuleInit` initializes the Admin SDK when
  **all three** env vars are present: `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- When any is absent: `this.logger.warn('FCM disabled — Firebase credentials
  not configured')` and `this._app = null`.
- `push.service.ts:41–44`: if `messaging() === null`, returns
  `{ enabled: false, ... }` — a no-op, not an error.
- `env.validation.ts:204`: **Firebase is explicitly NOT required in production
  env validation.** The comment reads: `// Firebase is intentionally NOT
  required — FCM is not yet wired in code.` (Note: FCM IS wired in code now,
  but the comment hasn't been updated and the validation was never added.)

**Whether Firebase credentials are provisioned in production is an ops
question that cannot be answered from the codebase.** If credentials are
absent, push notifications silently fail for all recipients on all templates.
The Notification row is still written with `sentAt` set.

---

## 6. Architecture problems

### 6.1 The `void` on line 370 is the primary bug

`void this.email.sendNotificationEmail(...)` at `notifications.module.ts:370`
is not accidentally missing `await` — it is deliberately fire-and-forget. The
intent was to not block the push response while email is sending. The
consequence is that email failures are invisible to any upstream context.

### 6.2 The DB row conflates "notification created" with "notification delivered"

`Notification.sentAt` is set when the row is created (line 329), not when any
delivery channel confirms success. The model has no fields for:
- `emailSentAt`
- `emailError`
- `pushSentAt`
- `pushError`

From any DB query, a failed email and a successful email look identical.

### 6.3 No retry, no dead-letter

There is no mechanism to re-attempt a failed email. The only retry possible is
manual: an admin would need to trigger the notification again from the
notification templates UI, which sends a new notification rather than retrying
the original.

### 6.4 SMTP startup check validates presence, not connectivity

The production startup check (`env.validation.ts:153–162`) ensures the four
SMTP vars are non-empty strings. It does not open a test connection to the SMTP
host. A wrong password or misconfigured relay passes validation and fails
silently at runtime.

---

## 7. Scope of the fix (pre-decision; no code changed)

The fix has two distinct parts:

**Part A — `payment_proof_approved` / `payment_proof_rejected` (FG-07):**
Add both codes to `EMAIL_ELIGIBLE_TEMPLATES`. This is a one-line-per-code
change. Does not require any new infrastructure.

**Part B — The `void` / fire-and-forget email path (SF-02 / SF-03):**
Options range from:
1. **Minimal**: change `void` to `await`. This adds email latency to the push
   send path and surfaces email errors into the push-delivery catch block,
   which logs them as `logger.warn`. Delivery failures are now visible in
   server logs but still not in the DB. No retry added.
2. **Better**: change `void` to `await` AND write back to the `Notification`
   row (new nullable `emailError` / `emailSentAt` columns). Requires a
   migration. Adds observability without a queue.
3. **Not this**: BullMQ is wired but unused and CLAUDE.md forbids introducing
   it. No queue system.

The "minimal" option (1) is low-risk and immediately reduces the silent-failure
surface. Option (2) adds meaningful observability at the cost of a migration.

**Constraint acknowledged:** Do not send real email from tests.
