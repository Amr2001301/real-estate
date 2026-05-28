/**
 * Jest globalTeardown for the backend e2e suite.
 *
 * Per-spec PrismaClients disconnect themselves via `afterAll` in their
 * own `setup-app.ts` flow. We deliberately do NOT drop the e2e database
 * here — leaving it in its final state lets a developer inspect with
 * `psql $TEST_DATABASE_URL` after a failure. The next `globalSetup` run
 * resets it anyway.
 */
export default async function globalTeardown(): Promise<void> {
  // No-op (intentional). See module docstring.
}
