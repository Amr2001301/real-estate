import { chromium, type FullConfig } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  SALES_EMAIL,
  SALES_PASSWORD,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  login,
} from './helpers/auth';

/**
 * Phase 7E — Playwright globalSetup: log in each role ONCE per test run and
 * persist the resulting storage state (cookies + localStorage) to disk so
 * every spec can re-attach without going through the form again.
 *
 * Why: previously every spec called `loginAsAdmin/Sales/Manager` in its own
 * `beforeEach`. With several specs per suite, three logins were happening per
 * worker, sometimes more than once each, and a single `pnpm playwright test`
 * invocation could fire 7+ logins in well under a minute — tripping the
 * `/v1/auth/login` 5-req/min throttle. The auth-state pattern reduces the
 * total to **3 logins per Playwright invocation** (one per role), which sits
 * well below the throttle whatever the suite size grows to. Specs that
 * legitimately need a fresh form login (e.g. negative tests) can still call
 * `login(page, …)` directly.
 *
 * Throttle stays in place — production behavior is unchanged.
 */
export const AUTH_DIR = path.resolve(__dirname, '.auth');
export const ADMIN_STORAGE = path.join(AUTH_DIR, 'admin.json');
export const SALES_STORAGE = path.join(AUTH_DIR, 'sales.json');
export const MANAGER_STORAGE = path.join(AUTH_DIR, 'manager.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3001';
  const browser = await chromium.launch();
  try {
    for (const [email, password, storagePath, label] of [
      [ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE, 'admin'],
      [SALES_EMAIL, SALES_PASSWORD, SALES_STORAGE, 'sales'],
      [MANAGER_EMAIL, MANAGER_PASSWORD, MANAGER_STORAGE, 'manager'],
    ] as const) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await login(page, email, password);
      } catch (e) {
        throw new Error(
          `[admin globalSetup] failed to log in ${label} (${email}). ` +
            'Is the API seeded (`pnpm prisma:seed:e2e`) and reachable, and the ' +
            'web-admin server running on baseURL? Original: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }
      await context.storageState({ path: storagePath });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
