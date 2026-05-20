import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Dashboard smoke test — the first browser-level coverage for web-admin.
 *
 * Flow: log in as admin, then visit each core route and assert it
 *   (a) does NOT bounce back to /login (auth/session intact), and
 *   (b) renders its route-specific Arabic heading (page actually loaded,
 *       not a global error boundary).
 *
 * Empty data is fine — we only assert the shell + heading, never row counts.
 */

interface RouteCheck {
  path: string;
  /** A stable Arabic substring that appears on the loaded page. */
  heading: string | RegExp;
}

const ROUTES: RouteCheck[] = [
  { path: '/dashboard', heading: 'مرحباً بك في المجلس الرقمي' },
  { path: '/dashboard/leads', heading: 'مسار مبيعات العقارات' },
  { path: '/dashboard/projects', heading: 'قائمة المشاريع' },
  { path: '/dashboard/units', heading: 'إدارة الوحدات السكنية' },
  { path: '/dashboard/customers', heading: 'العملاء' },
  { path: '/dashboard/inventory', heading: 'لوحة المخزون' },
  { path: '/dashboard/reports', heading: 'التقارير' },
];

async function assertRouteLoads(page: Page, route: RouteCheck): Promise<void> {
  await page.goto(route.path);

  // (a) Must not redirect to the login page.
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
  expect(new URL(page.url()).pathname).toBe(route.path);

  // (b) Route-specific heading is visible → the page rendered, not an error
  // boundary. `.first()` guards against the heading also appearing in nav.
  await expect(page.getByText(route.heading).first()).toBeVisible();

  // No Next.js global error overlay / crash text.
  await expect(
    page.getByText(/Application error|Internal Server Error|something went wrong/i),
  ).toHaveCount(0);
}

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can load every core dashboard route without auth redirect or error', async ({
    page,
  }) => {
    // Landing on /dashboard is implicitly verified by the login helper; assert
    // its heading explicitly too.
    await expect(
      page.getByText('مرحباً بك في المجلس الرقمي').first(),
    ).toBeVisible();

    for (const route of ROUTES) {
      await assertRouteLoads(page, route);
    }
  });
});
