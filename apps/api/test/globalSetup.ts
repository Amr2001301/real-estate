/**
 * Jest globalSetup for the backend e2e suite.
 *
 * Hard rules — this function REFUSES to run unless ALL of the following
 * hold. Each rule fails loudly with a specific message so a misconfigured
 * CI / dev shell can never reset the wrong database:
 *
 *   1. `TEST_DATABASE_URL` is set.
 *   2. `TEST_DATABASE_URL !== DATABASE_URL` (we will not reset the dev DB).
 *   3. The database name parsed out of `TEST_DATABASE_URL` contains
 *      `e2e` or `test` (case-insensitive). This catches a fat-fingered
 *      URL that points at an innocent-looking DB by name.
 *
 * After validation the function:
 *   - rewrites `process.env.DATABASE_URL = TEST_DATABASE_URL` so any
 *     PrismaClient created inside the booted Nest app reads from the
 *     e2e DB;
 *   - runs `prisma migrate reset --force --skip-seed` (drops + recreates
 *     all schemas under the test DB; never touches the dev DB);
 *   - runs `prisma migrate deploy` (ensures the schema is current);
 *   - runs the e2e seed (which itself runs the dev seed first).
 *
 * Set `SKIP_DB_RESET=1` to skip the destructive part (useful during local
 * iteration — you'll re-use whatever state the seed left). The safety
 * checks above still run.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

export default async function globalSetup(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      '[e2e globalSetup] TEST_DATABASE_URL is required.\n' +
        '  Set it to a DEDICATED e2e database whose name contains "e2e" or "test".\n' +
        '  Never point this at your dev / staging / production DB — the e2e setup will RESET it.\n' +
        '  Example:\n' +
        '    export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/realestate_e2e',
    );
  }
  if (devUrl && testUrl === devUrl) {
    throw new Error(
      '[e2e globalSetup] TEST_DATABASE_URL equals DATABASE_URL.\n' +
        '  E2E will RESET the target DB. Use a SEPARATE database for e2e.',
    );
  }

  let dbName: string;
  try {
    const url = new URL(testUrl);
    // Split returns string[] (possibly empty when the path is just "/").
    // `?? ''` keeps `dbName` strictly typed without changing behaviour: an
    // empty name still fails the next "must contain e2e/test" check loudly.
    dbName = url.pathname.replace(/^\//, '').split('?')[0] ?? '';
  } catch {
    throw new Error(
      `[e2e globalSetup] Could not parse TEST_DATABASE_URL as a URL: ${testUrl}`,
    );
  }
  if (!/e2e|test/i.test(dbName)) {
    throw new Error(
      `[e2e globalSetup] Refusing to reset database "${dbName}".\n` +
        '  TEST_DATABASE_URL must point at a database whose name contains "e2e" or "test".\n' +
        '  This rail catches a fat-fingered URL that points at a real database by name.',
    );
  }

  // From here on, every Prisma operation in this process (subprocesses
  // included) reads from the e2e DB. Setting it on process.env propagates
  // to execSync's spawned children via their inherited env.
  process.env.DATABASE_URL = testUrl;

  const apiRoot = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: testUrl };

  if (process.env.SKIP_DB_RESET === '1') {
    console.log(
      `[e2e globalSetup] SKIP_DB_RESET=1 — reusing whatever state is in "${dbName}". ` +
        'Specs may be flaky if rows from a prior run conflict.',
    );
    return;
  }

  console.log(`[e2e globalSetup] Resetting + seeding e2e database "${dbName}"…`);
  execSync('npx prisma migrate reset --force --skip-seed', {
    cwd: apiRoot,
    stdio: 'inherit',
    env,
  });
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    stdio: 'inherit',
    env,
  });
  execSync('npx tsx prisma/seed-e2e.ts', {
    cwd: apiRoot,
    stdio: 'inherit',
    env,
  });
  console.log('[e2e globalSetup] Ready.');
}
