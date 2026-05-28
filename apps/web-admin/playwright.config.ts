import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the web-admin dashboard E2E suite.
 *
 * Requirements to run locally (see e2e/README.md):
 *   - The API must be running and reachable (default http://localhost:4000),
 *     seeded with the bootstrap admin (pnpm --filter @rep/api prisma:seed).
 *   - The web-admin server must be running on E2E_BASE_URL (default :3001).
 *     The `webServer` block below will start `pnpm dev` for you and reuse an
 *     already-running instance, but it does NOT start the API — start that
 *     separately.
 *
 * Credentials come from env (never hardcoded):
 *   E2E_ADMIN_EMAIL    (default: the seed admin admin@example.com)
 *   E2E_ADMIN_PASSWORD (default: the seed admin ChangeMe123!)
 *   E2E_BASE_URL       (default: http://localhost:3001)
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  // Phase 7E — log in each role once before any spec runs and persist the
  // resulting storage state to ./e2e/.auth/<role>.json. Specs attach via
  // `test.use({ storageState: ADMIN_STORAGE })` (etc.) instead of going
  // through the form per-test, keeping the per-IP login throttle headroom.
  globalSetup: './e2e/global-setup.ts',
  // Fail the build on CI if test.only is committed.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ar',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the web-admin dev server automatically and reuse an existing one.
  // Set E2E_NO_WEBSERVER=1 to manage the server yourself.
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
