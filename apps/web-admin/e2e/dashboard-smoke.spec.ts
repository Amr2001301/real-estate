import { test, expect } from '@playwright/test';
import { assertRouteLoads, type RouteCheck } from './helpers/assert';
import { ADMIN_STORAGE } from './global-setup';

// Phase 7E — attach the admin storage state (cookies + JWT) instead of
// logging in per-test, so the suite stays under the per-IP login throttle.
test.use({ storageState: ADMIN_STORAGE });

/**
 * Dashboard smoke test — admin browser-level coverage.
 *
 * Flow: log in as admin, then visit each core route and assert it does NOT
 * bounce to /login and renders its route-specific Arabic heading. Empty data is
 * fine — we assert the shell + heading only.
 */
const ROUTES: RouteCheck[] = [
  { path: '/dashboard', heading: 'لوحة التحكم' },
  { path: '/dashboard/leads', heading: 'مسار مبيعات العقارات' },
  { path: '/dashboard/projects', heading: 'قائمة المشاريع' },
  { path: '/dashboard/units', heading: 'إدارة الوحدات السكنية' },
  { path: '/dashboard/customers', heading: 'العملاء' },
  { path: '/dashboard/inventory', heading: 'لوحة المخزون' },
  { path: '/dashboard/reports', heading: 'التقارير' },
];

test.describe('Dashboard smoke', () => {
  test('admin can load every core dashboard route without auth redirect or error', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
    for (const route of ROUTES) {
      await assertRouteLoads(page, route);
    }
  });
});
