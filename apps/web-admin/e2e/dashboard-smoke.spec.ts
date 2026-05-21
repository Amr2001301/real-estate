import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { assertRouteLoads, type RouteCheck } from './helpers/assert';

/**
 * Dashboard smoke test — admin browser-level coverage.
 *
 * Flow: log in as admin, then visit each core route and assert it does NOT
 * bounce to /login and renders its route-specific Arabic heading. Empty data is
 * fine — we assert the shell + heading only.
 */
const ROUTES: RouteCheck[] = [
  { path: '/dashboard', heading: 'مرحباً بك في المجلس الرقمي' },
  { path: '/dashboard/leads', heading: 'مسار مبيعات العقارات' },
  { path: '/dashboard/projects', heading: 'قائمة المشاريع' },
  { path: '/dashboard/units', heading: 'إدارة الوحدات السكنية' },
  { path: '/dashboard/customers', heading: 'العملاء' },
  { path: '/dashboard/inventory', heading: 'لوحة المخزون' },
  { path: '/dashboard/reports', heading: 'التقارير' },
];

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can load every core dashboard route without auth redirect or error', async ({
    page,
  }) => {
    await expect(page.getByText('مرحباً بك في المجلس الرقمي').first()).toBeVisible();
    for (const route of ROUTES) {
      await assertRouteLoads(page, route);
    }
  });
});
