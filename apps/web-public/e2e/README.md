# Public website smoke tests

Lightweight Playwright smoke suite for `@rep/web-public`.

## What it checks

Each public route returns **200** and renders its shell:
`/`, `/projects`, `/units`, `/compare`, `/contact`, `/login`, `/register`,
plus `/sitemap.xml` and `/robots.txt`.

The tests assert page shells (hero, form buttons, empty states), **not** seeded
data — so they pass whether the API is up or down. No database is required.

## Run locally

```bash
# one-time: install the Chromium binary
pnpm --filter @rep/web-public e2e:install

# run the suite (auto-starts `pnpm dev` on :3002 and reuses a running one)
pnpm --filter @rep/web-public e2e
```

Notes:
- The API does **not** need to be running; pages fall back to friendly states.
- Override the target with `E2E_BASE_URL`; set `E2E_NO_WEBSERVER=1` to manage
  the dev server yourself.
