# 16 — Known Coverage Gap: Cross-Tenant Branding Isolation (End-to-End)

**Recorded:** 2026-09-24
**Category:** Integration test gap — not a bug; the risk is mitigated by four independent code-level proofs, but a live two-tenant smoke test has not been executed.

---

## What is unproven

The claim: _when two tenants share the same Next.js deployment, a request from tenant A's hostname can never receive tenant B's branded page._

This property has been verified through four code-level proofs:

1. **All routes are dynamic** (`ƒ` in `next build` output) — Next.js Full Route Cache is never populated for page routes; every request hits the server.
2. **`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`** is emitted by Next.js for every dynamic route. Verified with `curl -I` against a running `next start` instance.
3. **Next.js Data Cache is keyed by full URL** (`patch-fetch.js:611`) — `?slug=tenant-a` and `?slug=tenant-b` are separate entries; only HTTP 200s are stored; failed fetches are never cached.
4. **`Vary: Host`** is set on every page response by `middleware.ts:216` — if a CDN ignores `no-store` and caches anyway, it must cache per-hostname.

What has **not** been tested end-to-end: sending two sequential HTTP requests with different `Host` headers to a running `next start` process and observing that each response body carries the correct tenant's branding.

---

## Why it cannot be tested locally

`next start` (and the standalone server) determines the tenant hostname via `req.nextUrl.hostname`, which is populated from the server's **bind address** (`0.0.0.0` or `localhost`), not from the client's `Host` header.

This is a Next.js local-server limitation: production deployments on Vercel parse the `Host` header correctly (each custom domain is a separate edge node). The behaviour difference is visible in middleware logs:

```
# next start — req.nextUrl.hostname = 'localhost'  (bind address, not Host)
# Vercel prod — req.nextUrl.hostname = 'tenant-a.example.com'  (correct)
```

A two-tenant `curl` test using `-H 'Host: tenant-a.example.com'` against `localhost:3002` always resolves to an empty slug because the middleware reads the bind hostname, not the injected header.

---

## Three ways to close this gap

1. **Local reverse proxy (nginx/Caddy) + `/etc/hosts`** — proxy listens on port 80/443 for each tenant hostname and forwards to `next start`. The proxy must forward the original `Host` header unchanged. Add entries to `/etc/hosts` pointing each tenant hostname to `127.0.0.1`. This makes `req.nextUrl.hostname` resolve correctly in the middleware.

2. **`/etc/hosts` + `next start --hostname <tenant-hostname>`** — bind Next.js directly to one tenant hostname; requires separate server processes per tenant. Workable for a single-tenant sanity check but awkward for two-tenant comparison.

3. **Staging deploy on Vercel** with both tenant custom domains configured — a single `curl` request per domain proves isolation end-to-end using the real production runtime. This is the most complete verification.

---

## Must verify before first real tenant goes live

**Action required before onboarding the first production tenant.**

The code-level proofs cover the normal path. The unproven scenario requires a CDN that simultaneously ignores `Cache-Control: no-store` AND `Vary: Host` AND serves the same cached entry across different hostnames — pathological, but not impossible for misconfigured CDN rules.

**Recommended staging smoke test (< 5 min):**

```bash
TENANT_A="https://tenant-a.example.com"
TENANT_B="https://tenant-b.example.com"

NAME_A=$(curl -s "$TENANT_A" | grep -oE '"displayName":"[^"]+"' | head -1)
NAME_B=$(curl -s "$TENANT_B" | grep -oE '"displayName":"[^"]+"' | head -1)

if [[ "$NAME_A" != "$NAME_B" ]]; then
  echo "PASS: tenants isolated ($NAME_A vs $NAME_B)"
else
  echo "FAIL: same branding served to both tenants"
  exit 1
fi
```
