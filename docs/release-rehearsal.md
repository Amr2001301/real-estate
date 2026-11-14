# Release rehearsal (P0) — 2026-11-14

A full release rehearsal on this machine, short of the parts that need the
owner's servers, accounts and phones. It checks that the code on `main`
(after the brokerage phases #409–#416) deploys from nothing and runs in
production mode. Run it again before the first real deploy; the commands are
below.

## What was checked

| # | Check | Result |
|---|---|---|
| 1 | **Migrations from zero.** Empty PostgreSQL 16 database, `prisma migrate deploy` (155 migrations), then `prisma migrate diff --exit-code` against `schema.prisma` | All applied; drift exit 0 |
| 2 | **Boot without the required variables.** `NODE_ENV=production` with only `DATABASE_URL` | Refuses to start and names what is missing |
| 3 | **Production boot.** Every required variable from `docs/production-deployment.md` set (R2, SMTP, Twilio and Firebase with placeholder values; Redis under a non-localhost name) | Starts. Creates the platform owner from `SUPER_ADMIN_*`. `/health` and `/health/ready` are ok for database and Redis; `/metrics` is closed (503) without `METRICS_TOKEN` |
| 4 | **First-deploy smoke** (`scripts/first-deploy-smoke.mjs`, see below) | 28/28 |
| 5 | **Production builds.** `next build` for the dashboard and the website, then `next start` against the production API | Both build. Dashboard: `/login` and `/super-admin/login` answer 200; `/dashboard` sends a signed-out visitor to `/login`. Website: each company opens on its own sub-domain (`{slug}.{PLATFORM_BASE_DOMAIN}`) with its own name |
| 6 | **Browser on the production builds.** Sign in as the developer's admin, the brokerage's admin and the platform owner | Each lands on its own home (`/dashboard`, `/dashboard/super-admin`). No page errors, no 5xx. The brokerage reaches `/dashboard/listings` and `/dashboard/deals` |
| 7 | **`scripts/release-verify.sh`**: the 8 gates (API unit, API e2e, both Playwright suites, mobile analyze + tests, no Riverpod, architecture checks, no secrets) | See "release-verify" below |

### The first-deploy smoke (28 checks)

`scripts/first-deploy-smoke.mjs` is the script to run against staging (and
against production before the first real company). It:

1. Signs in as the platform owner.
2. Creates a developer company and a brokerage company, each with its admin.
3. Signs in as each admin. Each one's session carries its company type.

Then it checks:

- **Each company reaches its own pages.** Both create a lead and read their own permissions and notifications. The brokerage creates a listing and opens deals, launches, developers and targets. The developer opens projects.
- **The walls between the two company types hold.**
  - The brokerage is refused `/contracts`, `/projects` and the customer's `/me/installments` (`NOT_FOR_BROKERAGE`).
  - The developer is refused `/listings`, `/deals` and `/launches` (`NOT_FOR_DEVELOPER`).
- **Neither company can read the other's rows.**
  - The brokerage cannot read the developer's lead (404).
  - Naming the other company's slug with its own token is refused (403).
  - The developer cannot read the brokerage's listing.
- **The public catalog answers only when a company is named.**
  - It answers for a named company.
  - A request that names none is refused (503).

```bash
API=https://<staging-api>/v1 SA_EMAIL=<owner email> SA_PASSWORD=<owner password> \
ADMIN_PW=<new password for the two test admins> SMOKE_PREFIX=smoke1 \
node scripts/first-deploy-smoke.mjs
```

Passwords stay in the shell. The two test companies remain afterwards; suspend
or cancel them from the super-admin page.

## Found and fixed during the rehearsal

- **Percent figures read «%22» in Arabic.** On the navy figure band of the
  dashboards (the ring and the plain figure), the `%` sat before the number in
  right-to-left text. It now reads «22%», as in the apps.
  (`components/premium/metric-strip.tsx`)

The smoke's first run also failed one check, but that was the script's
mistake: it sent a unit-type name instead of its code. The platform seeds 15
unit types for every new company, the brokerage included.

## What only the owner can do (P0 that remains)

These are blocked on things only the owner has. The full list is in
`docs/phase-8-staging-qa.md` §C.

1. **Hosting.** Railway, or another host, for the API, with PostgreSQL 16 and Redis 7. Vercel for the dashboard and the website. Two R2 buckets: public, and private.
2. **Service accounts for the API environment.** SMTP, Twilio (production SMS), a Firebase service account, and `SUPER_ADMIN_*`.
3. **A staging copy** of all of the above. Then run, in order:
   1. `pnpm db:deploy`, then `pnpm db:schema-check`.
   2. Start the API.
   3. `scripts/first-deploy-smoke.mjs` against it.
   4. The manual checklists in `docs/phase-8-staging-qa.md` §B.
4. **A real Android phone and a real iPhone** for `docs/staff-app-device-test.md`. This needs REL1 first: the app ids, the Firebase files and the signing key.

## Production deploy notes

- **Everything since the last production deploy goes in one `pnpm db:deploy`.** That includes the brokerage phases' migrations:
  - `20261113180000_brokerage_listings` through `20261114150000_brokerage_developers_matching`
  - `20261114180000_brokerage_launches_eoi`
  - `20261114200000_brokerage_co_broking`
- **Take a backup first** (`scripts/db-backup.sh`). Then run `pnpm db:schema-check`; it must exit 0.

## How to repeat this rehearsal locally

1. **Migrations from zero.**
   - Create an empty database.
   - `DATABASE_URL=… npx prisma migrate deploy`.
   - `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`. It must exit 0.
2. **Start the API in production mode.**
   - Start it with `NODE_ENV=production`, using the variables in `docs/production-deployment.md`.
   - Placeholder values are fine for the external services.
   - Generate the secrets in the shell; never write them to a file.
   - Point `REDIS_URL` at a host name other than `localhost`, for example an `/etc/hosts` alias.
3. **Run the smoke.** `node scripts/first-deploy-smoke.mjs` with the variables above.
4. **Build and start the web apps.** `next build` then `next start` for `apps/web-admin` (`API_BASE_URL`) and `apps/web-public` (`API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`).
5. **Run the release gates.** `TEST_DATABASE_URL=… scripts/release-verify.sh`.
