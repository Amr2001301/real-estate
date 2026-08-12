# Analytics & Conversion Tracking

## Provider

Google Analytics 4 (GA4) via `gtag.js`.

## Configuration

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env.local` (or your deployment environment). When the variable is absent, analytics are silently disabled — no errors, no console noise in development.

## Architecture

All analytics calls go through a single abstraction layer. No component ever calls `gtag()` directly.

```
src/lib/analytics.ts   ← sole entry point
  trackEvent(name, params)
  trackPageView(pathname)
  safePath(pathname)    ← exported for testing
  hasPii(params)        ← exported for testing
```

### GA4 script injection

`apps/web-public/src/app/layout.tsx` injects two `<Script>` tags with `strategy="afterInteractive"` when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set:

1. The gtag.js loader from Google.
2. An inline init snippet that disables automatic page_view sending (`send_page_view: false`) — page views are fired manually by `PageViewTracker`.

### Page view tracking

`src/components/analytics/PageViewTracker.tsx` is a client component rendered in the root layout. It calls `trackPageView(pathname)` on every client-side navigation via `usePathname`.

Sensitive routes have their query string stripped before the pathname reaches GA:

| Route | What GA receives |
|---|---|
| `/reset-password?token=abc123` | `/reset-password` |
| `/verify-email?token=xyz` | `/verify-email` |
| `/projects/p-1` | `/projects/p-1` (unchanged) |

## Events

### Engagement

| Event | Fired when | Key params |
|---|---|---|
| `project_view` | Project detail page mounts | `project_id`, `city` |
| `unit_view` | Unit detail page mounts | `unit_id`, `unit_status` |
| `favorite_add` | Favorite API POST succeeds | `content_type` (`project`\|`unit`), `item_id` |
| `favorite_remove` | Favorite API DELETE succeeds | `content_type`, `item_id` |
| `compare_add` | Unit added to compare tray | `item_id` |

### Conversions

| Event | Fired when | Key params |
|---|---|---|
| `sign_up_complete` | Registration API succeeds | — |
| `login_complete` | Login API succeeds | — |
| `info_request_submit` | Info-request API succeeds | `project_id?`, `unit_id?` |
| `visit_request_submit` | Visit-request API succeeds | `project_id`, `unit_id?` |

**Rule:** conversion events fire only after a successful API response. A failed request or a user pressing submit is never counted.

## Privacy & PII protection

### Hard rules

Analytics must **never** transmit:

- Customer name, email, phone
- Any password or OTP
- Any token: reset token, verification token, JWT, access token, refresh token
- Reservation notes containing PII
- Payment information
- Private account IDs where avoidable

### Enforcement mechanism

`hasPii(params)` checks every key in event params against a blocklist (case-insensitive). If any key matches, the event is silently dropped and `gtag()` is never called. In development a `console.warn` is emitted.

Blocked keys: `email`, `phone`, `name`, `full_name`, `fullname`, `password`, `otp`, `token`, `reset_token`, `verification_token`, `jwt`, `access_token`, `refresh_token`.

### Safe path stripping

`safePath(pathname)` truncates sensitive route URLs to just the pathname, dropping any `?token=...` query parameter before it reaches GA.

## Testing

```bash
cd apps/web-public
npx jest --testPathPattern=analytics
```

Tests cover:

- `safePath` — normal paths, `/reset-password?token=...`, `/verify-email?token=...`
- `hasPii` — clean params pass, all PII key variants blocked
- `trackEvent` — disabled when `window.gtag` absent, params forwarded, PII blocked
- `trackPageView` — disabled when `window.gtag` absent, safe path applied, sensitive tokens stripped
- Conversion event contracts — correct shape, no PII, success-only semantics

## Adding a new event

1. Fire it via `trackEvent('my_event', { safe_param: value })`.
2. Never include PII keys — the guard will silently drop the event if you do.
3. Add a test case in `src/__tests__/analytics.test.ts`.
4. Document it in the Events table above.
