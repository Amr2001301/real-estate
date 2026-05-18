# Script Safety Reference

This document catalogues every script under `apps/api/scripts/` and the safety
posture each one is expected to maintain. Read this before running any script
against staging or production.

## Quick reference

| Script | Purpose | Default mode | Requires `--execute` | Extra flags | Hard-deletes? |
| --- | --- | --- | --- | --- | --- |
| [smoke-broker-module.ts](../scripts/smoke-broker-module.ts) | Read-only invariant checks for the broker module (table existence, payout totals match commissions, no cross-broker leak, etc.) | read-only | n/a | none | no |
| [cleanup-duplicate-seed-data.ts](../scripts/cleanup-duplicate-seed-data.ts) | Delete *only* duplicate demo projects (and optionally exact-match demo leads) introduced by the old non-idempotent seed | dry-run | yes | `--delete-demo-leads` | yes — but only zero-FK demo rows |
| [backfill-broker-commissions.ts](../scripts/backfill-broker-commissions.ts) | Create missing `BrokerCommission` rows for already-signed broker contracts predating Phase 8 materialisation hooks | dry-run | yes | none | no |
| [dedupe-generic-leads.ts](../scripts/dedupe-generic-leads.ts) | Mark a generic open lead as `LOST` when the same client has a specific open lead | dry-run | yes | `--confirm` (mandatory alongside `--execute`) | no (status change only) |

## How to read this table

- **Default mode** = what happens when you run the script with no flags.
- **Read-only** = the script only issues `SELECT`s; safe to run anywhere, any time.
- **Dry-run** = the script issues no writes; it prints what *would* change.
- **Requires `--execute`** = a write only happens when this flag is present.
- **Extra flags** = anything else that gates a destructive action.

## Production usage rules

1. **Always start with a dry-run.** Even read-only scripts deserve a dry-run pass
   in staging to confirm the output is what you expect before you connect to
   production. The doc lists the dry-run as the *default* command for every
   script — that's not an accident.
2. **`--execute` is not enough on its own** for `dedupe-generic-leads.ts`. The
   script aborts with exit code 2 if `--confirm` is missing. Other scripts
   accept just `--execute` because their blast radius is narrower.
3. **Never bypass the dependent-record checks.** Cleanup and dedupe scripts
   skip rows that have foreign-key dependents — that's a feature, not a bug.
4. **Run on a database snapshot first.** For anything beyond `smoke:broker`,
   capture a `pg_dump` before running with `--execute` against production.
5. **One script at a time.** Do not run two write scripts concurrently — they
   may operate on overlapping rows.

## Per-script details

### `smoke-broker-module.ts`

```bash
pnpm --filter @rep/api smoke:broker
# or:
cd apps/api && npx tsx scripts/smoke-broker-module.ts
```

- 100% read-only. Wraps each check in a `safely()` helper so a missing
  table records `FAIL` instead of crashing the run.
- Exits `0` on PASS/WARN, `1` on any FAIL.
- Suitable for CI: gate deploys on this script.

### `cleanup-duplicate-seed-data.ts`

```bash
# Dry-run (lists every candidate + blockers, writes nothing):
pnpm --filter @rep/api cleanup:duplicate-seed-data:dry-run

# Execute — delete only zero-FK duplicate demo projects:
cd apps/api && npx tsx scripts/cleanup-duplicate-seed-data.ts --execute

# Execute — also delete signature-matching demo leads that have no dependents:
cd apps/api && npx tsx scripts/cleanup-duplicate-seed-data.ts --execute --delete-demo-leads
```

- Targets only projects whose translatable `name` matches a hardcoded demo
  signature; never touches anything else.
- A project is deleted only when (a) it's a duplicate of another project
  with the same name, (b) it's not the oldest, and (c) every non-cascade
  FK count is zero. Any non-zero count aborts that project.
- Demo leads are only deletable if their `(fullName, phone, email)` triple
  matches an exact hardcoded signature AND they have zero dependents.

### `backfill-broker-commissions.ts`

```bash
# Dry-run — print every candidate contract that would receive a commission:
pnpm --filter @rep/api backfill:broker-commissions:dry-run

# Execute:
cd apps/api && npx tsx scripts/backfill-broker-commissions.ts --execute
```

- Idempotent: only writes a row if no `BrokerCommission` exists for that
  contract.
- Delegates to the existing `BrokerCommissionsService.materializeFromContract()`
  so calc + activity + notification go through the single materialiser path.
- Never updates existing commission rows.

### `dedupe-generic-leads.ts`

```bash
# Dry-run (default):
pnpm --filter @rep/api dedupe:generic-leads:dry-run

# Execute — both flags are required:
cd apps/api && npx tsx scripts/dedupe-generic-leads.ts --execute --confirm
```

- Status-change only (`stage → LOST`); never deletes rows.
- Skips broker-attributed leads (the broker flow owns its lifecycle).
- Skips generic leads that have any `Reservation`, `VisitAppointment`, or
  `InfoRequest` rows — that's real engagement, not a dedupe candidate.
- Blocks "ambiguous" groups: a client with 2+ specific open leads. Those
  need a human to pick which one supersedes the generic.
- Each archived lead runs in its own transaction.

## Anti-patterns to avoid

- ❌ `npx tsx scripts/<x>.ts --execute --confirm` typed by muscle memory —
  always run dry-run first, eyeball the plan, **then** add the flags.
- ❌ Adding a new script that mutates data without dry-run support — copy
  the `EXECUTE = process.argv.includes('--execute')` pattern from the
  scripts above.
- ❌ Adding an alias in `package.json` that runs `--execute` for you.
  We deliberately ship `:dry-run` aliases only so the execute flag must be
  typed by hand.
- ❌ `prisma migrate reset` against any database that isn't local-only
  ephemeral — destroys all data.

## When you add a new mutating script

1. Default to dry-run. Gate writes behind `--execute`.
2. If the script can hard-delete or update many rows, also gate with `--confirm`.
3. Print a clear banner at the top: `🔍 DRY-RUN — no changes will be written.`
   vs `⚠️  EXECUTE — changes WILL be written.`
4. Wrap each mutation in a transaction.
5. Print the plan for every candidate (the row id + the reason) so a
   reviewer can diff dry-run vs execute output.
6. Update this document with a new row in the quick-reference table.
7. Add a `:dry-run` alias to `apps/api/package.json`. Do NOT add an
   `:execute` alias.
