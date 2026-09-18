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
import { PrismaClient } from '@prisma/client';

/**
 * Fails loudly if test-created schema objects from a previous interrupted run remain.
 * Objects named `zz_test_*` are test-only and must not exist at suite start.
 * See CLAUDE.md "Test-only schema objects" for the naming convention.
 */
async function checkForLeakedTestObjects(testUrl: string): Promise<void> {
  const probe = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    type Row = { object_type: string; name: string; table_name: string };
    const leaked = await probe.$queryRaw<Row[]>`
      SELECT 'CONSTRAINT'  AS object_type,
             c.conname      AS name,
             r.relname      AS table_name
        FROM pg_constraint c
        JOIN pg_class      r ON r.oid = c.conrelid
       WHERE c.conname LIKE 'zz_test_%'
      UNION ALL
      SELECT 'TRIGGER',
             t.tgname,
             r.relname
        FROM pg_trigger t
        JOIN pg_class   r ON r.oid = t.tgrelid
       WHERE t.tgname LIKE 'zz_test_%' AND NOT t.tgisinternal
      UNION ALL
      SELECT 'INDEX',
             i.indexname,
             i.tablename
        FROM pg_indexes i
       WHERE i.indexname LIKE 'zz_test_%' AND i.schemaname = 'public'
      ORDER BY object_type, table_name, name
    `;

    if (leaked.length === 0) return;

    const redacted = testUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
    const objectList = leaked
      .map(r => `  ${r.object_type.padEnd(10)} "${r.name}"  →  table "${r.table_name}"`)
      .join('\n');
    const dropSql = leaked
      .map(r => {
        if (r.object_type === 'CONSTRAINT')
          return `ALTER TABLE "${r.table_name}" DROP CONSTRAINT IF EXISTS "${r.name}";`;
        if (r.object_type === 'TRIGGER')
          return `DROP TRIGGER IF EXISTS "${r.name}" ON "${r.table_name}";`;
        return `DROP INDEX IF EXISTS "${r.name}";`;
      })
      .join('\n');

    throw new Error(
      `\n` +
      `[globalSetup] ── LEAKED TEST SCHEMA OBJECTS ─────────────────────────────────────\n` +
      `\n` +
      `  The previous security suite run was interrupted (SIGTERM or test timeout)\n` +
      `  before cleanup code ran. These test-only objects remain in the database:\n` +
      `\n` +
      `${objectList}\n` +
      `\n` +
      `  Target DB: ${redacted}\n` +
      `\n` +
      `  Drop them with this SQL, then retry the suite:\n` +
      `\n` +
      dropSql.split('\n').map(l => `    ${l}`).join('\n') +
      `\n` +
      `\n` +
      `  Alternatively, run without SKIP_DB_RESET=1 — the full migration reset clears them.\n` +
      `─────────────────────────────────────────────────────────────────────────────────\n`,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('[globalSetup] ── LEAKED')) throw err;
    // DB not yet reachable (fresh container, first-ever run). The migration reset
    // below will create the schema from scratch.
  } finally {
    await probe.$disconnect();
  }
}

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

  await checkForLeakedTestObjects(testUrl);

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
