import { test, expect } from '@playwright/test';
import { loginAsSales } from './helpers/auth';
import {
  assertRouteLoads,
  assertNavLinksHidden,
  ADMIN_ONLY_NAV_LABELS,
  type RouteCheck,
} from './helpers/assert';

/**
 * SALES browser-level smoke.
 *
 * Verifies a sales rep can reach their workspace (sales-focused home + the
 * shared read/workflow pages + their self-view) without auth redirect or error,
 * and that admin-only nav links and admin-only actions are NOT visible.
 * Data-independent: empty states are acceptable.
 */
const SALES_ROUTES: RouteCheck[] = [
  { path: '/dashboard/leads', heading: 'مسار مبيعات العقارات' },
  { path: '/dashboard/visits', heading: 'الزيارات' },
  { path: '/dashboard/reservations', heading: 'الحجوزات' },
  { path: '/dashboard/contracts', heading: 'العقود' },
  { path: '/dashboard/projects', heading: 'قائمة المشاريع' },
  { path: '/dashboard/units', heading: 'إدارة الوحدات السكنية' },
  { path: '/dashboard/inventory', heading: 'لوحة المخزون' },
  { path: '/dashboard/installments', heading: 'خطط التقسيط' },
  { path: '/dashboard/my-compensation', heading: 'مستحقاتي وأهدافي' },
];

test.describe('SALES smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSales(page);
  });

  test('lands on the sales dashboard home', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    // Sales-focused home (not the admin "المجلس الرقمي" dashboard).
    await expect(page.getByText('لوحة المبيعات').first()).toBeVisible();
    await expect(page.getByText('مرحباً بك في المجلس الرقمي')).toHaveCount(0);
  });

  test('can load every sales route without auth redirect or error', async ({ page }) => {
    for (const route of SALES_ROUTES) {
      await assertRouteLoads(page, route);
    }
  });

  test('admin-only nav links are hidden', async ({ page }) => {
    await page.goto('/dashboard');
    await assertNavLinksHidden(page, ADMIN_ONLY_NAV_LABELS);
    // Admin/finance management pages are also hidden from SALES nav.
    await assertNavLinksHidden(page, ['الدفعات', 'الوسطاء', 'العمولات']);
  });

  test('admin-only actions are not visible on catalog pages', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await expect(page.getByText(/إضافة مشروع/)).toHaveCount(0);

    await page.goto('/dashboard/units');
    await expect(page.getByText(/إضافة وحدة/)).toHaveCount(0);
  });
});
