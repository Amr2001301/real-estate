# Operations & Monitoring Guide

## Health Endpoints

### Liveness — `GET /health/live`

Confirms the process is running. No external dependency checks.

```
200 OK  { "status": "ok" }
```

Use this for **process liveness** probes (container restart trigger). Will never return 5xx due to DB/Redis state — only indicates the Node.js process is alive.

### Readiness — `GET /health/ready`

Confirms the API can serve traffic. Checks PostgreSQL (`SELECT 1`) and Redis (`PING`) with 3s and 2s timeouts respectively.

```
200 OK   { "status": "ok",       "database": "ok",    "redis": "ok" }
503      { "status": "degraded", "database": "error", "redis": "ok" }
```

Use this for **traffic readiness** probes (load balancer routing, deployment gates). Return 503 means the API should not receive user traffic.

### Legacy — `GET /health`

DB-only check retained for backward compatibility. Prefer `/health/ready` for new monitors.

```
200 OK  { "status": "ok", "db": true, "time": "<ISO>" }
```

---

## External Uptime Monitoring

Point your uptime monitor (Better Uptime, Pingdom, UptimeRobot, etc.) at:

| Probe       | URL                | Expected | Alert on |
|-------------|-------------------|----------|----------|
| Liveness    | `GET /health/live`  | 200      | non-200  |
| Readiness   | `GET /health/ready` | 200      | non-200 or body `status != "ok"` |

Recommended check interval: 60 seconds. Alert threshold: 2 consecutive failures.

No vendor credentials are stored in this repository. Configure monitor URLs and notification channels in your uptime provider's dashboard.

---

## Request Correlation

Every request receives a unique `x-request-id`. The header is echoed back in the response.

- If the caller sends a valid `x-request-id` (alphanumeric + `._-`, max 128 chars), it is preserved.
- Otherwise a UUID v4 is generated server-side.
- The request ID is logged with every access log line and attached to Sentry events as a tag.

**Finding a request in logs:**
```
grep '"requestId":"<id>"' /var/log/app.log
```

**Finding a Sentry event:** search tag `requestId:<id>`.

---

## Error Monitoring (Sentry)

### API (`apps/api`)

Set `SENTRY_DSN` in the API's environment to enable. All other Sentry env vars are optional.

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Ingest URL — enables Sentry when set |
| `SENTRY_ENVIRONMENT` | `production`, `staging`, etc. (defaults to `NODE_ENV`) |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance tracing sample rate (`0` = off, default) |
| `SENTRY_RELEASE` | Release identifier for source maps |

Only **5xx server errors** are captured. 4xx client errors (validation, not found, unauthorized) are never sent to Sentry. Expected failures like `/health/ready` returning 503 when dependencies are down are **also not sent** — they are logged but not treated as errors.

### Web Public (`apps/web-public`)

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Server-side DSN (Node.js runtime) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side DSN (browser bundle — included at build time) |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | Source map upload (build-time, optional) |

Source map upload is opt-in. If all three build secrets are absent the plain Next.js config is used — local and CI builds are unaffected.

### Scrubbing

The following are **never** sent to Sentry:
- `event.request.data` (request body)
- `event.request.cookies`
- `event.request.query_string`
- Any header named `authorization`, `cookie`, `token`, `secret`, `password`, or `otp`
- Full user object — only `user.id` is attached

---

## Cron Observability

Cron jobs log their outcome on every run:

- Success: structured log at `LOG` level with sweep summary (e.g. `expired=3`)
- Lock skip: logged at `DEBUG` level — **not** sent to Sentry (expected in multi-instance deployments)
- Failure: error log + Sentry capture with `{ job: '<job-name>' }` tag

Cron jobs covered:

| Job | Lock Key | Sentry Tag |
|-----|----------|-----------|
| Reservation expiry sweep | `reservation-expiry` | `job=reservation-expiry` |
| Installments mark-overdue | `installments-mark-overdue` | `job=installments-mark-overdue` |
| Installment due-soon reminders | `installment-reminders` | `job=installment-reminders` |
| Maintenance unresolved alert | `maintenance-unresolved` | `job=maintenance-unresolved` |
| Maintenance SLA check | `maintenance-sla-check` | `job=maintenance-sla-check` |

---

## Startup Log

On boot the API emits a single structured startup line:

```
[Bootstrap] started env=production port=4000 sentry=enabled redis=redis.internal otp=twilio storage=r2
```

This confirms: environment, port, whether Sentry is active, Redis hostname (not URL), OTP provider, and storage backend.

---

## Incident Debugging Path

1. **Alert fires** on `/health/ready` returning non-200.
2. **Identify the request ID** from the client or load balancer access log.
3. **Search structured logs** for `"requestId":"<id>"` — find the relevant trace.
4. **Check Sentry** — search tag `requestId:<id>` for the captured exception, or filter by `job=<job-name>` for cron failures.
5. **Correlate entity IDs** — Sentry events for financial flows include `reservationId`, `unitId`, `contractId`, `installmentId` where relevant.
6. **Check DB/Redis** — if `/health/ready` reports `database: error` or `redis: error`, the dependency is unavailable; check infra, not application logs.

---

## Sensitive Data Policy

The following must **never** appear in logs or Sentry events:

| Category | Examples |
|----------|---------|
| Credentials | Passwords, hashed passwords, reset tokens, refresh tokens |
| OTP | One-time passwords, OTP seeds |
| Financial proofs | Payment proof file contents, bank statement contents |
| Connection strings | Full `DATABASE_URL`, full `REDIS_URL` (hostname only is acceptable in startup logs) |
| PII beyond ID | Full request bodies containing personal data, query strings |

When adding new log statements, log entity IDs and status codes — not payloads.
