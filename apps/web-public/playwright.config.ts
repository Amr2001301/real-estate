import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke E2E config for the public website.
 *
 * These smoke tests are intentionally resilient: every public page renders a
 * shell (hero) plus either real data or a friendly empty/error state, so the
 * suite passes **even when the API is down** — no seeded DB required.
 *
 * The `webServer` block starts `pnpm dev` on E2E_BASE_URL (default :3002) and
 * reuses an already-running instance. Set E2E_NO_WEBSERVER=1 to manage it
 * yourself. Run browsers install once: `pnpm --filter @rep/web-public e2e:install`.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e',
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
    locale: 'ar',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
