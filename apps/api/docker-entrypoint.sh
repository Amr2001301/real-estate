#!/bin/sh
# Entry point for the API container.
#
# Behavior:
#   * If RUN_MIGRATIONS=true is set in the environment, runs `prisma migrate deploy`
#     before launching the app. This is the ONLY way migrations run automatically.
#   * Otherwise migrations are NEVER run automatically — operators must run them
#     out-of-band (recommended for production).
#
# Note: `prisma migrate deploy` is non-destructive and only applies pending,
# already-committed migrations. We never run `migrate dev` or `db push` here.

set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=true — applying pending Prisma migrations..."
  # Use the local prisma binary from node_modules.
  ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma
  echo "[entrypoint] Migrations applied."
else
  echo "[entrypoint] RUN_MIGRATIONS not set — skipping prisma migrate deploy."
fi

exec "$@"
